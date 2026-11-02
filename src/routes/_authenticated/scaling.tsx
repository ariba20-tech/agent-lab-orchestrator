import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProject } from "@/lib/use-project";
import { ols } from "@/lib/stats";
import { summarizeScalingMetric } from "@/lib/scaling-stats";
import { METRIC_DEFINITIONS } from "@/lib/engine/evaluator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/scaling")({
  head: () => ({ meta: [{ title: "Scaling analysis — Agent Reliability Lab" }, { name: "description", content: "How metrics change with employee count, with confidence intervals." }, { property: "og:title", content: "Scaling analysis — Agent Reliability Lab" }, { property: "og:description", content: "How metrics change with employee count, with confidence intervals." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Scaling,
});

function Scaling() {
  const { project } = useCurrentProject();
  const [expId, setExpId] = useState("");
  const { data: defs = [] } = useQuery({
    queryKey: ["defs", project?.id],
    enabled: !!project,
    queryFn: async () => {
      if (!project) return [];
      const { data, error } = await supabase.from("experiment_definitions").select("id,name,created_at").eq("project_id", project.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const active = expId || defs[0]?.id || "";
  const { data: runs = [] } = useQuery({
    queryKey: ["scaling", active],
    enabled: !!active,
    queryFn: async () => (await supabase.from("experiment_runs").select("summary_json,status").eq("experiment_definition_id", active).eq("status", "completed")).data ?? [],
  });

  const metrics = ["task_success", "e2e_ms", "aggregation_ms", "wait_after_first_result_ms", "fact_coverage", "unsupported_claims"];
  const byN = new Map<number, Record<string, number | null>[]>();
  for (const r of runs) {
    const s = r.summary_json as { agent_count?: number; means?: Record<string, number | null> } | null;
    if (!s || typeof s.agent_count !== "number" || !s.means) continue;
    byN.set(s.agent_count, [...(byN.get(s.agent_count) ?? []), s.means]);
  }
  const ns = [...byN.keys()].sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Scaling analysis</h1>
      <Select value={active} onValueChange={setExpId}>
        <SelectTrigger className="w-full max-w-80"><SelectValue placeholder="Choose experiment" /></SelectTrigger>
        <SelectContent>{defs.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
      </Select>
      {ns.length === 0 ? <p className="text-sm text-muted-foreground">No completed runs for this experiment.</p> : (
        <>
          <Table>
            <TableHeader><TableRow><TableHead>Metric</TableHead>{ns.map((n) => <TableHead key={n} className="text-right">N={n} (trials {byN.get(n)?.length ?? 0})</TableHead>)}<TableHead className="text-right">OLS slope / employee</TableHead></TableRow></TableHeader>
            <TableBody>
              {metrics.map((k) => {
                const def = METRIC_DEFINITIONS.find((m) => m.key === k);
                const xs: number[] = [], ys: number[] = [];
                for (const n of ns) for (const m of byN.get(n) ?? []) {
                  const value = m[k];
                  if (typeof value === "number" && Number.isFinite(value)) { xs.push(n); ys.push(value); }
                }
                const fit = ols(xs, ys);
                return (
                  <TableRow key={k}>
                    <TableCell>{def?.label ?? k}{def?.unit ? ` (${def.unit})` : ""}</TableCell>
                    {ns.map((n) => {
                      const vals = (byN.get(n) ?? []).map((m) => m[k]).filter((v): v is number => typeof v === "number");
                      const summary = summarizeScalingMetric(k, vals);
                      return <TableCell key={n} className="text-right font-mono text-xs">{summary.n ? summary.mean.toFixed(3) : "N/A"}{summary.ci && <span className="text-muted-foreground"> [{summary.ci[0].toFixed(2)}, {summary.ci[1].toFixed(2)}]</span>}</TableCell>;
                    })}
                    <TableCell className="text-right font-mono text-xs">{fit ? fit.slope.toFixed(4) : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground">
            Means across trials; approximate 95% Student’s t intervals require at least 3 valid trials. Task success and fact coverage use fractions from 0 to 1, with intervals clipped to that range. Trials—not repeated benchmark tasks—are the sampling unit. OLS slopes are descriptive, not causal. Mock-provider results measure simulated orchestration, not real model behaviour.
          </p>
        </>
      )}
    </div>
  );
}
