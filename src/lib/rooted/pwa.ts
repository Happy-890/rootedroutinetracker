/** Only published, top-level Rooted may register the app-shell worker. */
export async function registerRootedOffline() {
  if (!("serviceWorker" in navigator)) return;
  const host = window.location.hostname;
  const refused = !import.meta.env.PROD || window.self !== window.top ||
    host.startsWith("id-preview--") || host.startsWith("preview--") ||
    /(^|\.)lovableproject(-dev)?\.com$/.test(host) ||
    /(^|\.)beta\.lovable\.dev$/.test(host) ||
    new URLSearchParams(window.location.search).get("sw") === "off";
  if (refused) {
    for (const registration of await navigator.serviceWorker.getRegistrations()) {
      const worker = registration.active ?? registration.waiting ?? registration.installing;
      if (worker && new URL(worker.scriptURL).pathname === "/sw.js") await registration.unregister();
    }
    return;
  }
  const { registerSW } = await import("virtual:pwa-register");
  registerSW({ immediate: true });
}