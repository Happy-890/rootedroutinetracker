import { formatReminderTime } from "@/lib/rooted/reminder-time";
import { useEffect, useState } from "react";
import { Bell, BellOff, Plus, Trash2, Save, Send, RefreshCw, Pencil, Sprout } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useRooted } from "@/lib/rooted/store";
import {
  loadScheduledReminders,
  saveScheduledReminder,
  deleteScheduledReminder,
  testReminder,
} from "@/lib/rooted/reminders.functions";
import { scheduledReminderSchema } from "@/lib/rooted/push-validation";
import { cn } from "@/lib/utils";
import { deviceSubscription, enableDevice, disableDevice } from "@/lib/rooted/push-client";

type Draft = {
  key: string;
  id?: string;
  title: string;
  message: string;
  delivery_time: string;
  timezone: string;
  enabled: boolean;
  dirty: boolean;
  editing: boolean;
};
export function ReminderSettings() {
  const r = useRooted();
  const [rows, setRows] = useState<Draft[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [device, setDevice] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setReady(false);
    setDevice(false);
    setRows([]);
    setFailed(false);
    if (r.mode !== "account") return;
    Promise.all([loadScheduledReminders(), deviceSubscription()])
      .then(([saved, sub]) => {
        if (!active) return;
        setRows(saved.map((row) => ({ ...row, key: row.id, dirty: false, editing: false })));
        setDevice(!!sub);
        setReady(true);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [r.mode, r.userId, reload]);
  function edit(key: string, patch: Partial<Draft>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch, dirty: true } : row)),
    );
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update reminders.");
    } finally {
      setBusy(false);
    }
  }
  async function save(row: Draft, collapse = true) {
    const parsed = scheduledReminderSchema.safeParse(row);
    if (!parsed.success) throw new Error("Enter a title, message, valid time and timezone.");
    const saved = await saveScheduledReminder({ data: parsed.data });
    setRows((current) =>
      current.map((item) =>
        item.key === row.key
          ? { ...saved, key: row.key, dirty: false, editing: collapse ? false : item.editing }
          : item,
      ),
    );
    toast.success("Reminder saved");
  }
  return (
    <section className="space-y-3 border-t border-border py-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h2 className="flex min-w-0 items-center gap-2 font-extrabold">
          <Bell className="size-4 shrink-0 text-primary" />
          Notifications
        </h2>
        {r.mode === "account" && (
          <span className="text-xs font-semibold text-muted-foreground">
            {rows.filter((row) => row.enabled && row.id).length} active
          </span>
        )}
      </div>
      {r.mode !== "account" ? (
        <p className="text-sm text-muted-foreground">Sign in to save your daily reminders.</p>
      ) : (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">This device</p>
              <p className={device ? "text-xs text-success" : "text-xs text-muted-foreground"}>
                {device ? "Notifications enabled" : "Notifications not enabled"}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={!ready || busy}
              onClick={() =>
                void run(async () => {
                  if (device) {
                    await disableDevice();
                    setDevice(false);
                  } else {
                    await enableDevice();
                    setDevice(true);
                  }
                })
              }
            >
              {device ? <BellOff /> : <Bell />}
              {device ? "Disable" : "Enable"}
            </Button>
          </div>
          {failed ? (
            <div className="flex items-center justify-between gap-2 text-sm text-destructive">
              Couldn't load reminders.
              <Button variant="outline" size="sm" onClick={() => setReload((n) => n + 1)}>
                <RefreshCw />
                Retry
              </Button>
            </div>
          ) : !ready ? (
            <p className="text-sm text-muted-foreground">Loading reminders…</p>
          ) : (
            <>
              {rows.length === 0 && (
                <p className="py-3 text-sm text-muted-foreground">No daily reminders yet.</p>
              )}
              <div className="space-y-3">
                {rows.map((row, index) => (
                  <article
                    key={row.key}
                    aria-label={`Reminder ${index + 1}`}
                    className="rounded-2xl border border-border/60 bg-card/90 p-3 shadow-sm backdrop-blur-xl"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gold-soft">
                        <Sprout className="size-5 text-gold" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="min-w-0 break-words text-sm font-bold leading-tight">
                            {row.title || "New reminder"}
                          </h3>
                          <time
                            dateTime={row.delivery_time}
                            className="shrink-0 text-xs text-muted-foreground"
                          >
                            {formatReminderTime(row.delivery_time)}
                          </time>
                        </div>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          from Rooted · {row.timezone}
                          {row.dirty ? " · Unsaved" : ""}
                        </p>
                        <p className="mt-1 line-clamp-2 break-words text-sm leading-snug">
                          {row.message}
                        </p>
                      </div>
                    </div>
                    <div className="mt-1 flex items-center justify-end gap-1">
                      <Switch
                        aria-label={`Enable ${row.title || "reminder"}`}
                        checked={row.enabled}
                        disabled={busy}
                        onCheckedChange={(enabled) =>
                          void run(async () => {
                            if (!row.id || row.dirty) {
                              edit(row.key, { enabled });
                              return;
                            }
                            await save({ ...row, enabled }, false);
                          })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit reminder ${index + 1}`}
                        aria-expanded={row.editing}
                        aria-controls={`edit-${row.key}`}
                        disabled={busy}
                        onClick={() =>
                          setRows((current) =>
                            current.map((item) =>
                              item.key === row.key ? { ...item, editing: !item.editing } : item,
                            ),
                          )
                        }
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Test reminder ${index + 1}`}
                        title="Send test notification"
                        disabled={busy || !device || !row.id || row.dirty}
                        onClick={() =>
                          void run(async () => {
                            const sub = await deviceSubscription();
                            if (!sub || !row.id) throw new Error("Enable this device first.");
                            await testReminder({
                              data: { endpoint: sub.endpoint, reminder_id: row.id },
                            });
                            toast.success("Test sent to this device");
                          })
                        }
                      >
                        <Send className="size-3.5" />
                        Test
                      </Button>
                    </div>
                    <div
                      id={`edit-${row.key}`}
                      inert={!row.editing}
                      className={cn(
                        "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
                        row.editing ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                      )}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <div className="space-y-3 border-t border-border pt-3">
                          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3">
                            <div className="min-w-0 space-y-1">
                              <Label htmlFor={`title-${row.key}`}>Title</Label>
                              <Input
                                id={`title-${row.key}`}
                                value={row.title}
                                maxLength={80}
                                disabled={busy}
                                onChange={(e) => edit(row.key, { title: e.target.value })}
                              />
                            </div>
                            <div className="min-w-0 space-y-1">
                              <Label htmlFor={`time-${row.key}`}>Time</Label>
                              <Input
                                className="min-w-0 px-2"
                                id={`time-${row.key}`}
                                type="time"
                                value={row.delivery_time}
                                disabled={busy}
                                onChange={(e) => edit(row.key, { delivery_time: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`message-${row.key}`}>Message</Label>
                            <Input
                              id={`message-${row.key}`}
                              value={row.message}
                              maxLength={200}
                              disabled={busy}
                              onChange={(e) => edit(row.key, { message: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`zone-${row.key}`}>Reminder timezone</Label>
                            <Input
                              id={`zone-${row.key}`}
                              list="tzs"
                              value={row.timezone}
                              disabled={busy}
                              onChange={(e) => edit(row.key, { timezone: e.target.value })}
                            />
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() => void run(() => save(row))}
                            >
                              <Save />
                              Save
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              aria-label={`Delete reminder ${index + 1}`}
                              title="Delete reminder"
                              disabled={busy}
                              onClick={() =>
                                void run(async () => {
                                  if (row.id && !window.confirm(`Delete “${row.title}”?`)) return;
                                  if (row.id)
                                    await deleteScheduledReminder({ data: { id: row.id } });
                                  setRows((current) =>
                                    current.filter((item) => item.key !== row.key),
                                  );
                                })
                              }
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <Button
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={() =>
                  setRows((current) => [
                    ...current,
                    {
                      key: crypto.randomUUID(),
                      title: "Daily Check-In",
                      message: "Build what matters, daily.",
                      delivery_time: "20:00",
                      timezone: r.data.profile.timezone,
                      enabled: true,
                      dirty: true,
                      editing: true,
                    },
                  ])
                }
              >
                <Plus />
                Add reminder
              </Button>
            </>
          )}
          <p className="text-xs text-muted-foreground">
            iPhone notifications require Rooted on your Home Screen and notification permission.
          </p>
        </>
      )}
    </section>
  );
}
