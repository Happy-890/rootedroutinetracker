import { z } from "zod";
import { isValidTimeZone } from "./logic";

export function allowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      (url.hostname === "fcm.googleapis.com" || url.hostname === "updates.push.services.mozilla.com" ||
       url.hostname === "web.push.apple.com" || url.hostname.endsWith(".push.apple.com") ||
       url.hostname === "wns.windows.com" || url.hostname.endsWith(".notify.windows.com"));
  } catch { return false; }
}
export const reminderSchema = z.object({
  enabled: z.boolean(),
  delivery_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.string().max(100).refine(isValidTimeZone),
  message: z.string().trim().min(1).max(200),
});
export const subscriptionSchema = z.object({
  endpoint: z.string().max(2048).refine(allowedPushEndpoint, "Unsupported notification service"),
  keys: z.object({ p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}={0,2}$/), auth: z.string().regex(/^[A-Za-z0-9_-]{22}={0,2}$/) }),
});
export const scheduledReminderSchema = reminderSchema.extend({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(80),
});
export type DailyReminder = z.infer<typeof scheduledReminderSchema> & { id: string };

export function reminderPayload(title: string, body: string, id?: string) {
  return { title, body, tag: id ? `rooted-reminder-${id}` : "rooted-reminder-test" };
}