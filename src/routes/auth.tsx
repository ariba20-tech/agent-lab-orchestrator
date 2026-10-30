import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Agent Reliability Lab" },
      { name: "description", content: "Sign in to run and analyse multi-agent reliability experiments." },
      { property: "og:title", content: "Sign in — Agent Reliability Lab" },
      { property: "og:description", content: "Sign in to run and analyse multi-agent reliability experiments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/overview` } });
    setBusy(false);
    if (res.error) return toast.error(res.error.message);
    if (mode === "up" && !res.data.session) return toast.success("Check your email to confirm your account.");
    navigate({ to: "/overview" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>{mode === "in" ? "Sign in" : "Create account"}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            <Button type="submit" disabled={busy}>{busy ? "…" : mode === "in" ? "Sign in" : "Sign up"}</Button>
          </form>
          <button className="mt-4 text-sm text-muted-foreground underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "No account? Sign up" : "Have an account? Sign in"}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
