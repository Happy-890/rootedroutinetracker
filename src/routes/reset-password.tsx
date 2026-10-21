import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Reset password — Rooted" },
      { name: "description", content: "Choose a new Rooted password." },
      { property: "og:title", content: "Reset password — Rooted" },
      { property: "og:description", content: "Choose a new Rooted password." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    if (new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery") {
      sessionStorage.setItem("rooted:recovery", "true");
      setRecovery(true);
    } else setRecovery(sessionStorage.getItem("rooted:recovery") === "true");
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        sessionStorage.setItem("rooted:recovery", "true");
        setRecovery(true);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!recovery || busy) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) setMsg(error.message);
    else { sessionStorage.removeItem("rooted:recovery"); navigate({ to: "/" }); }
  }
  return (
    <form onSubmit={submit} className="pt-safe mx-auto max-w-md space-y-3 px-5 py-16">
      <h1 className="text-2xl font-extrabold">Set a new password</h1>
      {!recovery && <p role="alert" className="text-sm text-muted-foreground">Open the reset link from your email to choose a new password.</p>}
      <Input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} className="h-11" aria-label="New password" />
      {msg && <p className="text-sm text-destructive">{msg}</p>}
      <Button type="submit" className="w-full" disabled={!recovery || busy}>{busy ? "Saving…" : "Save password"}</Button>
    </form>
  );
}
