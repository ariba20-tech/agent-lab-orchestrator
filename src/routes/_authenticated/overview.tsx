import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProject } from "@/lib/use-project";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/overview")({
  head: () => ({ meta: [{ title: "Overview — Agent Reliability Lab" }, { name: "description", content: "Project overview of experiments and runs." }] }),
  component: Overview,
});

function Overview() {
  const { project } = useCurrentProject();
  const { data } = useQuery({
    queryKey: ["overview", project?.id],
    enabled: !!project,
    queryFn: async () => {
      const { data: defs } = await supabase.from("experiment_definitions").select("id").eq("project_id", project!.id);
      const ids = (defs ?? []).map((d) => d.id);
      const { data: runs } = ids.length
        ? await supabase.from("experiment_runs").select("id,status,summary_json,sweep_label,created_at").in("experiment_definition_id", ids).order("created_at", { ascending: false })
        : { data: [] };
      const { count: datasets } = await supabase.from("datasets").select("id", { count: "exact", head: true }).eq("project_id", project!.id);
      return { experiments: ids.length, runs: runs ?? [], datasets: datasets ?? 0 };
    },
  });
  const runs = data?.runs ?? [];
  const completed = runs.filter((r) => r.status === "completed");
  const avgSuccess = completed.length
    ? completed.reduce((a, r) => a + ((r.summary_json as { completion_rate?: number })?.completion_rate ?? 0), 0) / completed.length
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{project?.name}</h1>
        <p className="text-sm text-muted-foreground">Project overview</p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Datasets" value={data?.datasets ?? "—"} />
        <Stat label="Experiments" value={data?.experiments ?? "—"} />
        <Stat label="Runs" value={runs.length} />
        <Stat label="Mean task success" value={avgSuccess == null ? "—" : `${(avgSuccess * 100).toFixed(1)}%`} />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent runs</CardTitle>
          <Button asChild size="sm"><Link to="/studio">New experiment</Link></Button>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet. Create an experiment in the Studio.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {runs.slice(0, 8).map((r) => (
                <li key={r.id} className="flex justify-between py-2">
                  <Link to="/runs/$runId" params={{ runId: r.id }} className="font-mono hover:underline">{r.id.slice(0, 8)} · {r.sweep_label}</Link>
                  <span className="text-muted-foreground">{r.status}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 font-mono text-2xl">{value}</div>
      </CardContent>
    </Card>
  );
}
