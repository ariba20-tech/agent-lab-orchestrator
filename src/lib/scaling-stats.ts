import { ci95, ci95Bounded, mean } from "./stats";

/** Trials are the sampling unit: do not pool repeated benchmark tasks as independent observations. */
export function summarizeScalingMetric(metric: string, values: number[]) {
  const finite = values.filter(Number.isFinite);
  const bounded = metric === "task_success" || metric === "fact_coverage";
  return {
    mean: mean(finite),
    ci: bounded ? ci95Bounded(finite, 0, 1) : ci95(finite),
    n: finite.length,
  };
}