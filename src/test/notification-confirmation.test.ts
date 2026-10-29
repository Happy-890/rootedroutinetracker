import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ send: vi.fn(), log: vi.fn(), claim: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      validator: () => builder,
      handler: (fn: unknown) => fn,
    };
    return builder;
  },
}));
vi.mock("@/lib/rooted/auth.server", () => ({ requireVerifiedAuth: {} }));
vi.mock("@/lib/rooted/push.server", () => ({ sendPush: mocks.send }));
vi.mock("@/lib/rooted/log.server", () => ({ logEvent: mocks.log }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      update: () => ({ eq: () => ({ eq: () => ({ or: () => ({ select: mocks.claim }) }) }) }),
    }),
  },
}));
import { sendNotificationConfirmation } from "@/lib/rooted/reminders.functions";

const device = {
  id: "device-id",
  endpoint: "https://web.push.apple.com/test",
  p256dh: "key",
  auth: "auth",
};
function request(owned = true) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    single: vi.fn(async () => ({ data: owned ? device : null, error: null })),
    delete: vi.fn(() => query),
  };
  // Invoke the captured server handler; the real middleware supplies verified context.
  const invoke = sendNotificationConfirmation as unknown as (input: unknown) => Promise<unknown>;
  return {
    query,
    run: () =>
      invoke({
        data: { endpoint: device.endpoint },
        context: { userId: "owner-id", supabase: { from: () => query } },
      }),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.claim.mockResolvedValue({ data: [{ id: device.id }], error: null });
  mocks.send.mockResolvedValue({
    ok: true,
    expired: false,
    host: "web.push.apple.com",
    status: 201,
  });
});
it("sends a fixed confirmation only to a device owned by the signed-in user", async () => {
  const { run, query } = request();
  await expect(run()).resolves.toEqual({ ok: true });
  expect(query.eq).toHaveBeenCalledWith("user_id", "owner-id");
  expect(query.eq).toHaveBeenCalledWith("endpoint", device.endpoint);
  expect(mocks.send).toHaveBeenCalledExactlyOnceWith(
    device,
    "You’ve successfully turned on notifications. You can now add reminders.",
    "Notification",
    "setup-confirmation",
  );
});
it("rejects devices belonging to other accounts", async () => {
  await expect(request(false).run()).rejects.toThrow("Enable notifications");
  expect(mocks.claim).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
});
it("throttles repeated confirmations", async () => {
  mocks.claim.mockResolvedValue({ data: [], error: null });
  await expect(request().run()).rejects.toThrow("Wait one minute");
  expect(mocks.send).not.toHaveBeenCalled();
});
it("logs delivery failures and removes expired devices", async () => {
  mocks.send.mockResolvedValue({
    ok: false,
    expired: true,
    host: "web.push.apple.com",
    status: 410,
  });
  const { run, query } = request();
  await expect(run()).rejects.toThrow("Couldn't deliver");
  expect(query.delete).toHaveBeenCalled();
  expect(mocks.log).toHaveBeenCalledWith(
    "owner-id",
    "Notification setup confirmation rejected",
    "error",
    "web.push.apple.com responded 410",
  );
});
