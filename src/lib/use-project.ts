import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const KEY = "lab.projectId";
export const DEFAULT_PROJECT_NAME = "Multi Agent";

/** Loads the signed-in user's projects, creating the default "Multi Agent" project on first use. */
export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at");
      if (error) throw error;
      if (data.length) return data;
      const { data: created, error: e2 } = await supabase
        .from("projects")
        .insert({ name: DEFAULT_PROJECT_NAME, description: "Default research project" })
        .select("*");
      if (e2) throw e2;
      return created;
    },
  });
}

export function useCurrentProject() {
  const { data: projects = [], isLoading } = useProjects();
  const [id, setId] = useState<string | null>(null);
  const qc = useQueryClient();
  useEffect(() => {
    setId(localStorage.getItem(KEY));
  }, []);
  const project = projects.find((p) => p.id === id) ?? projects[0] ?? null;
  return {
    project,
    projects,
    isLoading,
    select: (pid: string) => {
      localStorage.setItem(KEY, pid);
      setId(pid);
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "projects" });
    },
  };
}
