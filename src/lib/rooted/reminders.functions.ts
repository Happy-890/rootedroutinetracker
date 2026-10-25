import { createServerFn } from "@tanstack/react-start";
import { requireVerifiedAuth } from "./auth.server";
import { z } from "zod";
import { reminderSchema, scheduledReminderSchema, subscriptionSchema } from "./push-validation";

export const loadReminders = createServerFn({ method: "GET" }).middleware([requireVerifiedAuth]).handler(async ({ context }) => {
  const result = await context.supabase.from("reminder_preferences").select("enabled,delivery_time,timezone,message").eq("user_id", context.userId).maybeSingle();
  if (result.error) throw new Error("Couldn't load reminders.");
  return result.data;
});
export const saveReminders = createServerFn({ method: "POST" }).middleware([requireVerifiedAuth]).inputValidator(input => reminderSchema.parse(input)).handler(async ({ data, context }) => {
  const result = await context.supabase.from("reminder_preferences").upsert({ ...data, user_id: context.userId });
  if (result.error) throw new Error("Couldn't save reminders.");
  return { ok: true };
});
export const notificationKey = createServerFn({ method: "GET" }).middleware([requireVerifiedAuth]).handler(async () => {
  const { pushKeys } = await import("./push.server");
  return { publicKey: (await pushKeys()).publicKey };
});
export const registerDevice = createServerFn({ method: "POST" }).middleware([requireVerifiedAuth]).inputValidator(input => subscriptionSchema.parse(input)).handler(async ({ data, context }) => {
  const result = await context.supabase.from("push_devices").upsert({ user_id: context.userId, endpoint: data.endpoint, p256dh: data.keys.p256dh, auth: data.keys.auth }, { onConflict: "endpoint" });
  if (result.error) throw new Error("Couldn't enable this device. If another account used it, disable notifications there first.");
  return { ok: true };
});
export const removeDevice = createServerFn({ method: "POST" }).middleware([requireVerifiedAuth]).inputValidator(input => z.object({ endpoint: z.string().max(2048) }).parse(input)).handler(async ({ data, context }) => {
  const result = await context.supabase.from("push_devices").delete().eq("user_id", context.userId).eq("endpoint", data.endpoint);
  if (result.error) throw new Error("Couldn't disable this device.");
  return { ok: true };
});
export const testReminder = createServerFn({ method: "POST" }).middleware([requireVerifiedAuth]).inputValidator(input => z.object({ endpoint: z.string().max(2048) }).parse(input)).handler(async ({ data, context }) => {
  const device = await context.supabase.from("push_devices").select("*").eq("user_id", context.userId).eq("endpoint", data.endpoint).single();
  if (device.error || !device.data) throw new Error("Enable notifications on this device first.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cutoff = new Date(Date.now() - 60_000).toISOString();
  const claimed = await supabaseAdmin.from("push_devices").update({ last_test_at: new Date().toISOString() }).eq("id", device.data.id).eq("user_id", context.userId).or(`last_test_at.is.null,last_test_at.lt.${cutoff}`).select("id");
  if (claimed.error || !claimed.data?.length) throw new Error("Wait one minute before sending another test.");
  const preferences = await context.supabase.from("reminder_preferences").select("message").eq("user_id", context.userId).maybeSingle();
  const { sendPush } = await import("./push.server");
  const { logEvent } = await import("./log.server");
  let result;
  try {
    result = await sendPush(device.data, preferences.data?.message ?? "Build what matters, daily.");
  } catch (error) {
    await logEvent(context.userId, "Test notification failed", "error", error);
    throw new Error("Couldn't deliver the notification. Try enabling this device again.");
  }
  if (result.expired) await context.supabase.from("push_devices").delete().eq("id", device.data.id);
  await logEvent(context.userId, result.ok ? "Test notification sent" : "Test notification rejected", result.ok ? "info" : "error", `${result.host} responded ${result.status}`);
  if (!result.ok) throw new Error("Couldn't deliver the notification. Try enabling this device again.");
  return { ok: true };
});
export const loadEventLog = createServerFn({ method: "GET" }).middleware([requireVerifiedAuth]).handler(async ({ context }) => {
  const result = await context.supabase.from("app_event_logs").select("id,event,level,detail,created_at").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(30);
  if (result.error) throw new Error("Couldn't load the activity log.");
  return result.data;
});