import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { METRIC_DEFINITIONS } from "@/lib/engine/evaluator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/runs/$runId")({
  head: () => ({ meta: [{ title: "Run detail — Agent Reliability Lab" }, { name: "description", content: "Trace timeline and evaluation metrics for a run." }, { property: "og:title", content: "Run detail — Agent Reliability Lab" }, { property: "og:description", content: "Trace timeline and evaluation metrics for a run." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: RunDetail,
});

function RunDetail() {
  const { runId } = Route.useParams();
  const { data } = useQuery({
    queryKey: ["run", runId],
    queryFn: async () => {
      const [run, tasks, spans] = await Promise.all([
        supabase.from("experiment_runs").select("*").eq("id", runId).single(),
        supabase.from("task_runs").select("id,task_id,status,metrics_json,final_output").eq("experiment_run_id", runId).order("task_id"),
        supabase.from("trace_spans").select("id,span_id,parent_span_id,task_run_id,operation_name,duration_ms,status,attributes_json").eq("experiment_run_id", runId).order("start_time").limit(2000),
      ]);
      return { run: run.data, tasks: tasks.data ?? [], spans: spans.data ?? [] };
    },
  });
  const [taskSel, setTaskSel] = useState<string | null>(null);
  if (!data?.run) return <p className="text-muted-foreground">Loading…</p>;
  const { run, tasks, spans } = data;
  const summary = (run.summary_json ?? {}) as { means?: Record<string, number | null> };
  const selected = taskSel ?? tasks[0]?.id ?? null;
  const taskSpans = spans.filter((s) => s.task_run_id === selected);
  const maxEnd = Math.max(1, ...taskSpans.map((s) => ((s.attributes_json as { start_offset_ms?: number })?.start_offset_ms ?? 0) + s.duration_ms));
  const minStart = Math.min(...taskSpans.map((s) => (s.attributes_json as { start_offset_ms?: number })?.start_offset_ms ?? 0));

  function exportJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `run-${runId}.json`;
    a.click();
  }
  function exportCsv() {
    const keys = METRIC_DEFINITIONS.map((m) => m.key);
    const rows = [["task_id", "status", ...keys].join(","), ...tasks.map((t) => {
      const m = (t.metrics_json ?? {}) as Record<string, unknown>;
      return [t.task_id, t.status, ...keys.map((k) => m[k] ?? "")].join(",");
    })];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
    a.download = `run-${runId}.csv`;
    a.click();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/runs" className="text-xs text-muted-foreground hover:underline">← Runs</Link>
          <h1 className="font-mono text-xl">{run.id.slice(0, 8)} · {run.sweep_label} · trial {run.trial_index}</h1>
          <p className="text-sm text-muted-foreground">{run.status} · provider {run.provider} · trace {run.trace_id}</p>
          {run.error_summary && <p className="text-sm text-destructive">{run.error_summary}</p>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={exportCsv}>CSV</Button>
          <Button size="sm" variant="secondary" onClick={exportJson}>JSON</Button>
        </div>
      </div>

      <Tabs defaultValue="metrics">
        <TabsList><TabsTrigger value="metrics">Evaluation</TabsTrigger><TabsTrigger value="trace">Trace</TabsTrigger><TabsTrigger value="config">Config snapshot</TabsTrigger></TabsList>
        <TabsContent value="metrics">
          <div className="grid gap-3 md:grid-cols-3">
            {METRIC_DEFINITIONS.map((m) => {
              const v = summary.means?.[m.key];
              return (
                <Card key={m.key} title={m.definition}>
                  <CardContent className="pt-4">
                    <div className="text-xs text-muted-foreground">{m.label}{m.group === "proxy" && " (proxy)"}</div>
                    <div className="font-mono text-lg">{v == null ? "N/A" : m.unit === "ms" ? `${v.toFixed(1)} ms` : v.toFixed(3)}</div>
                    <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{m.definition}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="trace">
          <div className="flex gap-4">
            <div className="w-40 shrink-0 space-y-1">
              {tasks.map((t) => (
                <button key={t.id} onClick={() => setTaskSel(t.id)} className={`block w-full rounded px-2 py-1 text-left font-mono text-xs ${selected === t.id ? "bg-accent" : "hover:bg-accent/50"}`}>
                  {t.task_id} <span className="text-muted-foreground">{t.status}</span>
                </button>
              ))}
            </div>
            <Card className="flex-1"><CardHeader><CardTitle className="text-sm">Span timeline</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {taskSpans.map((s) => {
                  const start = ((s.attributes_json as { start_offset_ms?: number })?.start_offset_ms ?? 0) - minStart;
                  const span = maxEnd - minStart || 1;
                  return (
                    <div key={s.id} className="flex items-center gap-2 text-xs">
                      <div className="w-48 shrink-0 truncate font-mono">{s.operation_name}</div>
                      <div className="relative h-4 flex-1 rounded bg-muted">
                        <div className={`absolute h-4 rounded ${s.status === "error" ? "bg-destructive" : "bg-primary"}`} style={{ left: `${(start / span) * 100}%`, width: `${Math.max(0.5, (s.duration_ms / span) * 100)}%` }} />
                      </div>
                      <div className="w-16 text-right font-mono">{s.duration_ms.toFixed(0)}ms</div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="config">
          <pre className="overflow-auto rounded-md bg-muted p-4 font-mono text-xs">{JSON.stringify(run.configuration_snapshot, null, 2)}</pre>
        </TabsContent>
      </Tabs>
    </div>
  );
}
