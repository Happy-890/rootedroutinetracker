import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), send: vi.fn(), log: vi.fn(), remove: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc: mocks.rpc, from: () => ({ delete: () => ({ eq: mocks.remove }) }) },
}));
vi.mock("@/lib/rooted/push.server", () => ({ sendPush: mocks.send }));
vi.mock("@/lib/rooted/log.server", () => ({ logEvent: mocks.log }));
import { deliverDueReminders } from "@/lib/rooted/delivery.server";
const device = {
  device_id: "device",
  reminder_id: "reminder",
  user_id: "owner",
  endpoint: "https://web.push.apple.com/qa",
  p256dh: "key",
  auth: "key",
  title: "QA",
  message: "QA",
  local_date: "2026-10-28",
  lease_token: "lease",
  attempt: 1,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockImplementation(async (name) =>
    name === "claim_rooted_reminders_v3"
      ? { data: [device], error: null }
      : { data: true, error: null },
  );
  mocks.send.mockResolvedValue({
    ok: true,
    expired: false,
    status: 201,
    host: "web.push.apple.com",
  });
});
it("records success with the exact delivery lease", async () => {
  expect(await deliverDueReminders()).toEqual({ sent: 1 });
  expect(mocks.rpc).toHaveBeenCalledWith(
    "finish_rooted_delivery",
    expect.objectContaining({ p_lease_token: "lease", p_ok: true }),
  );
});
it.each([429, 503, 408])("retries temporary HTTP %i failures", async (status) => {
  mocks.send.mockResolvedValue({ ok: false, expired: false, status, host: "web.push.apple.com" });
  await deliverDueReminders();
  expect(mocks.rpc).toHaveBeenCalledWith(
    "finish_rooted_delivery",
    expect.objectContaining({ p_ok: false, p_retryable: true, p_status: status }),
  );
});
it("retries network failures without marking delivery successful", async () => {
  mocks.send.mockRejectedValue(new Error("Timeout"));
  await deliverDueReminders();
  expect(mocks.rpc).toHaveBeenCalledWith(
    "finish_rooted_delivery",
    expect.objectContaining({ p_ok: false, p_retryable: true }),
  );
});
it("stops retrying permanent failures and removes expired endpoints", async () => {
  mocks.send.mockResolvedValue({
    ok: false,
    expired: true,
    status: 410,
    host: "web.push.apple.com",
  });
  await deliverDueReminders();
  expect(mocks.rpc).toHaveBeenCalledWith(
    "finish_rooted_delivery",
    expect.objectContaining({ p_retryable: false }),
  );
  expect(mocks.remove).toHaveBeenCalledWith("id", "device");
});
