import { NotificationBanner } from "./NotificationBanner";
import { useEffect, useRef, useState } from "react";
import { Bell, Settings2, Plus, Trash2, Save, RefreshCw, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useRooted } from "@/lib/rooted/store";
import {
  loadScheduledReminders,
  saveScheduledReminder,
  deleteScheduledReminder,
  sendNotificationConfirmation,
} from "@/lib/rooted/reminders.functions";
import { scheduledReminderSchema } from "@/lib/rooted/push-validation";
import { cn } from "@/lib/utils";
import { deviceSubscription, enableDevice } from "@/lib/rooted/push-client";

function ReminderMessage({ value, ...props }: React.ComponentProps<typeof Textarea>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const field = ref.current;
    if (!field) return;
    const resize = () => {
      field.style.height = "auto";
      field.style.height = `${field.scrollHeight}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(field);
    return () => observer.disconnect();
  }, [value]);
  return (
    <Textarea
      {...props}
      value={value}
      ref={ref}
      rows={2}
      className="min-w-0 resize-none overflow-hidden whitespace-pre-wrap break-words"
    />
  );
}

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
  const [manageOpen, setManageOpen] = useState(false);
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
    const parsed = scheduledReminderSchema.safeParse({ ...row, timezone: r.data.profile.timezone });
    if (!parsed.success) throw new Error("Enter a title, message and valid time.");
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
                device
                  ? setManageOpen(true)
                  : void run(async () => {
                      const sub = await enableDevice();
                      setDevice(true);
                      try {
                        await sendNotificationConfirmation({ data: { endpoint: sub.endpoint } });
                      } catch {
                        toast.warning(
                          "Notifications are enabled, but the confirmation couldn't be delivered.",
                        );
                      }
                    })
              }
            >
              {device ? <Settings2 /> : <Bell />}
              {device ? "Manage notifications" : "Enable"}
            </Button>
          </div>
          <Dialog open={manageOpen} onOpenChange={setManageOpen}>
            <DialogContent className="w-[calc(100%-2rem)] rounded-2xl motion-reduce:animate-none">
              <DialogTitle>Manage notifications</DialogTitle>
              <DialogDescription>
                Change notification permissions, sounds, and alerts in your device settings.
              </DialogDescription>
              <div className="space-y-3 text-sm">
                <p>
                  <strong>On iPhone or iPad:</strong> Open Settings → Notifications → Rooted. Turn
                  Allow Notifications on or off, or choose where alerts appear. If you renamed
                  Rooted on your Home Screen, look for that name.
                </p>
                <p>
                  <strong>On other devices:</strong> Open your browser’s site settings for Rooted
                  and change the notification permission.
                </p>
                <p className="text-muted-foreground">
                  This affects this device. To pause one reminder, tap its pencil, turn off Reminder
                  enabled, then Save.
                </p>
              </div>
            </DialogContent>
          </Dialog>
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
                    className="space-y-1.5"
                  >
                    <NotificationBanner
                      title={row.title}
                      message={row.message}
                      time={row.delivery_time}
                      status={[!row.enabled && "Paused", row.dirty && "Unsaved"]
                        .filter(Boolean)
                        .join(" · ")}
                      editControl={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 rounded-full"
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
                      }
                    />
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
                          <div className="flex items-center justify-between gap-3">
                            <Label htmlFor={`enabled-${row.key}`}>Reminder enabled</Label>
                            <Switch
                              id={`enabled-${row.key}`}
                              checked={row.enabled}
                              disabled={busy}
                              onCheckedChange={(enabled) => edit(row.key, { enabled })}
                            />
                          </div>
                          <div className="grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-[minmax(0,1fr)_minmax(0,7rem)]">
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
                                className="rooted-reminder-time min-w-0 max-w-full px-2"
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
                            <ReminderMessage
                              id={`message-${row.key}`}
                              value={row.message}
                              maxLength={200}
                              disabled={busy}
                              onChange={(e) => edit(row.key, { message: e.target.value })}
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
