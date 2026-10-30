import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProject } from "@/lib/use-project";
import { executeExperiment, installDemoDataset } from "@/lib/lab.functions";
import {
  AGGREGATION, AGGREGATION_LABEL, CATEGORIES, CATEGORY_LABEL, COORDINATION, COORDINATION_LABEL,
  ExperimentConfigSchema, MAX_TASK_EXECUTIONS, MockSettingsSchema, totalTaskExecutions,
} from "@/lib/engine/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/studio")({
  head: () => ({ meta: [{ title: "Experiment Studio — Agent Reliability Lab" }, { name: "description", content: "Design and run multi-agent experiments." }] }),
  component: Studio,
});

function Studio() {
  const { project } = useCurrentProject();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const install = useServerFn(installDemoDataset);
  const execute = useServerFn(executeExperiment);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("Scaling sweep 1");
  const [hypothesis, setHypothesis] = useState("Adding employees reduces task success due to aggregation omissions.");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("scaling");
  const [datasetId, setDatasetId] = useState("");
  const [agentCounts, setAgentCounts] = useState("1,2,4,8");
  const [taskCount, setTaskCount] = useState(5);
  const [repetitions, setRepetitions] = useState(3);
  const [complexity, setComplexity] = useState<"low" | "medium" | "high">("medium");
  const [coordination, setCoordination] = useState<(typeof COORDINATION)[number]>("parallel_central");
  const [aggregation, setAggregation] = useState<(typeof AGGREGATION)[number]>("concat_summarize");
  const [seed, setSeed] = useState(42);
  const [mock, setMock] = useState(MockSettingsSchema.parse({}));

  const { data: datasets = [] } = useQuery({
    queryKey: ["datasets", project?.id],
    enabled: !!project,
    queryFn: async () => (await supabase.from("datasets").select("id,name,version").eq("project_id", project!.id)).data ?? [],
  });

  const counts = agentCounts.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => n > 0);
  const total = totalTaskExecutions({ agentCounts: counts, taskCount, repetitions });

  async function addDemo() {
    try {
      const r = await install({ data: { projectId: project!.id } });
      await qc.invalidateQueries({ queryKey: ["datasets"] });
      setDatasetId(r.datasetId);
      toast.success(r.created ? "Demo dataset installed" : "Demo dataset already installed");
    } catch (e) { toast.error((e as Error).message); }
  }

  async function run() {
    const ds = datasets.find((d) => d.id === datasetId);
    if (!ds) return toast.error("Choose a dataset first");
    const parsed = ExperimentConfigSchema.safeParse({
      mode: counts.length > 1 ? "sweep" : "single", agentCounts: counts, taskCount, complexity, coordination, aggregation, repetitions,
      model: { provider: "mock", model: "mock-deterministic", temperature: 0, maxOutputTokens: 1024, timeoutMs: 5000, retryLimit: 1, seed },
      controlled: { datasetVersion: ds.version, promptVersion: "p1", modelVersion: "mock-v1", randomSeed: seed, maxContextTokens: 8192, toolConfig: "none", concurrencyLimit: 8 },
      mock,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Invalid configuration");
    setBusy(true);
    try {
      const { data: def, error } = await supabase.from("experiment_definitions").insert({
        project_id: project!.id, name, hypothesis, category, configuration_json: parsed.data, dataset_id: ds.id, dataset_version: ds.version,
      }).select("id").single();
      if (error) throw error;
      const r = await execute({ data: { definitionId: def.id } });
      toast.success(`${r.runIds.length} run(s) finished`);
      qc.invalidateQueries();
      navigate({ to: "/runs" });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  const rateKeys = Object.keys(mock).filter((k) => k.endsWith("Rate")) as (keyof typeof mock)[];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Experiment Studio</h1>
        <p className="text-sm text-muted-foreground">Provider: deterministic mock. Every configuration is snapshotted with each run.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Definition</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Category">
            <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="md:col-span-2"><Field label="Hypothesis"><Textarea value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} /></Field></div>
          <Field label="Dataset">
            <div className="flex gap-2">
              <Select value={datasetId} onValueChange={setDatasetId}>
                <SelectTrigger><SelectValue placeholder="Choose dataset" /></SelectTrigger>
                <SelectContent>{datasets.map((d) => <SelectItem key={d.id} value={d.id}>{d.name} ({d.version})</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="secondary" onClick={addDemo}>Install demo</Button>
            </div>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Topology</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="Employee counts (comma list)"><Input value={agentCounts} onChange={(e) => setAgentCounts(e.target.value)} /></Field>
          <Field label="Tasks per run"><Input type="number" value={taskCount} onChange={(e) => setTaskCount(+e.target.value)} /></Field>
          <Field label="Repetitions"><Input type="number" value={repetitions} onChange={(e) => setRepetitions(+e.target.value)} /></Field>
          <Field label="Complexity">
            <Select value={complexity} onValueChange={(v) => setComplexity(v as typeof complexity)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["low", "medium", "high"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Coordination">
            <Select value={coordination} onValueChange={(v) => setCoordination(v as typeof coordination)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{COORDINATION.map((c) => <SelectItem key={c} value={c}>{COORDINATION_LABEL[c]}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Aggregation">
            <Select value={aggregation} onValueChange={(v) => setAggregation(v as typeof aggregation)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{AGGREGATION.map((c) => <SelectItem key={c} value={c}>{AGGREGATION_LABEL[c]}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Random seed"><Input type="number" value={seed} onChange={(e) => setSeed(+e.target.value)} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Mock failure injection (0–1)</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          {rateKeys.map((k) => (
            <Field key={k} label={k.replace(/Rate$/, "").replace(/([A-Z])/g, " $1")}>
              <Input type="number" step="0.05" min={0} max={1} value={mock[k]} onChange={(e) => setMock({ ...mock, [k]: +e.target.value })} />
            </Field>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button onClick={run} disabled={busy || total > MAX_TASK_EXECUTIONS}>{busy ? "Running…" : "Save & run"}</Button>
        <span className={`font-mono text-sm ${total > MAX_TASK_EXECUTIONS ? "text-destructive" : "text-muted-foreground"}`}>
          {total} task executions (max {MAX_TASK_EXECUTIONS})
        </span>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs capitalize text-muted-foreground">{label}</Label>{children}</div>;
}
