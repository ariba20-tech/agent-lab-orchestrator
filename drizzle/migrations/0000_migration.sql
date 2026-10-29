
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, display_name text, created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email, display_name) values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  insert into public.projects(owner_id, name, description) values (new.id, 'Default research project', 'Created automatically on sign-up');
  return new;
end $$;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  name text not null, description text, created_at timestamptz not null default now()
);
create index on public.projects(owner_id);

create table public.datasets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null, version text not null default 'v1', template text not null default 'A',
  schema_json jsonb not null default '{}', source_type text not null default 'builtin',
  is_demo boolean not null default false, created_at timestamptz not null default now(),
  unique(project_id, name, version)
);
create index on public.datasets(project_id);

create table public.benchmark_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  task_key text not null, description text not null, complexity text not null default 'low',
  required_fields text[] not null default '{}', reference_facts text[] not null default '{}',
  forbidden_claims text[] not null default '{}', conflicting boolean not null default false,
  rubric text, created_at timestamptz not null default now(),
  unique(dataset_id, task_key)
);
create index on public.benchmark_tasks(dataset_id);

create table public.experiment_definitions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null, hypothesis text, description text, category text not null,
  tags text[] not null default '{}', notes text,
  configuration_json jsonb not null, dataset_id uuid references public.datasets(id) on delete set null,
  dataset_version text, created_at timestamptz not null default now()
);
create index on public.experiment_definitions(project_id, created_at desc);

create table public.experiment_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  experiment_definition_id uuid not null references public.experiment_definitions(id) on delete cascade,
  sweep_label text, trial_index int not null default 0,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','interrupted')),
  provider text not null, model_identifier text not null,
  configuration_snapshot jsonb not null, trace_id text,
  summary_json jsonb, started_at timestamptz, completed_at timestamptz, error_summary text,
  created_at timestamptz not null default now()
);
create index on public.experiment_runs(experiment_definition_id);
create index on public.experiment_runs(owner_id, created_at desc);

create table public.task_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  experiment_run_id uuid not null references public.experiment_runs(id) on delete cascade,
  task_id text not null, status text not null, started_at timestamptz, completed_at timestamptz,
  final_output jsonb, evaluation_status text not null default 'pending', metrics_json jsonb
);
create index on public.task_runs(experiment_run_id);

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  task_run_id uuid not null references public.task_runs(id) on delete cascade,
  experiment_run_id uuid not null references public.experiment_runs(id) on delete cascade,
  agent_id text not null, parent_agent_id text, role text not null, assigned_task text,
  status text not null, attempts int not null default 1, started_at timestamptz, completed_at timestamptz, output_json jsonb
);
create index on public.agent_runs(task_run_id);
create index on public.agent_runs(experiment_run_id);

create table public.trace_spans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  trace_id text not null, span_id text not null, parent_span_id text,
  experiment_run_id uuid not null references public.experiment_runs(id) on delete cascade,
  task_run_id uuid references public.task_runs(id) on delete cascade,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  operation_name text not null, start_time timestamptz not null, end_time timestamptz not null,
  duration_ms double precision not null, status text not null,
  attributes_json jsonb not null default '{}', events_json jsonb not null default '[]',
  unique(trace_id, span_id)
);
create index on public.trace_spans(experiment_run_id);
create index on public.trace_spans(trace_id);

create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  experiment_run_id uuid not null references public.experiment_runs(id) on delete cascade,
  task_run_id uuid references public.task_runs(id) on delete cascade,
  evaluator_type text not null, evaluator_version text not null,
  metric_name text not null, metric_value double precision, details_json jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.evaluations(experiment_run_id, metric_name);

create table public.experiment_artifacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  experiment_run_id uuid not null references public.experiment_runs(id) on delete cascade,
  artifact_type text not null, storage_path text, metadata_json jsonb not null default '{}',
  created_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['projects','datasets','benchmark_tasks','experiment_definitions','experiment_runs','task_runs','agent_runs','trace_spans','evaluations','experiment_artifacts'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "owner all" on public.%I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t);
  end loop;
end $$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
