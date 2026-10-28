import { afterEach, beforeEach, expect, it, vi } from "vitest";
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("PROD", true);
  const top = {};
  vi.stubGlobal("window", { self: top, top });
  vi.stubGlobal("location", { hostname: "rootedroutinetracker.lovable.app", search: "" });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("uses the same stable worker URL for concurrent startup and enable calls", async () => {
  const register = vi.fn().mockResolvedValue({
    active: { scriptURL: "https://rootedroutinetracker.lovable.app/rooted-push-worker.js" },
  });
  vi.stubGlobal("navigator", { serviceWorker: { register } });
  const { registerRootedWorker } = await import("@/lib/rooted/pwa");
  await Promise.all([registerRootedWorker(), registerRootedWorker()]);
  expect(register).toHaveBeenCalledExactlyOnceWith("/rooted-push-worker.js", {
    scope: "/",
    updateViaCache: "none",
  });
});
it("waits for the unified worker when replacing the old cache-only worker", async () => {
  let changed = () => {};
  const worker = {
    state: "installing",
    addEventListener: vi.fn((_name, callback) => {
      changed = callback;
    }),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("navigator", {
    serviceWorker: {
      register: async () => ({
        active: { scriptURL: "https://rootedroutinetracker.lovable.app/sw.js" },
        installing: worker,
      }),
    },
  });
  const { registerRootedWorker } = await import("@/lib/rooted/pwa");
  let done = false;
  const result = registerRootedWorker().then(() => {
    done = true;
  });
  await Promise.resolve();
  expect(done).toBe(false);
  worker.state = "activated";
  changed();
  await result;
  expect(done).toBe(true);
});
it("never registers in a preview", async () => {
  vi.stubGlobal("location", { hostname: "preview--example.lovable.app", search: "" });
  const register = vi.fn();
  vi.stubGlobal("navigator", { serviceWorker: { register } });
  const { registerRootedWorker } = await import("@/lib/rooted/pwa");
  await expect(registerRootedWorker()).rejects.toThrow("published");
  expect(register).not.toHaveBeenCalled();
});
