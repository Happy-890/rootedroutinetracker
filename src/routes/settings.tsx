import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/rooted/Shell";
import { AuthForm } from "@/components/rooted/AuthScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRooted } from "@/lib/rooted/store";
import { isValidTimeZone } from "@/lib/rooted/logic";
import { useAppearance, type Appearance } from "@/lib/rooted/appearance";
import { Sun, Moon, Monitor, UserRound, Download, LogOut, Sprout } from "lucide-react";
import { ReminderSettings } from "@/components/rooted/ReminderSettings";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Settings — Rooted" },
      { name: "description", content: "Manage Rooted reminders, appearance, profile and private backups." },
      { property: "og:title", content: "Settings — Rooted" },
      { property: "og:description", content: "Manage Rooted reminders, appearance, profile and private backups." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const r = useRooted();
  const { appearance, setAppearance } = useAppearance();
  const [name, setName] = useState(r.data.profile.display_name);
  const [tz, setTz] = useState(r.data.profile.timezone);
  useEffect(() => { setName(r.data.profile.display_name); setTz(r.data.profile.timezone); }, [r.data.profile]);

  async function saveProfile() {
    if (!name.trim()) { toast.error("Enter your display name."); return; }
    if (!isValidTimeZone(tz)) { toast.error("Unknown timezone. Use a name like America/Chicago."); return; }
    if (await r.saveProfile({ display_name: name.trim(), timezone: tz })) toast.success("Profile saved");
    else toast.error(r.save.message ?? "Couldn't save");
  }
  function exportData() {
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), ...r.data }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rooted-backup-${r.today}.json`;
    a.click();
  }

  return (
    <Shell>
      <h1 className="mb-4 text-xl font-extrabold">Settings</h1>
      <div>
        <section className="space-y-3 pb-5">
          <h2 className="font-extrabold">Appearance</h2>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-card p-1" role="group" aria-label="Appearance">
            {([{ value: "light", label: "Light", Icon: Sun }, { value: "dark", label: "Dark", Icon: Moon }, { value: "device", label: "Device", Icon: Monitor }] as const).map(({ value, label, Icon }) => <Button key={value} variant={appearance === value ? "default" : "ghost"} className="min-w-0 rounded-lg px-2" aria-pressed={appearance === value} onClick={() => setAppearance(value as Appearance)}><Icon />{label}</Button>)}
          </div>
        </section>
        <section className="space-y-3 border-t border-border py-5">
          <h2 className="flex items-center gap-2 font-extrabold"><UserRound className="size-4 text-primary" />Profile & account</h2>
          {r.mode === "account" && <p className="break-all text-sm text-muted-foreground">{r.email}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label htmlFor="dn">Display name</Label><Input id="dn" value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="tz">Default reminder timezone</Label><Input id="tz" list="tzs" value={tz} onChange={e => setTz(e.target.value)} /></div>
          </div>
          <datalist id="tzs">{(Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone").map(z => <option key={z} value={z} />)}</datalist>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Button disabled={!name.trim() || r.save.kind === "saving"} onClick={saveProfile}>Save profile</Button>
            <Button variant="ghost" onClick={() => void r.signOut()}><LogOut />{r.mode === "account" ? "Log out" : "Leave guest"}</Button>
          </div>
          {r.mode !== "account" && <details className="border-t border-border pt-3"><summary className="cursor-pointer text-sm font-semibold">Sign in or create an account</summary><div className="mt-3"><AuthForm /></div></details>}
        </section>
        <ReminderSettings />
        <section className="space-y-3 border-t border-border py-5">
          <h2 className="font-extrabold">Data & backup</h2>
          <p className="text-sm text-muted-foreground">{r.mode === "account" ? "Your writing and progress are private to your account." : "Guest data is stored only on this device."}</p>
          <Button variant="secondary" className="w-full" onClick={exportData}><Download />Export my data</Button>
          {r.mode === "account" && r.guestImportAvailable && <div className="space-y-2 border-t border-border pt-3">
            <p className="text-sm text-muted-foreground">Guest writing found on this device. Older entries stay archived; only today's points are imported.</p>
            <Button variant="outline" className="w-full" onClick={async () => { const ok = await r.importGuest(); toast[ok ? "success" : "error"](ok ? "Guest data imported" : "Couldn't import guest data"); }}>Import guest data</Button>
          </div>}
        </section>
        <section className="space-y-3 border-t border-border py-5 text-xs text-muted-foreground">
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><Sprout className="size-4 text-primary" />Rooted</h2>
          <p>Points close at midnight Central time. No catch-up window.</p>
          <details><summary className="cursor-pointer font-semibold">Add to Home Screen</summary><p className="mt-2">In Safari, tap Share → Add to Home Screen → Add.</p></details>
        </section>
      </div>
    </Shell>
  );
}
