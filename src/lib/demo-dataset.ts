import type { BenchmarkTask } from "./engine/types";

/** DEMONSTRATION BENCHMARK — small, synthetic, for exploring the pipeline. Not a validated research benchmark. */
export const DEMO_DATASET_NAME = "Demonstration benchmark (synthetic)";
export const DEMO_DATASET_VERSION = "demo-1.0";

type T = BenchmarkTask & { rubric: string; template: string };

const A: T[] = [1, 2, 3, 4].map((i) => ({
  template: "A",
  task_key: `A-${i}`,
  description: `Independent research: compile findings on subsystem ${i} of a fictional battery recycling plant.`,
  complexity: i <= 2 ? "low" : "medium",
  required_fields: ["summary", "risks", "recommendation"],
  reference_facts: [`Subsystem ${i} throughput is ${i * 120} kg/h`, `Subsystem ${i} uses hydrometallurgy`, `Subsystem ${i} recovery rate is ${80 + i}%`, `Subsystem ${i} was commissioned in ${2015 + i}`],
  forbidden_claims: [`Subsystem ${i} has zero emissions`],
  conflicting: false,
  rubric: "All four reference facts present; all required fields present; no forbidden claim.",
}));
const B: T[] = [1, 2, 3].map((i) => ({
  template: "B",
  task_key: `B-${i}`,
  description: `Multi-source synthesis: merge findings from ${i + 2} fictional field reports on coastal erosion site ${i}.`,
  complexity: "medium",
  required_fields: ["synthesis", "sources_used", "gaps"],
  reference_facts: Array.from({ length: i + 4 }, (_, k) => `Site ${i} report ${k + 1}: shoreline retreat ${(k + 1) * 0.4} m/yr`),
  forbidden_claims: [`Site ${i} erosion has stopped`],
  conflicting: false,
  rubric: "No fact omitted; no contradictions between merged facts.",
}));
const C: T[] = [1, 2].map((i) => ({
  template: "C",
  task_key: `C-${i}`,
  description: `Requirement-heavy planning: produce a migration plan for fictional service ${i} satisfying all constraints.`,
  complexity: "high",
  required_fields: ["plan", "constraints_satisfied", "dependencies", "rollback", "owners"],
  reference_facts: [`Service ${i} must keep 99.9% availability`, `Service ${i} depends on queue Q${i}`, `Service ${i} data must stay in region EU`, `Service ${i} cutover window is Sunday 02:00`, `Service ${i} needs DBA sign-off`, `Service ${i} rollback must finish in 15 minutes`],
  forbidden_claims: [`Service ${i} has no dependencies`],
  conflicting: false,
  rubric: "Every mandatory requirement appears; all required fields present.",
}));
const D: T[] = [1, 2].map((i) => ({
  template: "D",
  task_key: `D-${i}`,
  description: `Conflicting evidence: sources disagree about the founding year of fictional town ${i}. Preserve uncertainty.`,
  complexity: "medium",
  required_fields: ["answer", "disagreements"],
  reference_facts: [`Source X says town ${i} was founded in 1820`, `Source Y says town ${i} was founded in 1835`, `Town ${i} charter is undated`],
  forbidden_claims: [`Town ${i} was definitively founded in 1820`],
  conflicting: true,
  rubric: "Must report the disagreement; must not assert consensus.",
}));
const E: T[] = [1, 2, 3].map((i) => ({
  template: "E",
  task_key: `E-${i}`,
  description: `Increasing workload level ${i}: summarise ${i * 6} fictional log events with dependencies.`,
  complexity: (["low", "medium", "high"] as const)[i - 1],
  required_fields: ["summary", "dependency_chain", "anomalies"].slice(0, i + 1),
  reference_facts: Array.from({ length: i * 6 }, (_, k) => `Event ${i}.${k + 1} depends on event ${i}.${Math.max(1, k)}`),
  forbidden_claims: [`All workload-${i} events are independent`],
  conflicting: false,
  rubric: "Coverage of all events; dependency chain field present.",
}));

export const DEMO_TASKS: T[] = [...A, ...B, ...C, ...D, ...E];
