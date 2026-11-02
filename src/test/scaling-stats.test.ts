import { describe, expect, it } from "vitest";
import { summarizeScalingMetric } from "@/lib/scaling-stats";

describe("scaling uncertainty", () => {
  it("keeps task success uncertainty in the valid 0–1 range", () => {
    expect(summarizeScalingMetric("task_success", [1, 1, 0]).ci).toEqual([0, 1]);
  });
  it("keeps reference fact coverage uncertainty in the valid 0–1 range", () => {
    expect(summarizeScalingMetric("fact_coverage", [1, 0, 0]).ci).toEqual([0, 1]);
  });
  it("requires at least three trials for a confidence interval", () => {
    expect(summarizeScalingMetric("task_success", [0, 1]).ci).toBeNull();
    expect(summarizeScalingMetric("task_success", [0, 1, 1]).ci).not.toBeNull();
  });
  it("does not cap latency at one", () => {
    const result = summarizeScalingMetric("e2e_ms", [100, 110, 120]);
    expect(result.mean).toBe(110);
    expect(result.ci?.[0]).toBeGreaterThan(1);
    expect(result.ci?.[1]).toBeGreaterThan(120);
  });
});