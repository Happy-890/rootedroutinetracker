import { describe, expect, it } from "vitest";
import { scheduledReminderSchema, reminderPayload } from "@/lib/rooted/push-validation";
import { reminderDue } from "@/lib/rooted/logic";

describe("Individual daily reminders", () => {
  it("keeps independent titles, messages and times", () => {
    const morning = scheduledReminderSchema.parse({ title: "Time to Build", message: "Go ALL OUT!!", enabled: true, delivery_time: "07:00", timezone: "America/Chicago" });
    const evening = scheduledReminderSchema.parse({ title: "Daily Check-In", message: "Reflect on today", enabled: false, delivery_time: "20:00", timezone: "America/Chicago" });
    expect(morning.title).toBe("Time to Build"); expect(morning.delivery_time).toBe("07:00");
    expect(evening.title).toBe("Daily Check-In"); expect(evening.enabled).toBe(false);
  });
  it("passes the selected title and message into push delivery", () => {
    expect(reminderPayload("Time to Build", "Go ALL OUT!!", "morning")).toEqual({ title: "Time to Build", body: "Go ALL OUT!!", tag: "rooted-reminder-morning" });
    expect(reminderPayload("Evening", "Reflect", "evening").tag).not.toBe(reminderPayload("Morning", "Build", "morning").tag);
  });
  it("each reminder has an independent daily delivery date", () => {
    const now = new Date("2026-10-25T01:00:00Z");
    expect(reminderDue("America/Chicago", "20:00", "2026-10-24", now)).toBe(false);
    expect(reminderDue("America/Chicago", "20:00", null, now)).toBe(true);
  });
  it("rejects empty titles and malformed reminder identifiers", () => {
    const reminder = { title: "Daily Check-In", enabled: true, delivery_time: "20:00", timezone: "America/Chicago", message: "Build" };
    expect(scheduledReminderSchema.safeParse({ ...reminder, title: "  " }).success).toBe(false);
    expect(scheduledReminderSchema.safeParse({ ...reminder, id: "another-user" }).success).toBe(false);
  });
});