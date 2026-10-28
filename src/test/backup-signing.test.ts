import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { signBackup, verifyBackup } from "@/lib/rooted/backup-signing.server";
import type { BackupBody } from "@/lib/rooted/backup";
const owner = "11111111-1111-4111-8111-111111111111";
const body: BackupBody = {
  format: "rooted-backup",
  version: 2,
  owner_id: owner,
  exported_at: "2026-10-28T12:00:00.000Z",
  profile: { display_name: "QA", timezone: "UTC" },
  records: [{ activity: "bible", local_date: "2026-10-27" }],
  entries: [],
  reminders: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      title: "Reminder",
      message: "Private message",
      delivery_time: "20:00",
      timezone: "UTC",
      enabled: true,
    },
  ],
};
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  vi.stubEnv("ROOTED_BACKUP_SIGNING_SECRET", "test-only-backup-signing-key");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("round trips a backup including reminders and historical activity", async () => {
  const signed = await signBackup(body);
  expect(await verifyBackup(JSON.stringify(signed), owner)).toEqual(body);
});
it("rejects changed scores, writing, reminder messages and profile settings", async () => {
  const signed = await signBackup(body);
  for (const patch of [
    { records: [] },
    { entries: [{ content: { text: "forged" } }] },
    { reminders: [] },
    { profile: { display_name: "forged", timezone: "UTC" } },
  ]) {
    await expect(
      verifyBackup(JSON.stringify({ ...signed, body: { ...body, ...patch } }), owner),
    ).rejects.toThrow("verified Rooted backup");
  }
});
it("rejects restoring into another account", async () => {
  await expect(
    verifyBackup(JSON.stringify(await signBackup(body)), "33333333-3333-4333-8333-333333333333"),
  ).rejects.toThrow("account that created");
});
it("rejects unsigned legacy files rather than trusting historical scores", async () => {
  await expect(
    verifyBackup(JSON.stringify({ records: { "2020-01-01|bible": true } }), owner),
  ).rejects.toThrow("Export a new backup");
});
it("accepts reordered JSON keys without weakening integrity", async () => {
  const signed = await signBackup(body);
  const reordered = Object.fromEntries(Object.entries(signed.body).reverse());
  expect(await verifyBackup(JSON.stringify({ ...signed, body: reordered }), owner)).toEqual(body);
});
