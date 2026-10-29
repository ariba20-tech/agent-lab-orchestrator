import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ExperimentConfigSchema, MAX_TASK_EXECUTIONS, totalTaskExecutions, type BenchmarkTask } from "./engine/types";
import { executeRun } from "./engine/orchestrator";
import { evaluateTask, summarizeRun, EVALUATOR_VERSION } from "./engine/evaluator";
import { MOCK_PROVIDER_ID, MOCK_NOTICE } from "./engine/mock-provider";
import { DEMO_DATASET_NAME, DEMO_DATASET_VERSION, DEMO_TASKS } from "./demo-dataset";

export const installDemoDataset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { projectId: string }) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: existing } = await sb.from("datasets").select("id").eq("project_id", data.projectId).eq("name", DEMO_DATASET_NAME).eq("version", DEMO_DATASET_VERSION).maybeSingle();
    if (existing) return { datasetId: existing.id, created: false };
    const { data: ds, error } = await sb.from("datasets").insert({
      project_id: data.projectId, owner_id: context.userId, name: DEMO_DATASET_NAME, version: DEMO_DATASET_VERSION,
      template: "A-E", source_type: "demonstration", is_demo: true,
      schema_json: { note: "Synthetic demonstration benchmark. Results on it are NOT evidence about real LLM behaviour." },
    }).select("id").single();
    if (error) throw new Error(error.message);
    const rows = DEMO_TASKS.map(({ template, ...t }) => ({ ...t, rubric: `[Template ${template}] ${t.rubric}`, dataset_id: ds.id, owner_id: context.userId }));
    const { error: e2 } = await sb.from("benchmark_tasks").insert(rows);
    if (e2) throw new Error(e2.message);
    return { datasetId: ds.id, created: true };
  });

const TaskUpload = z.object({
  task_key: z.string().min(1).max(80),
  description: z.string().min(1).max(4000),
  complexity: z.enum(["low", "medium", "high"]),
  required_fields: z.array(z.string().max(80)).max(30),
  reference_facts: z.array(z.string().max(500)).max(100),
  forbidden_claims: z.array(z.string().max(500)).max(30).default([]),
  conflicting: z.boolean().default(false),
  rubric: z.string().max(2000).nullable().optional(),
});
export const UploadedTaskSchema = TaskUpload;

export const uploadDataset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid(), name: z.string().min(1).max(120), version: z.string().min(1).max(40), tasks: z.array(TaskUpload).min(1).max(500) }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: ds, error } = await sb.from("datasets").insert({ project_id: data.projectId, owner_id: context.userId, name: data.name, version: data.version, source_type: "upload", template: "custom", schema_json: { fields: Object.keys(TaskUpload.shape) } }).select("id").single();
    if (error) throw new Error(error.message);
    const { error: e2 } = await sb.from("benchmark_tasks").insert(data.tasks.map((t) => ({ ...t, rubric: t.rubric ?? null, dataset_id: ds.id, owner_id: context.userId })));
    if (e2) throw new Error(e2.message);
    return { datasetId: ds.id };
  });

/** Executes every configuration × repetition of an experiment definition with the mock provider and persists runs, tasks, agents, spans and evaluations. */
export const executeExperiment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { definitionId: string }) => z.object({ definitionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const uid = context.userId;
    // Recover runs left 'running' by an interrupted request.
    await sb.from("experiment_runs").update({ status: "interrupted", error_summary: "Execution did not finish (request interrupted). Partial records may exist.", completed_at: new Date().toISOString() }).eq("status", "running").lt("started_at", new Date(Date.now() - 10 * 60_000).toISOString());

    const { data: def, error } = await sb.from("experiment_definitions").select("*").eq("id", data.definitionId).single();
    if (error || !def) throw new Error("Experiment not found");
    const config = ExperimentConfigSchema.parse(def.configuration_json);
    if (totalTaskExecutions(config) > MAX_TASK_EXECUTIONS) throw new Error(`Too many task executions (max ${MAX_TASK_EXECUTIONS})`);
    if (!def.dataset_id) throw new Error("Experiment has no dataset");
    const { data: taskRows } = await sb.from("benchmark_tasks").select("*").eq("dataset_id", def.dataset_id).order("task_key");
    if (!taskRows?.length) throw new Error("Dataset has no tasks");
    const tasks: BenchmarkTask[] = taskRows.slice(0, config.taskCount).map((t) => ({ ...t, complexity: config.complexity === t.complexity ? t.complexity : config.complexity }));

    const runIds: string[] = [];
    for (const agentCount of config.agentCounts) {
      for (let trial = 0; trial < config.repetitions; trial++) {
        const runId = crypto.randomUUID();
        const snapshot = { ...config, resolved: { agentCount, trialIndex: trial, taskKeys: tasks.map((t) => t.task_key), datasetId: def.dataset_id, datasetVersion: def.dataset_version, provider: MOCK_PROVIDER_ID, providerNotice: MOCK_NOTICE, evaluatorVersion: EVALUATOR_VERSION } };
        const { error: insErr } = await sb.from("experiment_runs").insert({ id: runId, owner_id: uid, experiment_definition_id: def.id, status: "running", provider: MOCK_PROVIDER_ID, model_identifier: config.model.model, configuration_snapshot: snapshot, sweep_label: `agents=${agentCount}`, trial_index: trial, started_at: new Date().toISOString() });
        if (insErr) throw new Error(insErr.message);
        runIds.push(runId);
        try {
          const out = await executeRun(tasks, config, agentCount, trial, { experimentId: def.id, runId });
          const taskRunIds = new Map<string, string>();
          const agentIds = new Map<string, string>();
          const metricsPer = out.tasks.map(evaluateTask);
          const trRows = out.tasks.map((t, i) => {
            const id = crypto.randomUUID();
            taskRunIds.set(t.task.task_key, id);
            return { id, owner_id: uid, experiment_run_id: runId, task_id: t.task.task_key, status: t.status, started_at: t.started_at, completed_at: t.completed_at, final_output: t.final_output, evaluation_status: "evaluated", metrics_json: { ...metricsPer[i], error: t.error } };
          });
          const arRows = out.tasks.flatMap((t) => t.agents.map((a) => {
            const id = crypto.randomUUID();
            agentIds.set(`${t.task.task_key}:${a.agent_id}`, id);
            return { id, owner_id: uid, task_run_id: taskRunIds.get(t.task.task_key)!, experiment_run_id: runId, agent_id: a.agent_id, parent_agent_id: a.parent_agent_id, role: a.role, assigned_task: a.assigned_task, status: a.status, attempts: a.attempts, started_at: a.started_at, completed_at: a.completed_at, output_json: a.output ? { ...a.output } : { error_category: a.error_category } };
          }));
          const spanRows = out.spans.map((s) => ({
            owner_id: uid, trace_id: out.traceId, span_id: s.span_id, parent_span_id: s.parent_span_id, experiment_run_id: runId,
            task_run_id: s.task_key ? taskRunIds.get(s.task_key) ?? null : null,
            agent_run_id: s.task_key && s.agent_key ? agentIds.get(`${s.task_key}:${s.agent_key}`) ?? null : null,
            operation_name: s.operation_name, start_time: s.start_time, end_time: s.end_time, duration_ms: s.duration_ms, status: s.status,
            attributes_json: { ...s.attributes, start_offset_ms: s.start_ms }, events_json: s.events,
          }));
          const evalRows = out.tasks.flatMap((t, i) => Object.entries(metricsPer[i]).map(([k, v]) => ({ owner_id: uid, experiment_run_id: runId, task_run_id: taskRunIds.get(t.task.task_key)!, evaluator_type: k.startsWith("proxy_") ? "behavioural_proxy" : "deterministic", evaluator_version: EVALUATOR_VERSION, metric_name: k, metric_value: v, details_json: {} })));
          for (const [table, rows] of [["task_runs", trRows], ["agent_runs", arRows], ["trace_spans", spanRows], ["evaluations", evalRows]] as const) {
            for (let i = 0; i < rows.length; i += 500) {
              const { error: e } = await sb.from(table).insert(rows.slice(i, i + 500) as never);
              if (e) throw new Error(`${table}: ${e.message}`);
            }
          }
          const summary = summarizeRun(metricsPer, out.wallClockMs);
          const failedTasks = out.tasks.filter((t) => t.status === "failed").length;
          await sb.from("experiment_runs").update({ status: "completed", trace_id: out.traceId, summary_json: { ...summary, failed_tasks: failedTasks, agent_count: agentCount }, completed_at: out.completedAt, error_summary: failedTasks ? `${failedTasks} of ${out.tasks.length} tasks failed` : null }).eq("id", runId);
        } catch (e) {
          await sb.from("experiment_runs").update({ status: "failed", error_summary: (e as Error).message, completed_at: new Date().toISOString() }).eq("id", runId);
        }
      }
    }
    return { runIds };
  });
