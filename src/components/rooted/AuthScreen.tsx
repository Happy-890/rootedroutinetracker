import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRooted } from "@/lib/rooted/store";
import { lovable } from "@/integrations/lovable";

type View = "signin" | "signup" | "forgot";

export function AuthForm({ onDone }: { onDone?: () => void }) {
  const [view, setView] = useState<View>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function social(provider: "google" | "apple" | "lovable") {
    setBusy(true);
    setMsg(null);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
      if (result.error) throw result.error;
      if (!result.redirected) onDone?.();
    } catch (error) {
      setMsg({ ok: false, text: error instanceof Error ? error.message : "Couldn't sign in. Please try again." });
    } finally { setBusy(false); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (view === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onDone?.();
      } else if (view === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { display_name: name.trim() } },
        });
        if (error) throw error;
        if (!data.session) setMsg({ ok: true, text: "Check your email to confirm your account, then sign in." });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setMsg({ ok: true, text: "If that email has an account, a reset link is on its way." });
      }
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {view !== "forgot" && <div className="space-y-2">
        <Button type="button" variant="secondary" className="w-full" disabled={busy} onClick={() => void social("apple")}>Continue with Apple</Button>
        <Button type="button" variant="secondary" className="w-full" disabled={busy} onClick={() => void social("google")}>Continue with Google</Button>
        <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={() => void social("lovable")}>Sign in with Lovable</Button>
        <p className="text-center text-xs text-muted-foreground">or use email</p>
      </div>}
      {view === "signup" && (
        <div className="space-y-1">
          <Label htmlFor="name">Display name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="h-11" autoComplete="name" />
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" autoComplete="email" />
      </div>
      {view !== "forgot" && (
        <div className="space-y-1">
          <Label htmlFor="pw">Password</Label>
          <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" autoComplete={view === "signup" ? "new-password" : "current-password"} />
        </div>
      )}
      {msg && <p role="alert" className={msg.ok ? "text-sm text-teal" : "text-sm text-destructive"}>{msg.text}</p>}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="animate-spin" />}
        {view === "signin" ? "Sign in" : view === "signup" ? "Create account" : "Send reset link"}
      </Button>
      <div className="flex flex-wrap justify-between text-sm">
        {view !== "signin" && <Button variant="link" type="button" onClick={() => setView("signin")}>Have an account? Sign in</Button>}
        {view !== "signup" && <Button variant="link" type="button" onClick={() => setView("signup")}>Create account</Button>}
        {view === "signin" && <Button variant="link" type="button" onClick={() => setView("forgot")}>Forgot password?</Button>}
      </div>
    </form>
  );
}

export function AuthScreen() {
  const { startGuest } = useRooted();
  return (
    <div className="pt-safe mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 pb-10">
      <div className="mb-8 text-center">
        <img src={logo} alt="Rooted" width={88} height={88} className="mx-auto size-22 rounded-3xl" />
        <h1 className="mt-4 text-3xl font-extrabold">Rooted</h1>
        <p className="text-muted-foreground">Build what matters, daily.</p>
      </div>
      <div className="rounded-3xl bg-card p-5">
        <AuthForm />
      </div>
      <div className="mt-5 text-center">
        <Button variant="secondary" className="w-full" onClick={startGuest}>Continue as guest</Button>
        <p className="mt-2 text-xs text-muted-foreground">Guest data stays on this device only. You can move it into an account later.</p>
      </div>
    </div>
  );
}
