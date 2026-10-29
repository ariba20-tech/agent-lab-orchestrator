import {
  EmployeeOutputSchema, FinalOutputSchema,
  type AgentRecord, type BenchmarkTask, type EmployeeOutput, type ExperimentConfig, type FinalOutput, type TaskResult,
} from "./types";
import { MockProvider, MOCK_PROVIDER_ID, TimeoutError, type EmployeeAssignment } from "./mock-provider";
import { Tracer, type ActiveSpan } from "./tracer";

/** Run fn over items with at most `limit` concurrent executions. */
export async function runPool<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  let active = 0;
  let maxActive = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      active++;
      maxActive = Math.max(maxActive, active);
      try {
        results[i] = await fn(items[i] as T, i);
      } finally {
        active--;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return { results, maxActive };
}

/** Manager planning: round-robin split of facts and required fields across employees. */
export function planAssignments(task: BenchmarkTask, agentCount: number): EmployeeAssignment[] {
  const n = Math.max(1, agentCount);
  const out: EmployeeAssignment[] = Array.from({ length: n }, (_, i) => ({
    task, agent_id: `employee-${i + 1}`, facts: [], fields: [],
  }));
  task.reference_facts.forEach((f, i) => out[i % n]!.facts.push(f));
  task.required_fields.forEach((f, i) => out[i % n]!.fields.push(f));
  return out;
}

export interface RunContext {
  config: ExperimentConfig;
  agentCount: number;
  trialIndex: number;
  tracer: Tracer;
  runSpan: ActiveSpan;
  experimentId: string;
  runId: string;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new TimeoutError(`timeout after ${ms}ms`)), ms + 50)),
  ]);
}

export async function executeTask(task: BenchmarkTask, ctx: RunContext): Promise<TaskResult> {
  const { config, tracer, agentCount } = ctx;
  const seed = config.model.seed ?? config.controlled.randomSeed;
  const provider = new MockProvider(config.mock, hashTrial(seed, ctx.trialIndex));
  const parallel = config.coordination !== "sequential";
  const verify = config.coordination === "parallel_verify" || config.aggregation === "verification_pass";
  const structured = config.coordination === "parallel_structured" || config.aggregation === "structured_schema" || verify;
  const common = { "experiment.id": ctx.experimentId, "run.id": ctx.runId, "task.id": task.task_key, "coordination.strategy": config.coordination, "model.id": config.model.model };

  const t = { model_requests: 0, retries: 0, est_tokens: 0, timeouts: 0, tool_failures: 0, schema_failures: 0, employee_failures: 0 };
  const taskSpan = tracer.start("task.execute", ctx.runSpan, { ...common, "agent.count": agentCount });
  taskSpan.taskKey = task.task_key;
  const startedAt = tracer.iso(taskSpan.startMs);

  // --- manager.plan
  const plan = tracer.start("manager.plan", taskSpan, { ...common, "agent.id": "manager" });
  plan.taskKey = task.task_key;
  const assignments = planAssignments(task, agentCount);
  const planningMs = plan.end("ok", { "plan.subtasks": assignments.length });

  // --- manager.route (parent of employee spans)
  const route = tracer.start("manager.route", taskSpan, { ...common, "agent.id": "manager", "routing.mode": parallel ? "parallel" : "sequential", "concurrency.limit": config.controlled.concurrencyLimit });
  route.taskKey = task.task_key;
  const finishTimes: number[] = [];
  const empDurations: number[] = [];

  const runEmployee = async (a: EmployeeAssignment): Promise<AgentRecord> => {
    const span = tracer.start("employee.execute", route, { ...common, "agent.id": a.agent_id, "agent.parent_id": "manager", "assigned.facts": a.facts.length, "assigned.fields": a.fields.length });
    span.agentKey = a.agent_id; span.taskKey = task.task_key;
    let attempt = 0;
    let output: EmployeeOutput | null = null;
    let status: AgentRecord["status"] = "failed";
    let errorCategory: string | null = null;
    while (attempt <= config.model.retryLimit) {
      if (attempt > 0) { t.retries++; span.event("retry", { attempt }); }
      const llm = tracer.start("llm.request", span, { ...common, "agent.id": a.agent_id, "llm.provider": MOCK_PROVIDER_ID, "llm.model": config.model.model, attempt });
      llm.agentKey = a.agent_id; llm.taskKey = task.task_key;
      t.model_requests++;
      let raw: string;
      try {
        const res = await withTimeout(provider.employeeCall(a, attempt, config.model.timeoutMs), config.model.timeoutMs);
        raw = res.raw;
        t.est_tokens += res.est_tokens_in + res.est_tokens_out;
        llm.end("ok", { "llm.tokens.estimated_in": res.est_tokens_in, "llm.tokens.estimated_out": res.est_tokens_out, "output.size": raw.length });
      } catch (e) {
        const cat = (e as { category?: string }).category ?? "model_request_failure";
        if (cat === "timeout") { t.timeouts++; status = "timeout"; } else status = "failed";
        errorCategory = cat;
        llm.end("error", { "error.category": cat, "error.message": (e as Error).message });
        attempt++;
        continue;
      }
      const tool = tracer.start("tool.execute", span, { ...common, "agent.id": a.agent_id, "tool.name": "mock.lookup" });
      tool.agentKey = a.agent_id; tool.taskKey = task.task_key;
      try {
        await provider.toolCall(task.task_key, a.agent_id, attempt);
        tool.end("ok");
      } catch (e) {
        t.tool_failures++;
        errorCategory = "tool_failure"; status = "failed";
        tool.end("error", { "error.category": "tool_failure", "error.message": (e as Error).message });
        attempt++;
        continue;
      }
      const val = tracer.start("output.validate", span, { ...common, "agent.id": a.agent_id, "input.size": raw.length });
      val.agentKey = a.agent_id; val.taskKey = task.task_key;
      try {
        const parsed = EmployeeOutputSchema.safeParse(JSON.parse(raw));
        if (!parsed.success) throw new Error("schema_validation_failure");
        output = parsed.data;
        status = "success"; errorCategory = null;
        val.end("ok");
        break;
      } catch (e) {
        t.schema_failures++;
        errorCategory = (e as Error).message === "schema_validation_failure" ? "schema_validation_failure" : "invalid_json";
        status = "failed";
        val.end("error", { "error.category": errorCategory });
        attempt++;
      }
    }
    if (status !== "success") {
      t.employee_failures++;
      if (attempt > config.model.retryLimit) span.event("retry_exhausted", { attempts: attempt });
    }
    const dur = span.end(status === "success" ? "ok" : "error", { "retry.count": Math.max(0, attempt - (status === "success" ? 0 : 1)), "error.category": errorCategory, status });
    finishTimes.push(tracer.now());
    empDurations.push(dur);
    return {
      agent_id: a.agent_id, parent_agent_id: "manager", role: "employee",
      assigned_task: `facts:${a.facts.length} fields:${a.fields.join(",") || "-"}`,
      status, attempts: Math.min(attempt + 1, config.model.retryLimit + 1),
      started_at: tracer.iso(span.startMs), completed_at: tracer.iso(span.endMs ?? span.startMs),
      output, error_category: errorCategory,
    };
  };

  let agents: AgentRecord[];
  if (parallel) {
    agents = (await runPool(assignments, config.controlled.concurrencyLimit, runEmployee)).results;
  } else {
    agents = [];
    for (const a of assignments) agents.push(await runEmployee(a));
  }
  const employeePhaseMs = route.end("ok", { "employees.total": agents.length, "employees.succeeded": agents.filter((x) => x.status === "success").length });
  const firstFinish = finishTimes.length ? Math.min(...finishTimes) : route.startMs;
  const lastFinish = finishTimes.length ? Math.max(...finishTimes) : route.startMs;

  // --- manager.collect_results: dedupe + detect missing/failed outputs
  const collect = tracer.start("manager.collect_results", taskSpan, { ...common, "agent.id": "manager" });
  collect.taskKey = task.task_key;
  const seen = new Set<string>();
  const usable: EmployeeOutput[] = [];
  let duplicates = 0;
  for (const ag of agents) {
    if (!ag.output) continue;
    if (seen.has(ag.agent_id)) { duplicates++; continue; }
    seen.add(ag.agent_id);
    usable.push(ag.output);
  }
  const failedAgents = agents.filter((a) => a.status !== "success").map((a) => a.agent_id);
  const collectionMs = collect.end(failedAgents.length ? "error" : "ok", { "results.received": usable.length, "results.missing": failedAgents.length, "results.duplicates": duplicates });

  // --- manager.aggregate
  const agg = tracer.start("manager.aggregate", taskSpan, { ...common, "agent.id": "manager", "aggregation.strategy": config.aggregation, "aggregation.input_count": usable.length });
  agg.taskKey = task.task_key;
  let aggModelMs = 0;
  let final: FinalOutput | null = null;
  let aggError: string | null = null;
  try {
    const r = provider.rand("agg", task.task_key);
    const callModel = async (label: string, n: number) => {
      const s = tracer.start("llm.request", agg, { ...common, "agent.id": "manager", "llm.provider": MOCK_PROVIDER_ID, "llm.model": config.model.model, "llm.purpose": label, "aggregation.input_count": n });
      s.taskKey = task.task_key;
      t.model_requests++;
      await provider.managerCall(task.task_key, n, label);
      t.est_tokens += n * 120;
      aggModelMs += s.end("ok");
    };
    if (config.aggregation === "parallel_groups" && usable.length > 2) {
      const groups: EmployeeOutput[][] = [];
      for (let i = 0; i < usable.length; i += 2) groups.push(usable.slice(i, i + 2));
      const t0 = tracer.now();
      await Promise.all(groups.map((g, i) => callModel(`group-${i}`, g.length)));
      aggModelMs = tracer.now() - t0; // overlapping: use wall-clock for group phase
      await callModel("merge", groups.length);
    } else {
      await callModel("synthesis", usable.length);
    }
    const facts: string[] = [];
    const claims: FinalOutput["claims"] = [];
    const fields: Record<string, string> = {};
    for (const o of usable) {
      for (const f of o.findings) {
        if (r() < config.mock.managerOmissionRate) continue; // injected omission
        facts.push(f);
        claims.push({ text: f, evidence_agent: o.agent_id });
      }
      Object.assign(fields, o.fields);
    }
    if (r() < config.mock.unsupportedClaimRate) {
      claims.push({ text: task.forbidden_claims[0] ?? `[mock] unsupported claim about ${task.task_key}`, evidence_agent: null });
    }
    const uncertainties = usable.flatMap((o) => o.uncertainties);
    let disagreements: string[] = [];
    if (task.conflicting) {
      const preserve = structured || r() >= config.mock.falseConsensusRate;
      disagreements = preserve ? ["Employee sources disagree; no consensus asserted"] : [];
    }
    const missing = structured ? task.required_fields.filter((f) => !(f in fields)) : [];
    final = {
      task_id: task.task_key,
      status_claim: usable.length === 0 ? "failed" : structured && (failedAgents.length || missing.length) ? "partial" : "complete",
      facts_reported: facts, fields, claims,
      uncertainties: structured ? uncertainties : [],
      unresolved_disagreements: disagreements,
      missing_fields: missing,
      failed_agents: structured ? failedAgents : [],
      verification: { performed: false, restored_facts: 0, removed_claims: 0 },
      generated_by: MOCK_PROVIDER_ID,
    };
    if (usable.length === 0) throw new Error("aggregation_failure: no usable employee outputs");
    agg.end("ok", { "aggregation.output_count": final.facts_reported.length });
  } catch (e) {
    aggError = (e as Error).message;
    agg.end("error", { "error.category": "aggregation_failure", "error.message": aggError });
  }
  const aggregationMs = (agg.endMs ?? agg.startMs) - agg.startMs;

  // --- verification pass (checks report against employee evidence)
  let verificationMs = 0;
  if (verify && final) {
    const v = tracer.start("manager.verify", taskSpan, { ...common, "agent.id": "verifier" });
    v.taskKey = task.task_key;
    await provider.managerCall(task.task_key, usable.length, "verify");
    t.model_requests++;
    const evidence = new Map<string, string>();
    usable.forEach((o) => o.findings.forEach((f) => evidence.set(f, o.agent_id)));
    const before = final.claims.length;
    final.claims = final.claims.filter((c) => c.evidence_agent && evidence.has(c.text));
    const removed = before - final.claims.length;
    let restored = 0;
    for (const [f, ag] of evidence) if (!final.facts_reported.includes(f)) { final.facts_reported.push(f); final.claims.push({ text: f, evidence_agent: ag }); restored++; }
    final.failed_agents = failedAgents;
    if (failedAgents.length && final.status_claim === "complete") final.status_claim = "partial";
    final.verification = { performed: true, restored_facts: restored, removed_claims: removed };
    verificationMs = v.end("ok", { "verification.restored": restored, "verification.removed": removed });
  }

  // --- final output validation
  const fv = tracer.start("output.validate", taskSpan, { ...common, "agent.id": "manager", "validation.target": "final_output" });
  fv.taskKey = task.task_key;
  const valid = final ? FinalOutputSchema.safeParse(final).success : false;
  const validationMs = fv.end(valid ? "ok" : "error", { valid });

  const status: TaskResult["status"] = final && valid && !aggError ? "completed" : "failed";
  const e2e = taskSpan.end(status === "completed" ? "ok" : "error", { status });

  return {
    task, status, started_at: startedAt, completed_at: tracer.iso(taskSpan.endMs!),
    agents, final_output: final, final_output_valid: valid, error: aggError,
    timings: {
      e2e_ms: e2e, planning_ms: planningMs, employee_phase_ms: employeePhaseMs,
      employee_mean_ms: empDurations.length ? empDurations.reduce((a, b) => a + b, 0) / empDurations.length : 0,
      wait_after_first_result_ms: lastFinish - firstFinish,
      collection_ms: collectionMs, aggregation_ms: aggregationMs, aggregation_model_ms: aggModelMs,
      verification_ms: verificationMs, validation_ms: validationMs, ...t,
    },
  };
}

function hashTrial(seed: number, trial: number) {
  return (seed * 31 + trial) >>> 0;
}

export interface RunOutcome {
  traceId: string;
  startedAt: string;
  completedAt: string;
  wallClockMs: number;
  tasks: TaskResult[];
  spans: Tracer["spans"];
}

/** Execute all tasks for one configuration (one experiment run). Tasks run sequentially so per-task timings stay comparable. */
export async function executeRun(tasks: BenchmarkTask[], config: ExperimentConfig, agentCount: number, trialIndex: number, ids: { experimentId: string; runId: string }): Promise<RunOutcome> {
  const tracer = new Tracer();
  const runSpan = tracer.start("experiment.run", null, { "experiment.id": ids.experimentId, "run.id": ids.runId, "agent.count": agentCount, "task.count": tasks.length, "coordination.strategy": config.coordination, "aggregation.strategy": config.aggregation, "trial.index": trialIndex, "llm.provider": MOCK_PROVIDER_ID });
  const results: TaskResult[] = [];
  for (const task of tasks) results.push(await executeTask(task, { config, agentCount, trialIndex, tracer, runSpan, ...ids }));
  const wall = runSpan.end(results.every((r) => r.status === "completed") ? "ok" : "error");
  return { traceId: tracer.traceId, startedAt: tracer.iso(runSpan.startMs), completedAt: tracer.iso(runSpan.endMs!), wallClockMs: wall, tasks: results, spans: tracer.spans };
}
