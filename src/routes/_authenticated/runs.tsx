import { createFileRoute, Link, Outlet, useMatch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProject } from "@/lib/use-project";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/runs")({
  head: () => ({ meta: [{ title: "Runs — Agent Reliability Lab" }, { name: "description", content: "All experiment runs with summary metrics." }, { property: "og:title", content: "Runs — Agent Reliability Lab" }, { property: "og:description", content: "All experiment runs with summary metrics." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Runs,
});

type Summary = { completion_rate?: number; wall_clock_ms?: number; failed_tasks?: number; task_count?: number };

function Runs() {
  const child = useMatch({ from: "/_authenticated/runs/$runId", shouldThrow: false });
  const { project } = useCurrentProject();
  const { data: runs = [] } = useQuery({
    queryKey: ["runs", project?.id],
    enabled: !!project && !child,
    queryFn: async () => {
      const { data } = await supabase
        .from("experiment_runs")
        .select("id,status,sweep_label,trial_index,summary_json,error_summary,created_at,experiment_definitions!inner(name,project_id)")
        .eq("experiment_definitions.project_id", project!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });
  if (child) return <Outlet />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Runs</h1>
      {runs.length === 0 ? <p className="text-sm text-muted-foreground">No runs yet.</p> : (
        <Table>
          <TableHeader><TableRow>
            <TableHead>Run</TableHead><TableHead>Experiment</TableHead><TableHead>Config</TableHead><TableHead>Status</TableHead>
            <TableHead className="text-right">Success</TableHead><TableHead className="text-right">Wall clock</TableHead><TableHead>Notes</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {runs.map((r) => {
              const s = (r.summary_json ?? {}) as Summary;
              return (
                <TableRow key={r.id}>
                  <TableCell><Link to="/runs/$runId" params={{ runId: r.id }} className="font-mono hover:underline">{r.id.slice(0, 8)}</Link></TableCell>
                  <TableCell>{r.experiment_definitions?.name}</TableCell>
                  <TableCell className="font-mono text-xs">{r.sweep_label} · t{r.trial_index}</TableCell>
                  <TableCell>{r.status}</TableCell>
                  <TableCell className="text-right font-mono">{s.completion_rate == null ? "—" : `${(s.completion_rate * 100).toFixed(0)}%`}</TableCell>
                  <TableCell className="text-right font-mono">{s.wall_clock_ms == null ? "—" : `${Math.round(s.wall_clock_ms)} ms`}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.error_summary}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
