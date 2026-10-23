import { describe, expect, it } from "vitest";
import { assertOpenScoringDate, scoringDate, reminderDue } from "@/lib/rooted/logic";
import { LocalRepo } from "@/lib/rooted/repo";
import { allowedPushEndpoint, reminderSchema } from "@/lib/rooted/push-validation";

describe("Strict Central-time cutoff", () => {
  it("closes yesterday exactly at summer midnight, with no catch-up", () => {
    expect(() => assertOpenScoringDate("2026-10-22", new Date("2026-10-23T04:59:59Z"))).not.toThrow();
    expect(() => assertOpenScoringDate("2026-10-22", new Date("2026-10-23T05:00:00Z"))).toThrow();
    expect(() => assertOpenScoringDate("2026-10-22", new Date("2026-10-23T20:00:00Z"))).toThrow();
  });
  it("closes yesterday at winter midnight", () => {
    expect(scoringDate(new Date("2026-12-23T05:59:59Z"))).toBe("2026-12-22");
    expect(() => assertOpenScoringDate("2026-12-22", new Date("2026-12-23T06:00:00Z"))).toThrow();
  });
  it("rejects future points", () => { expect(() => assertOpenScoringDate("2026-10-24", new Date("2026-10-23T12:00:00Z"))).toThrow(); });
  it("guest writes cannot earn past points", async () => { await expect(new LocalRepo("test:cutoff").setActivity("2000-01-01", "bible", true)).rejects.toThrow(); });
});
describe("Private reminders", () => {
  it("allows a chosen time and message", () => { expect(reminderSchema.parse({ enabled: true, delivery_time: "21:30", timezone: "America/Chicago", message: "Time to reflect" }).message).toBe("Time to reflect"); });
  it("rejects invalid times and messages over 200 characters", () => {
    expect(reminderSchema.safeParse({ enabled: true, delivery_time: "24:00", timezone: "America/Chicago", message: "Time" }).success).toBe(false);
    expect(reminderSchema.safeParse({ enabled: true, delivery_time: "21:30", timezone: "America/Chicago", message: "a".repeat(201) }).success).toBe(false);
  });
  it("is due once per local day at the chosen minute", () => {
    const now = new Date("2026-10-23T02:30:00Z");
    expect(reminderDue("America/Chicago", "21:30", null, now)).toBe(true);
    expect(reminderDue("America/Chicago", "21:30", "2026-10-22", now)).toBe(false);
    expect(reminderDue("America/Chicago", "21:31", null, now)).toBe(false);
  });
  it("blocks private hosts, non-HTTPS URLs and deceptive push hostnames", () => {
    for (const endpoint of ["https://127.0.0.1/", "https://localhost/", "http://fcm.googleapis.com/", "https://fcm.googleapis.com.evil.com/", "https://fcm.googleapis.com:8080/"]) expect(allowedPushEndpoint(endpoint)).toBe(false);
    expect(allowedPushEndpoint("https://web.push.apple.com/test")).toBe(true);
    expect(allowedPushEndpoint("https://fcm.googleapis.com/fcm/send/test")).toBe(true);
  });
});