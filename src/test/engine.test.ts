import { describe, expect, it } from "vitest";
import { executeRun, planAssignments, runPool } from "@/lib/engine/orchestrator";
import { evaluateTask } from "@/lib/engine/evaluator";
import { ExperimentConfigSchema, MockSettingsSchema, type ExperimentConfig } from "@/lib/engine/types";
import { DEMO_TASKS } from "@/lib/demo-dataset";
import { ci95, ols, percentile } from "@/lib/stats";

const base = (over: Partial<ExperimentConfig> = {}, mock: Partial<ExperimentConfig["mock"]> = {}): ExperimentConfig =>
  ExperimentConfigSchema.parse({
    mode: "single", agentCounts: [2], taskCount: 2, complexity: "low", coordination: "parallel_central", aggregation: "concat_summarize", repetitions: 1,
    model: { provider: "mock", model: "mock-1", temperature: 0, maxOutputTokens: 512, timeoutMs: 500, retryLimit: 0, seed: 7 },
    controlled: { datasetVersion: "demo", promptVersion: "p1", modelVersion: "m1", randomSeed: 7, maxContextTokens: 8000, toolConfig: "mock.lookup", concurrencyLimit: 4 },
    mock: MockSettingsSchema.parse({ employeeBaseDelayMs: 5, complexityDelayMs: 2, managerBaseDelayMs: 2, managerPerInputDelayMs: 1, managerOmissionRate: 0, unsupportedClaimRate: 0, ...mock }),
    ...over,
  });
const ids = { experimentId: "e", runId: "r" };
const task = DEMO_TASKS[0];

describe("config validation", () => {
  it("rejects more than 16 agents", () => {
    expect(() => base({ agentCounts: [17] })).toThrow();
  });
  it("rejects task count above 100", () => {
    expect(() => base({ taskCount: 101 })).toThrow();
  });
});

describe("routing", () => {
  it("splits facts round-robin across employees", () => {
    const a = planAssignments(task, 3);
    expect(a.map((x) => x.facts.length)).toEqual([2, 1, 1]);
  });
});

describe("concurrency", () => {
  it("never exceeds the concurrency limit", async () => {
    const { maxActive } = await runPool([1, 2, 3, 4, 5, 6], 2, () => new Promise((r) => setTimeout(r, 5)));
    expect(maxActive).toBe(2);
  });
});

describe("orchestration", () => {
  it("creates proper parent-child spans", async () => {
    const out = await executeRun([task], base(), 2, 0, ids);
    const byId = new Map(out.spans.map((s) => [s.span_id, s]));
    const emp = out.spans.filter((s) => s.operation_name === "employee.execute");
    expect(emp).toHaveLength(2);
    emp.forEach((s) => expect(byId.get(s.parent_span_id!)?.operation_name).toBe("manager.route"));
    const root = out.spans.find((s) => s.operation_name === "experiment.run")!;
    expect(root.parent_span_id).toBeNull();
  });
  it("is deterministic for the same seed", async () => {
    const a = await executeRun([task], base({}, { managerOmissionRate: 0.5 }), 2, 0, ids);
    const b = await executeRun([task], base({}, { managerOmissionRate: 0.5 }), 2, 0, ids);
    expect(a.tasks[0].final_output?.facts_reported).toEqual(b.tasks[0].final_output?.facts_reported);
  });
  it("records timeouts as failures, never success", async () => {
    const out = await executeRun([task], base({}, { timeoutRate: 1 }), 2, 0, ids);
    expect(out.tasks[0].agents.every((a) => a.status === "timeout")).toBe(true);
    expect(out.tasks[0].status).toBe("failed");
    expect(evaluateTask(out.tasks[0]).task_success).toBe(0);
  });
  it("retries up to the retry limit", async () => {
    const out = await executeRun([task], base({ model: { ...base().model, retryLimit: 2 } }, { modelFailureRate: 1 }), 1, 0, ids);
    expect(out.tasks[0].timings.retries).toBe(2);
    expect(out.tasks[0].timings.model_requests).toBe(4); // 3 employee attempts + 0 aggregation? aggregation still called once
  });
  it("detects invalid JSON as schema failure", async () => {
    const out = await executeRun([task], base({}, { invalidJsonRate: 1 }), 1, 0, ids);
    expect(out.tasks[0].timings.schema_failures).toBe(1);
  });
  it("aggregation duration grows with agent count", async () => {
    const cfg = base({}, { managerPerInputDelayMs: 10 });
    const t2 = (await executeRun([DEMO_TASKS[16]], cfg, 2, 0, ids)).tasks[0].timings.aggregation_ms;
    const t8 = (await executeRun([DEMO_TASKS[16]], cfg, 8, 0, ids)).tasks[0].timings.aggregation_ms;
    expect(t8).toBeGreaterThan(t2);
  });
  it("structured aggregation reports failed agents honestly", async () => {
    const out = await executeRun([task], base({ coordination: "parallel_structured" }, { modelFailureRate: 0.5 }), 4, 0, ids);
    const m = evaluateTask(out.tasks[0]);
    expect(m.proxy_honest_status).toBe(1);
  });
});

describe("stats", () => {
  it("omits CI below 3 samples", () => expect(ci95([1, 2])).toBeNull());
  it("computes OLS slope", () => expect(ols([1, 2, 3, 4], [2, 4, 6, 8])!.slope).toBeCloseTo(2));
  it("percentile interpolates", () => expect(percentile([0, 10], 50)).toBe(5));
});
