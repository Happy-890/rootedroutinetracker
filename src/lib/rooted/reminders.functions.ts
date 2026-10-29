import { createServerFn } from "@tanstack/react-start";
import { requireVerifiedAuth } from "./auth.server";
import { z } from "zod";
import { reminderSchema, scheduledReminderSchema, subscriptionSchema } from "./push-validation";

export const loadReminders = createServerFn({ method: "GET" })
  .middleware([requireVerifiedAuth])
  .handler(async ({ context }) => {
    const result = await context.supabase
      .from("reminder_preferences")
      .select("enabled,delivery_time,timezone,message")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (result.error) throw new Error("Couldn't load reminders.");
    return result.data;
  });
export const saveReminders = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .validator((input) => reminderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const result = await context.supabase
      .from("reminder_preferences")
      .upsert({ ...data, user_id: context.userId });
    if (result.error) throw new Error("Couldn't save reminders.");
    return { ok: true };
  });
export const loadScheduledReminders = createServerFn({ method: "GET" })
  .middleware([requireVerifiedAuth])
  .handler(async ({ context }) => {
    const result = await context.supabase
      .from("daily_reminders")
      .select("id,title,message,delivery_time,timezone,enabled")
      .eq("user_id", context.userId)
      .order("delivery_time")
      .order("created_at");
    if (result.error) throw new Error("Couldn't load reminders.");
    return result.data;
  });
export const saveScheduledReminder = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .validator((input) => scheduledReminderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { id, ...fields } = data;
    const query = id
      ? context.supabase
          .from("daily_reminders")
          .update({ ...fields, legacy_source: false })
          .eq("id", id)
          .eq("user_id", context.userId)
      : context.supabase.from("daily_reminders").insert({ ...fields, user_id: context.userId });
    const result = await query.select("id,title,message,delivery_time,timezone,enabled").single();
    if (result.error || !result.data) throw new Error("Couldn't save this reminder.");
    return result.data;
  });
export const deleteScheduledReminder = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .validator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const result = await context.supabase
      .from("daily_reminders")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("id");
    if (result.error || !result.data?.length) throw new Error("Couldn't delete this reminder.");
    return { ok: true };
  });
export const notificationKey = createServerFn({ method: "GET" })
  .middleware([requireVerifiedAuth])
  .handler(async () => {
    const { pushKeys } = await import("./push.server");
    return { publicKey: (await pushKeys()).publicKey };
  });
export const registerDevice = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .validator((input) => subscriptionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.from("push_devices").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
      },
      { onConflict: "endpoint" },
    );
    if (result.error)
      throw new Error(
        "Couldn't enable this device. Sign out of the other account on this device, then enable again.",
      );
    return { ok: true };
  });
export const ownsDevice = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .validator((input) => z.object({ endpoint: z.string().max(2048) }).parse(input))
  .handler(async ({ data, context }) => {
    const result = await context.supabase
      .from("push_devices")
      .select("id")
      .eq("user_id", context.userId)
      .eq("endpoint", data.endpoint)
      .maybeSingle();
    if (result.error) throw new Error("Couldn't check notification setup.");
    return { owned: !!result.data };
  });
export const removeDevice = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .validator((input) => z.object({ endpoint: z.string().max(2048) }).parse(input))
  .handler(async ({ data, context }) => {
    const result = await context.supabase
      .from("push_devices")
      .delete()
      .eq("user_id", context.userId)
      .eq("endpoint", data.endpoint);
    if (result.error) throw new Error("Couldn't disable this device.");
    return { ok: true };
  });
// A fixed setup confirmation, never a user-triggered test reminder.
export const sendNotificationConfirmation = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .validator((input) => z.object({ endpoint: z.string().max(2048) }).parse(input))
  .handler(async ({ data, context }) => {
    const device = await context.supabase
      .from("push_devices")
      .select("*")
      .eq("user_id", context.userId)
      .eq("endpoint", data.endpoint)
      .single();
    if (device.error || !device.data) throw new Error("Enable notifications on this device first.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cutoff = new Date(Date.now() - 60_000).toISOString();
    // Reuse the existing throttle column; no database migration is needed.
    const claimed = await supabaseAdmin
      .from("push_devices")
      .update({ last_test_at: new Date().toISOString() })
      .eq("id", device.data.id)
      .eq("user_id", context.userId)
      .or(`last_test_at.is.null,last_test_at.lt.${cutoff}`)
      .select("id");
    if (claimed.error || !claimed.data?.length)
      throw new Error("Wait one minute before requesting another setup confirmation.");
    const { sendPush } = await import("./push.server");
    const { logEvent } = await import("./log.server");
    let result;
    try {
      result = await sendPush(
        device.data,
        "You’ve successfully turned on notifications. You can now add reminders.",
        "Notification",
        "setup-confirmation",
      );
    } catch (error) {
      await logEvent(context.userId, "Notification setup confirmation failed", "error", error);
      throw new Error("Couldn't deliver the notification. Try enabling this device again.");
    }
    if (result.expired)
      await context.supabase.from("push_devices").delete().eq("id", device.data.id);
    await logEvent(
      context.userId,
      result.ok
        ? "Notification setup confirmation sent"
        : "Notification setup confirmation rejected",
      result.ok ? "info" : "error",
      `${result.host} responded ${result.status}`,
    );
    if (!result.ok)
      throw new Error("Couldn't deliver the notification. Try enabling this device again.");
    return { ok: true };
  });
export const loadEventLog = createServerFn({ method: "GET" })
  .middleware([requireVerifiedAuth])
  .handler(async ({ context }) => {
    const result = await context.supabase
      .from("app_event_logs")
      .select("id,event,level,detail,created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (result.error) throw new Error("Couldn't load the activity log.");
    return result.data;
  });
