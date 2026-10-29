import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function AccountSecurity({ email, userId }: { email: string | null; userId: string }) {
  const [provider, setProvider] = useState<string | null>(null);
  const [nextEmail, setNextEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    setProvider(null);
    setNextEmail("");
    setPassword("");
    setConfirm("");
    setNotice("");
    void supabase.auth.getUser().then(({ data }) => {
      if (active && data.user?.id === userId) {
        setProvider(data.user.app_metadata?.provider === "email" ? "email" : "external");
      }
    });
    return () => { active = false; };
  }, [userId]);

  async function changeEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requested = nextEmail.trim();
    if (!requested || requested.toLowerCase() === email?.toLowerCase()) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser(
        { email: requested },
        { emailRedirectTo: `${window.location.origin}/settings` },
      );
      if (error) throw error;
      setNotice("Check your email for the confirmation link. Your current email stays in use until the change is verified.");
      setNextEmail("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't request the email change.");
    } finally { setBusy(false); }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) { toast.error("Use at least 8 characters."); return; }
    if (password !== confirm) { toast.error("Passwords do not match."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setConfirm("");
      setNotice("Password updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update your password.");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-bold">Sign-in details</h3>
      <p className="break-all text-sm text-muted-foreground">Current email: {email}</p>
      {provider === "email" ? (
        <>
          <form onSubmit={(event) => void changeEmail(event)} className="space-y-2">
            <Label htmlFor="new-account-email">Change email</Label>
            <Input id="new-account-email" type="email" autoComplete="email" required value={nextEmail} onChange={(event) => setNextEmail(event.target.value)} disabled={busy} />
            <Button type="submit" variant="outline" disabled={busy || !nextEmail.trim()}>Send verification link</Button>
          </form>
          <form onSubmit={(event) => void changePassword(event)} className="space-y-2 border-t border-border pt-3">
            <Label htmlFor="new-account-password">New password</Label>
            <Input id="new-account-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
            <Label htmlFor="confirm-account-password">Confirm new password</Label>
            <Input id="confirm-account-password" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={(event) => setConfirm(event.target.value)} disabled={busy} />
            <Button type="submit" variant="outline" disabled={busy || !password || !confirm}>Update password</Button>
          </form>
        </>
      ) : provider === "external" ? (
        <p className="text-sm text-muted-foreground">Your sign-in email and password are managed by your sign-in provider.</p>
      ) : null}
      {notice && <p role="status" className="text-sm text-success">{notice}</p>}
    </div>
  );
}
