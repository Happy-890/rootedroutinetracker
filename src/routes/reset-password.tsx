import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
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
  const navigate = useNavigate();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) setMsg(error.message);
    else navigate({ to: "/" });
  }
  return (
    <form onSubmit={submit} className="pt-safe mx-auto max-w-md space-y-3 px-5 py-16">
      <h1 className="text-2xl font-extrabold">Set a new password</h1>
      <Input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} className="h-11" aria-label="New password" />
      {msg && <p className="text-sm text-destructive">{msg}</p>}
      <Button type="submit" className="w-full">Save password</Button>
    </form>
  );
}
