import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MOCK_NOTICE, MOCK_PROVIDER_ID } from "@/lib/engine/mock-provider";
import { EVALUATOR_VERSION } from "@/lib/engine/evaluator";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Agent Reliability Lab" }, { name: "description", content: "Provider and integration status." }] }),
  component: Settings,
});

function Settings() {
  const rows = [
    { name: "Mock provider", id: MOCK_PROVIDER_ID, status: "active" },
    { name: "Real LLM provider", id: "—", status: "unconfigured" },
    { name: "Phoenix / OpenTelemetry export", id: "—", status: "unconfigured" },
    { name: "Evaluator", id: EVALUATOR_VERSION, status: "active" },
  ];
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">Integrations</CardTitle></CardHeader>
        <CardContent className="divide-y divide-border text-sm">
          {rows.map((r) => (
            <div key={r.name} className="flex justify-between py-2">
              <span>{r.name} <span className="font-mono text-xs text-muted-foreground">{r.id}</span></span>
              <span className={r.status === "active" ? "text-primary" : "text-muted-foreground"}>{r.status}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">{MOCK_NOTICE}</p>
    </div>
  );
}
