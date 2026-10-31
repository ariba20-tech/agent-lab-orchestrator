import { z } from "zod";

export const COORDINATION = ["sequential", "parallel_central", "parallel_structured", "parallel_verify"] as const;
export const AGGREGATION = ["concat_summarize", "structured_schema", "parallel_groups", "verification_pass"] as const;
export const CATEGORIES = [
  "scaling", "coordination_overhead", "output_reliability", "behavioural_consistency",
  "aggregation_strategy", "verification_intervention", "model_comparison",
] as const;

export const COORDINATION_LABEL: Record<(typeof COORDINATION)[number], string> = {
  sequential: "Sequential execution",
  parallel_central: "Parallel + central aggregation",
  parallel_structured: "Parallel + structured aggregation",
  parallel_verify: "Parallel + verification",
};
export const AGGREGATION_LABEL: Record<(typeof AGGREGATION)[number], string> = {
  concat_summarize: "Concatenate and summarize",
  structured_schema: "Structured schema-based",
  parallel_groups: "Parallel aggregation of result groups",
  verification_pass: "Aggregation + verification pass",
};
export const CATEGORY_LABEL: Record<(typeof CATEGORIES)[number], string> = {
  scaling: "Scaling experiment",
  coordination_overhead: "Coordination overhead",
  output_reliability: "Output reliability",
  behavioural_consistency: "Behavioural consistency",
  aggregation_strategy: "Aggregation strategy",
  verification_intervention: "Verification intervention",
  model_comparison: "Controlled model comparison",
};

const rate = z.number().min(0).max(1);

export const MockSettingsSchema = z.object({
  employeeBaseDelayMs: z.number().int().min(0).max(2000).default(40),
  complexityDelayMs: z.number().int().min(0).max(2000).default(30),
  managerBaseDelayMs: z.number().int().min(0).max(2000).default(30),
  managerPerInputDelayMs: z.number().int().min(0).max(500).default(15),
  modelFailureRate: rate.default(0),
  timeoutRate: rate.default(0),
  invalidJsonRate: rate.default(0),
  toolFailureRate: rate.default(0),
  employeeOmissionRate: rate.default(0),
  managerOmissionRate: rate.default(0.1),
  /** Extra omission probability per additional employee input the manager must merge (0 = load-independent). */
  managerOmissionLoadFactor: z.number().min(0).max(1).default(0),
  unsupportedClaimRate: rate.default(0.05),
  falseConsensusRate: rate.default(0.5),
});

export const ExperimentConfigSchema = z.object({
  mode: z.enum(["single", "sweep"]).default("single"),
  agentCounts: z.array(z.number().int().min(1).max(16)).min(1).max(8),
  taskCount: z.number().int().min(1).max(100),
  complexity: z.enum(["low", "medium", "high"]),
  coordination: z.enum(COORDINATION),
  aggregation: z.enum(AGGREGATION),
  repetitions: z.number().int().min(1).max(10),
  model: z.object({
    provider: z.literal("mock"),
    model: z.string().min(1).max(100),
    temperature: z.number().min(0).max(2),
    maxOutputTokens: z.number().int().min(16).max(32000),
    timeoutMs: z.number().int().min(10).max(60000),
    retryLimit: z.number().int().min(0).max(5),
    seed: z.number().int().nullable(),
  }),
  controlled: z.object({
    datasetVersion: z.string().max(50),
    promptVersion: z.string().max(50),
    modelVersion: z.string().max(50),
    randomSeed: z.number().int(),
    maxContextTokens: z.number().int().min(256).max(2_000_000),
    toolConfig: z.string().max(200),
    concurrencyLimit: z.number().int().min(1).max(16),
  }),
  mock: MockSettingsSchema,
});
export type ExperimentConfig = z.infer<typeof ExperimentConfigSchema>;
export type MockSettings = z.infer<typeof MockSettingsSchema>;

/** Hard cap so a single synchronous request stays well within worker limits. */
export const MAX_TASK_EXECUTIONS = 200;
export function totalTaskExecutions(c: Pick<ExperimentConfig, "agentCounts" | "taskCount" | "repetitions">) {
  return c.agentCounts.length * c.taskCount * c.repetitions;
}

export interface BenchmarkTask {
  task_key: string;
  description: string;
  complexity: string;
  required_fields: string[];
  reference_facts: string[];
  forbidden_claims: string[];
  conflicting: boolean;
}

export const EmployeeOutputSchema = z.object({
  task_id: z.string(),
  agent_id: z.string(),
  status: z.enum(["success", "failed"]),
  findings: z.array(z.string()),
  fields: z.record(z.string()),
  evidence: z.array(z.object({ claim: z.string(), source: z.string() })),
  uncertainties: z.array(z.string()),
  warnings: z.array(z.string()),
  error_details: z.string().nullable(),
  generated_by: z.string(),
});
export type EmployeeOutput = z.infer<typeof EmployeeOutputSchema>;

export const FinalOutputSchema = z.object({
  task_id: z.string(),
  status_claim: z.enum(["complete", "partial", "failed"]),
  facts_reported: z.array(z.string()),
  fields: z.record(z.string()),
  claims: z.array(z.object({ text: z.string(), evidence_agent: z.string().nullable() })),
  uncertainties: z.array(z.string()),
  unresolved_disagreements: z.array(z.string()),
  missing_fields: z.array(z.string()),
  failed_agents: z.array(z.string()),
  verification: z.object({ performed: z.boolean(), restored_facts: z.number(), removed_claims: z.number() }),
  generated_by: z.string(),
});
export type FinalOutput = z.infer<typeof FinalOutputSchema>;

export interface SpanRecord {
  span_id: string;
  parent_span_id: string | null;
  operation_name: string;
  start_time: string;
  end_time: string;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  status: "ok" | "error";
  attributes: Record<string, unknown>;
  events: { name: string; time: string; attributes?: Record<string, unknown> }[];
  agent_key?: string;
  task_key?: string;
}

export interface AgentRecord {
  agent_id: string;
  parent_agent_id: string | null;
  role: "manager" | "employee";
  assigned_task: string;
  status: "success" | "failed" | "timeout" | "missing";
  attempts: number;
  started_at: string;
  completed_at: string;
  output: EmployeeOutput | null;
  error_category: string | null;
}

export interface TaskTimings {
  e2e_ms: number;
  planning_ms: number;
  employee_phase_ms: number;
  employee_mean_ms: number;
  wait_after_first_result_ms: number;
  collection_ms: number;
  aggregation_ms: number;
  aggregation_model_ms: number;
  verification_ms: number;
  validation_ms: number;
  model_requests: number;
  retries: number;
  est_tokens: number;
  timeouts: number;
  tool_failures: number;
  schema_failures: number;
  employee_failures: number;
}

export interface TaskResult {
  task: BenchmarkTask;
  status: "completed" | "failed";
  started_at: string;
  completed_at: string;
  agents: AgentRecord[];
  final_output: FinalOutput | null;
  final_output_valid: boolean;
  timings: TaskTimings;
  error: string | null;
}
