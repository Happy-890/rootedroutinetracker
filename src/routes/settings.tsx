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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
      <h1 className="mb-3 text-xl font-extrabold">Settings</h1>
      <div className="space-y-4">
        <section className="space-y-2">
          <h2 className="font-extrabold">Appearance</h2>
          <Select value={appearance} onValueChange={value => setAppearance(value as Appearance)}>
            <SelectTrigger aria-label="Appearance" className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="light">Light</SelectItem><SelectItem value="dark">Dark</SelectItem><SelectItem value="device">Device</SelectItem></SelectContent>
          </Select>
        </section>
        <ReminderSettings />
        <section className="space-y-3 rounded-3xl bg-card p-4">
          <h2 className="font-extrabold">Profile</h2>
          <div className="space-y-1"><Label htmlFor="dn">Display name</Label><Input id="dn" className="h-11" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1">
            <Label htmlFor="tz">Timezone</Label>
            <Input id="tz" className="h-11" list="tzs" value={tz} onChange={(e) => setTz(e.target.value)} />
            <datalist id="tzs">{(Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone").map((z) => <option key={z} value={z} />)}</datalist>
            <p className="text-xs text-muted-foreground">Reminder timezone. Points always close at midnight Central time, with no catch-up window.</p>
          </div>
          <Button onClick={saveProfile} className="w-full">Save profile</Button>
        </section>

        <section className="space-y-3 rounded-3xl bg-card p-4">
          <h2 className="font-extrabold">Account</h2>
          {r.mode === "account" ? (
            <>
              <p className="text-sm text-muted-foreground">Signed in as {r.email}. Your data is saved to your private account.</p>
              {r.guestImportAvailable && (
                <div className="rounded-2xl bg-gold-soft p-3 text-sm">
                  <p>Guest data was found on this device. Import it once? Older writing is kept in your archives, but only today's Central-time points can be imported.</p>
                  <Button className="mt-2 w-full" onClick={async () => toast[(await r.importGuest()) ? "success" : "error"]((await Promise.resolve(r.save.message)) ?? "Import finished")}>Import guest data</Button>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">You're using guest mode. Data is stored only on this device and is not backed up. Create an account or sign in to keep it safe — you can import your guest data afterward.</p>
              <AuthForm />
            </>
          )}
          <Button variant="secondary" className="w-full" onClick={() => void r.signOut()}>{r.mode === "account" ? "Log out" : "Leave guest mode"}</Button>
        </section>

        <section className="space-y-3 rounded-3xl bg-card p-4">
          <h2 className="font-extrabold">Backup</h2>
          <Button variant="secondary" className="w-full" onClick={exportData}>Export my data (JSON)</Button>
        </section>

        <section className="space-y-2 rounded-3xl bg-card p-4 text-sm">
          <h2 className="font-extrabold">Add to Home Screen (iPhone)</h2>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Open Rooted in Safari.</li>
            <li>Tap the Share button.</li>
            <li>Choose “Add to Home Screen”, then tap Add.</li>
          </ol>
        </section>
      </div>
    </Shell>
  );
}
