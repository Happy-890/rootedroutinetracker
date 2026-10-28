let pending: Promise<ServiceWorkerRegistration> | undefined;

/** A single registrar for public-asset caching and push; the URL preserves existing subscriptions. */
export function registerRootedWorker(): Promise<ServiceWorkerRegistration> {
  const host = location.hostname;
  if (
    !("serviceWorker" in navigator) ||
    !import.meta.env.PROD ||
    window.self !== window.top ||
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    /(^|\.)lovableproject(-dev)?\.com$/.test(host) ||
    /(^|\.)beta\.lovable\.dev$/.test(host) ||
    new URLSearchParams(location.search).get("sw") === "off"
  ) {
    return Promise.reject(new Error("Notifications are available in the published Rooted app."));
  }
  pending ??= navigator.serviceWorker
    .register("/rooted-push-worker.js", { scope: "/", updateViaCache: "none" })
    .then(async (registration) => {
      if (
        registration.active &&
        new URL(registration.active.scriptURL).pathname === "/rooted-push-worker.js"
      )
        return registration;
      await new Promise<void>((resolve, reject) => {
        const worker = registration.installing ?? registration.waiting;
        if (!worker) {
          reject(new Error("Couldn't start notifications. Try again."));
          return;
        }
        const timer = setTimeout(() => {
          worker.removeEventListener("statechange", changed);
          reject(new Error("Notification setup timed out. Try again."));
        }, 15000);
        const changed = () => {
          if (worker.state !== "activated" && worker.state !== "redundant") return;
          clearTimeout(timer);
          worker.removeEventListener("statechange", changed);
          if (worker.state === "activated") resolve();
          else reject(new Error("Couldn't start notifications."));
        };
        worker.addEventListener("statechange", changed);
        changed();
      });
      return registration;
    })
    .catch((error) => {
      pending = undefined;
      throw error;
    });
  return pending;
}
export async function registerRootedOffline() {
  await registerRootedWorker();
}
