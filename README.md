# Manager–Employee Multi-Agent System

## Agent Reliability & Alignment Research Lab

A research application for controlled manager–employee multi-agent experiments. It measures execution efficiency, coordination overhead, output reliability, and failure modes across task complexity, employee counts, and aggregation strategies.

**Current scope:** Phase 1 and a deterministic mock-provider vertical slice. Simulated outputs are not evidence of real LLM behaviour or alignment. This project does not train a foundation model.

## Implemented

- Email/password authentication and private, project-scoped records in Lovable Cloud.
- Experiment Studio with single configurations and employee-count sweeps.
- Sequential execution, parallel central aggregation, structured aggregation, and verification interventions in the orchestration engine.
- Synthetic benchmark tasks covering independent research, synthesis, requirement-heavy planning, conflicting evidence, and increasing workload.
- Seeded mock failure injection for omissions, unsupported claims, model failures, timeouts, invalid JSON, and tool failures.
- Persisted runs, task outputs, employee records, configuration snapshots, evaluations, and parent–child trace spans.
- Run detail with evaluation metrics, task trace timelines, and CSV/JSON downloads.
- Scaling analysis with trial-level means, approximate 95% confidence intervals, and descriptive OLS slopes.

## Technology

- **Application:** TanStack Start, TanStack Router, React 19, TypeScript, Vite.
- **UI:** Tailwind CSS v4 and shadcn/ui components.
- **Data and authentication:** Lovable Cloud with PostgreSQL and row-level access policies.
- **Execution:** TypeScript orchestration inside authenticated TanStack server functions.
- **Tests:** Vitest.

This implementation uses the Lovable runtime rather than Python/FastAPI or a separate Docker worker. Trace records are OpenTelemetry-shaped; they are not currently exported to Phoenix or an OTLP collector.

## Local development

Use Bun and an existing configured backend. Install the dependencies, supply browser configuration through your local environment, and start the app:

```sh
bun install
bun run dev
```

Required browser environment variable names:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
```

These use the underlying backend SDK's naming. Do not commit private credentials, passwords, service-role keys, or local environment files. Lovable manages configuration in the hosted project. A standalone deployment also requires its own backend configuration and application schema; the source repository alone does not include live database records or user accounts.

Tests and production compilation:

```sh
bun run test
bun run build
```

## Research workflow

1. Sign up, confirm your email, and sign in.
2. Select the **Multi Agent** project or create another project.
3. Open **Experiment Studio** and install the synthetic demo dataset.
4. Choose the dataset, employee counts, task count, repetitions, coordination, aggregation, and seed.
5. Set mock failure probabilities and optionally a manager omission load factor.
6. Select **Save & run**, then inspect individual runs and the scaling analysis.

## Measurement and reproducibility

- Configuration and dataset versions are saved with each run. Mock outputs use deterministic seeded randomness; wall-clock timings can vary between executions.
- Task success requires valid output, complete reference facts and required fields, no unsupported or forbidden claims, preserved disagreements where required, and honest status reporting.
- Behavioural metrics are operational proxies, not proof of model alignment.
- Scaling confidence intervals use trial-level observations, not pooled repeated tasks. At least three valid trials are required. Task-success and fact-coverage intervals are clipped to their valid 0–1 range.
- Slopes are descriptive, not causal. Token usage is a mock estimate, not provider-reported usage.
- Execution is synchronous and capped at **200 task executions** per experiment request. Employee count is limited to **1–16**, tasks per run to **1–100**, and repetitions to **1–10**.

## Source structure

```text
src/routes/                Pages, authentication, and shared navigation
src/lib/engine/            Orchestration, mock provider, validation, and tracing
src/lib/lab.functions.ts   Authenticated execution and persistence
src/lib/demo-dataset.ts    Synthetic reference benchmarks
src/lib/stats.ts           Statistical utilities
src/lib/scaling-stats.ts   Trial-level scaling summaries
src/test/                  Automated tests
supabase/                  Backend configuration and migration files, where present
roadmap.md                 Completed and remaining work
```

## Not yet implemented

- Real LLM provider execution and real model-behaviour benchmarks.
- Phoenix/OTLP export and background execution workers.
- Dedicated Interventions and Reports pages; traces and evaluations currently live within run detail.
- A Google sign-in button and verified social sign-in flow.

## GitHub transfer

Lovable Git sync creates a new private repository; it cannot attach to an existing repository such as `ariba20-tech/Manager-Employee-MultiAgent-System`.

To transfer this source manually, download it from **Project settings → Git → Download codebase** (paid plans), extract it, and copy the source into a local checkout of the existing repository. Preserve that repository’s `.git` directory, review the changes, and commit/push using your own GitHub access. Do not include dependency folders, generated build output, or private environment files. This transfers code only; database records and user accounts are separate.
