import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ owned: vi.fn(), remove: vi.fn(), unsubscribe: vi.fn() }));
vi.mock("@/lib/rooted/reminders.functions", () => ({
  ownsDevice: mocks.owned,
  removeDevice: mocks.remove,
  registerDevice: vi.fn(),
  notificationKey: vi.fn(),
}));
import {
  deviceSubscription,
  reconcileDeviceAccount,
  releaseDevice,
} from "@/lib/rooted/push-client";
const sub = { endpoint: "https://web.push.apple.com/qa", unsubscribe: mocks.unsubscribe };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("navigator", {
    serviceWorker: {
      getRegistration: async () => ({ pushManager: { getSubscription: async () => sub } }),
    },
  });
  vi.stubGlobal("Notification", { permission: "granted" });
  mocks.owned.mockResolvedValue({ owned: true });
  mocks.remove.mockResolvedValue({ ok: true });
  mocks.unsubscribe.mockResolvedValue(true);
});
afterEach(() => vi.unstubAllGlobals());
it("shows enabled only when this account owns the subscription", async () => {
  expect(await deviceSubscription()).toEqual(sub);
  mocks.owned.mockResolvedValue({ owned: false });
  expect(await deviceSubscription()).toBeNull();
});
it("unsubscribes a previous account on account reconciliation", async () => {
  mocks.owned.mockResolvedValue({ owned: false });
  await reconcileDeviceAccount();
  expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
});
it("keeps a matching account's device subscription stable", async () => {
  await reconcileDeviceAccount();
  expect(mocks.unsubscribe).not.toHaveBeenCalled();
});
it("removes the owner binding before unsubscribing on logout", async () => {
  await releaseDevice();
  expect(mocks.remove).toHaveBeenCalledWith({ data: { endpoint: sub.endpoint } });
  expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  expect(mocks.remove.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.unsubscribe.mock.invocationCallOrder[0]!,
  );
});
it("does not report enabled after system permission is denied", async () => {
  vi.stubGlobal("Notification", { permission: "denied" });
  expect(await deviceSubscription()).toBeNull();
});
