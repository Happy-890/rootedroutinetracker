import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useRooted } from "@/lib/rooted/store";
import { loadReminders, saveReminders, testReminder, loadEventLog } from "@/lib/rooted/reminders.functions";
import { deviceSubscription, enableDevice, disableDevice } from "@/lib/rooted/push-client";

export function ReminderSettings() {
  const r = useRooted();
  const [preferences, setPreferences] = useState({ enabled: false, delivery_time: "20:00", message: "Build what matters, daily." });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [device, setDevice] = useState(false);
  useEffect(() => {
    let active = true;
    setReady(false); setDevice(false);
    if (r.mode !== "account") return;
    Promise.all([loadReminders(), deviceSubscription()]).then(([saved, sub]) => {
      if (!active) return;
      if (saved) setPreferences(saved);
      setDevice(!!sub); setReady(true);
    }).catch(() => { if (active) toast.error("Couldn't load reminders. Refresh to try again."); });
    return () => { active = false; };
  }, [r.mode, r.userId]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    try { await action(); } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't update reminders."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 border-t border-border pt-4">
    <h2 className="font-extrabold">Notifications</h2>
    {r.mode !== "account" ? <p className="text-sm text-muted-foreground">Sign in to save reminders and enable notifications.</p> : <>
      <div className="flex min-h-11 items-center justify-between gap-3"><Label htmlFor="reminder-enabled">Daily reminder</Label><Switch id="reminder-enabled" checked={preferences.enabled} disabled={!ready || busy} onCheckedChange={enabled => setPreferences(p => ({ ...p, enabled }))} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label htmlFor="reminder-time">Time</Label><Input id="reminder-time" type="time" value={preferences.delivery_time} disabled={!ready || busy} onChange={e => setPreferences(p => ({ ...p, delivery_time: e.target.value }))} /></div>
        <div className="space-y-1"><Label>Timezone</Label><p className="flex min-h-11 items-center break-all text-sm text-muted-foreground">{r.data.profile.timezone}</p></div>
      </div>
      <div className="space-y-1"><Label htmlFor="reminder-message">Message</Label><Input id="reminder-message" value={preferences.message} maxLength={200} disabled={!ready || busy} onChange={e => setPreferences(p => ({ ...p, message: e.target.value }))} /></div>
      <Button className="w-full" disabled={!ready || busy || !preferences.message.trim()} onClick={() => void run(async () => { await saveReminders({ data: { ...preferences, timezone: r.data.profile.timezone } }); toast.success("Reminder saved"); })}>Save reminder</Button>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={!ready || busy} onClick={() => void run(async () => {
          if (device) { await disableDevice(); setDevice(false); toast.success("Notifications disabled on this device"); }
          else { await enableDevice(); setDevice(true); toast.success("Notifications enabled on this device"); }
        })}>{device ? <BellOff className="size-4" /> : <Bell className="size-4" />}{device ? "Disable this device" : "Enable this device"}</Button>
        <Button variant="outline" disabled={!ready || busy || !device} onClick={() => void run(async () => {
          const sub = await deviceSubscription();
          if (!sub) throw new Error("Enable this device first.");
          await testReminder({ data: { endpoint: sub.endpoint } }); toast.success("Test sent to this device");
        })}>Send test</Button>
      </div>
      <p className="text-xs text-muted-foreground">On iPhone, notifications require iOS 16.4 or later and Rooted added to your Home Screen. Delivery depends on your connection and device settings.</p>
      <EventLog />
    </>}
  </section>;
}
type LogRow = { id: string; event: string; level: string; detail: string | null; created_at: string };
function EventLog() {
  const [rows, setRows] = useState<LogRow[] | null>(null);
  const [open, setOpen] = useState(false);
  async function refresh() {
    try { setRows(await loadEventLog()); } catch { toast.error("Couldn't load the activity log."); }
  }
  return <details className="rounded-lg border border-border p-3 text-sm" open={open} onToggle={e => { const o = (e.target as HTMLDetailsElement).open; setOpen(o); if (o) void refresh(); }}>
    <summary className="cursor-pointer font-semibold">Delivery log</summary>
    <div className="mt-2 space-y-2">
      <Button variant="outline" size="sm" onClick={() => void refresh()}>Refresh</Button>
      {rows === null ? <p className="text-muted-foreground">Loading…</p> : rows.length === 0 ? <p className="text-muted-foreground">No events yet.</p> :
        <ul className="space-y-2">{rows.map(row => <li key={row.id} className="border-t border-border pt-2">
          <div className="flex justify-between gap-2"><span className={row.level === "error" ? "font-semibold text-destructive" : "font-semibold"}>{row.event}</span><span className="shrink-0 text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString([], { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></div>
          {row.detail && <p className="break-all text-xs text-muted-foreground">{row.detail.split("\n")[0]}</p>}
        </li>)}</ul>}
    </div>
  </details>;
}
