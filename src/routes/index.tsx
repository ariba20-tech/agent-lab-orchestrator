import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Agent Reliability & Alignment Research Lab" },
      { name: "description", content: "Measure scaling, coordination overhead and reliability of manager–employee LLM agent systems." },
      { property: "og:title", content: "Agent Reliability & Alignment Research Lab" },
      { property: "og:description", content: "Measure scaling, coordination overhead and reliability of manager–employee LLM agent systems." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center text-foreground">
      <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Research platform</div>
      <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight">Agent Reliability & Alignment Research Lab</h1>
      <p className="mt-4 max-w-xl text-muted-foreground">
        Run controlled manager–employee multi-agent experiments, trace every step, and measure scaling,
        coordination overhead and output reliability — honestly.
      </p>
      <div className="mt-8 flex gap-3">
        <Button asChild><Link to="/overview">Open the lab</Link></Button>
        <Button asChild variant="outline"><Link to="/auth">Sign in</Link></Button>
      </div>
      <p className="mt-10 max-w-md text-xs text-muted-foreground">
        Current provider: deterministic mock. Results are about the orchestration system, not real model behaviour.
      </p>
    </div>
  );
}
