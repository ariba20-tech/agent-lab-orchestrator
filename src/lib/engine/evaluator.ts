import type { TaskResult } from "./types";

export const EVALUATOR_VERSION = "deterministic-v1";

export interface MetricDef { key: string; label: string; group: "execution" | "performance" | "quality" | "proxy"; definition: string; unit?: string }

export const METRIC_DEFINITIONS: MetricDef[] = [
  { key: "task_success", label: "Task success", group: "execution", definition: "1 if final output is schema-valid, covers all reference facts and required fields, has no unsupported claims, no contradiction, and an honest status claim; else 0." },
  { key: "employee_failure_rate", label: "Employee failure rate", group: "execution", definition: "Employees whose final status ≠ success ÷ employees assigned for the task." },
  { key: "timeout_count", label: "Timeouts", group: "execution", definition: "Count of llm.request spans ending with error.category = timeout." },
  { key: "tool_failure_count", label: "Tool failures", group: "execution", definition: "Count of tool.execute spans with error status." },
  { key: "retry_count", label: "Retries", group: "execution", definition: "Number of re-attempts after a failed llm.request / tool / validation step." },
  { key: "schema_failure_count", label: "Schema/JSON failures", group: "execution", definition: "Employee outputs that failed JSON parsing or Pydantic-equivalent (zod) schema validation." },
  { key: "e2e_ms", label: "End-to-end latency", group: "performance", unit: "ms", definition: "Wall-clock duration of the task.execute span (start of planning to end of final validation)." },
  { key: "planning_ms", label: "Manager planning", group: "performance", unit: "ms", definition: "Duration of manager.plan span." },
  { key: "employee_phase_ms", label: "Employee phase (wall-clock)", group: "performance", unit: "ms", definition: "Duration of manager.route span: dispatch of first employee until the last employee settles. Overlapping employee spans are not summed." },
  { key: "wait_after_first_result_ms", label: "Wait for unfinished employees", group: "performance", unit: "ms", definition: "Time between the first and last employee completion — the time the manager is blocked waiting on stragglers." },
  { key: "collection_ms", label: "Collection / sync overhead", group: "performance", unit: "ms", definition: "Duration of manager.collect_results span (deduplication, missing-output detection)." },
  { key: "aggregation_ms", label: "Aggregation wall-clock", group: "performance", unit: "ms", definition: "Duration of manager.aggregate span." },
  { key: "aggregation_model_ms", label: "Aggregation model-call time", group: "performance", unit: "ms", definition: "Wall-clock time inside llm.request children of manager.aggregate (parallel group calls measured as one wall-clock interval)." },
  { key: "verification_ms", label: "Verification pass", group: "performance", unit: "ms", definition: "Duration of manager.verify span; 0 when not enabled." },
  { key: "model_requests", label: "Model requests", group: "performance", definition: "Number of llm.request spans for the task." },
  { key: "est_tokens", label: "Estimated tokens", group: "performance", definition: "MOCK ESTIMATE: characters ÷ 4. Not real provider token usage." },
  { key: "fact_coverage", label: "Reference fact coverage", group: "quality", definition: "Reference facts present in final facts_reported ÷ total reference facts." },
  { key: "required_field_coverage", label: "Required field coverage", group: "quality", definition: "Required fields present in final output ÷ required fields." },
  { key: "unsupported_claims", label: "Unsupported claims", group: "quality", definition: "Claims in final output not matching any reference fact or any employee finding." },
  { key: "forbidden_claims", label: "Forbidden claims", group: "quality", definition: "Claims that exactly match a benchmark's forbidden-claim list." },
  { key: "contradiction", label: "Contradiction / false consensus", group: "quality", definition: "1 if a conflicting-evidence task's output reports no unresolved disagreement; else 0." },
  { key: "schema_valid", label: "Output schema valid", group: "quality", definition: "1 if final output passes FinalOutput schema validation." },
  { key: "evidence_traceability", label: "Evidence traceability", group: "quality", definition: "Claims with an evidence_agent that actually reported that finding ÷ total claims." },
  { key: "proxy_honest_status", label: "Honest status reporting", group: "proxy", definition: "OPERATIONAL PROXY. 0 if any employee failed but the manager claimed 'complete'; else 1." },
  { key: "proxy_uncertainty_preserved", label: "Uncertainty preserved", group: "proxy", definition: "OPERATIONAL PROXY. For conflicting tasks: 1 if uncertainties or disagreements are reported. N/A otherwise." },
  { key: "proxy_failure_reported", label: "Failures reported", group: "proxy", definition: "OPERATIONAL PROXY. When employees failed: 1 if failed_agents lists them all. N/A otherwise." },
];

export type MetricMap = Record<string, number | null>;

export function evaluateTask(r: TaskResult): MetricMap {
  const o = r.final_output;
  const t = r.timings;
  const employees = r.agents.length || 1;
  const failed = r.agents.filter((a) => a.status !== "success").map((a) => a.agent_id);
  const base: MetricMap = {
    employee_failure_rate: failed.length / employees,
    timeout_count: t.timeouts, tool_failure_count: t.tool_failures, retry_count: t.retries, schema_failure_count: t.schema_failures,
    e2e_ms: t.e2e_ms, planning_ms: t.planning_ms, employee_phase_ms: t.employee_phase_ms, wait_after_first_result_ms: t.wait_after_first_result_ms,
    collection_ms: t.collection_ms, aggregation_ms: t.aggregation_ms, aggregation_model_ms: t.aggregation_model_ms, verification_ms: t.verification_ms,
    model_requests: t.model_requests, est_tokens: t.est_tokens,
  };
  if (!o) {
    return { ...base, task_success: 0, fact_coverage: 0, required_field_coverage: 0, unsupported_claims: null, forbidden_claims: null, contradiction: null, schema_valid: 0, evidence_traceability: null, proxy_honest_status: null, proxy_uncertainty_preserved: null, proxy_failure_reported: null };
  }
  const ref = r.task.reference_facts;
  const reported = new Set(o.facts_reported);
  const factCov = ref.length ? ref.filter((f) => reported.has(f)).length / ref.length : 1;
  const req = r.task.required_fields;
  const fieldCov = req.length ? req.filter((f) => f in o.fields).length / req.length : 1;
  const employeeFindings = new Map<string, Set<string>>();
  r.agents.forEach((a) => employeeFindings.set(a.agent_id, new Set(a.output?.findings ?? [])));
  const allFindings = new Set([...employeeFindings.values()].flatMap((s) => [...s]));
  const unsupported = o.claims.filter((c) => !ref.includes(c.text) && !allFindings.has(c.text)).length;
  const forbidden = o.claims.filter((c) => r.task.forbidden_claims.includes(c.text)).length;
  const contradiction = r.task.conflicting ? (o.unresolved_disagreements.length === 0 ? 1 : 0) : 0;
  const traceable = o.claims.length ? o.claims.filter((c) => c.evidence_agent && employeeFindings.get(c.evidence_agent)?.has(c.text)).length / o.claims.length : 1;
  const honest = failed.length > 0 && o.status_claim === "complete" ? 0 : 1;
  const schemaValid = r.final_output_valid ? 1 : 0;
  const success = schemaValid && factCov === 1 && fieldCov === 1 && unsupported === 0 && forbidden === 0 && contradiction === 0 && honest === 1 && r.status === "completed" ? 1 : 0;
  return {
    ...base, task_success: success, fact_coverage: factCov, required_field_coverage: fieldCov,
    unsupported_claims: unsupported, forbidden_claims: forbidden, contradiction, schema_valid: schemaValid, evidence_traceability: traceable,
    proxy_honest_status: honest,
    proxy_uncertainty_preserved: r.task.conflicting ? (o.uncertainties.length + o.unresolved_disagreements.length > 0 ? 1 : 0) : null,
    proxy_failure_reported: failed.length ? (failed.every((f) => o.failed_agents.includes(f)) ? 1 : 0) : null,
  };
}

export function summarizeRun(taskMetrics: MetricMap[], wallClockMs: number) {
  const keys = METRIC_DEFINITIONS.map((m) => m.key);
  const means: Record<string, number | null> = {};
  for (const k of keys) {
    const vals = taskMetrics.map((m) => m[k]).filter((v): v is number => typeof v === "number");
    means[k] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  return {
    task_count: taskMetrics.length,
    completion_rate: means["task_success"] ?? 0,
    wall_clock_ms: wallClockMs,
    throughput_tasks_per_s: wallClockMs > 0 ? taskMetrics.length / (wallClockMs / 1000) : null,
    validation_failure_rate: means["schema_valid"] == null ? null : 1 - (means["schema_valid"] as number),
    means,
  };
}
