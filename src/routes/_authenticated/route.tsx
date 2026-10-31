import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProject } from "@/lib/use-project";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: Shell,
});

const NAV = [
  { to: "/overview", label: "Overview" },
  { to: "/studio", label: "Experiment Studio" },
  { to: "/runs", label: "Runs & Traces" },
  { to: "/scaling", label: "Scaling Analysis" },
  { to: "/settings", label: "Settings" },
] as const;

function Shell() {
  const { project, projects, select } = useCurrentProject();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [newName, setNewName] = useState("");

  async function createProject() {
    if (!newName.trim()) return;
    const { data, error } = await supabase.from("projects").insert({ name: newName.trim() }).select("id").single();
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["projects"] });
    select(data.id);
    setNewName("");
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card p-4">
        <div className="mb-6">
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">ARA Lab</div>
          <div className="text-sm font-semibold">Agent Reliability & Alignment</div>
        </div>
        <label className="mb-1 text-xs text-muted-foreground">Project</label>
        <Select value={project?.id ?? ""} onValueChange={select}>
          <SelectTrigger><SelectValue placeholder="Loading…" /></SelectTrigger>
          <SelectContent>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="mt-2 flex gap-1">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New project" className="h-8 text-xs" />
          <Button size="sm" variant="secondary" onClick={createProject}>+</Button>
        </div>
        <nav className="mt-6 flex flex-col gap-1">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground" activeProps={{ className: "bg-accent text-foreground" }}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto">
          <Button variant="ghost" size="sm" className="w-full" onClick={signOut}>Sign out</Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-8">
        {project ? <Outlet /> : <p className="text-muted-foreground">Loading project…</p>}
      </main>
    </div>
  );
}
