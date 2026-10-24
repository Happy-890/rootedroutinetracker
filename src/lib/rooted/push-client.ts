import { registerDevice, removeDevice, notificationKey } from "./reminders.functions";

export async function deviceSubscription() {
  if (!("serviceWorker" in navigator)) return null;
  // iOS requires the push worker at root scope; check root first, then the legacy scope.
  const registration = await navigator.serviceWorker.getRegistration("/") ?? await navigator.serviceWorker.getRegistration("/notifications/");
  return registration?.pushManager.getSubscription() ?? null;
}
export async function enableDevice() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) throw new Error("Install Rooted on your Home Screen to enable notifications on iPhone (iOS 16.4 or later).");
  if (!import.meta.env.PROD || window.self !== window.top || location.hostname.startsWith("id-preview--") || location.hostname.startsWith("preview--")) throw new Error("Enable notifications in the published Rooted app, not this preview.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications are blocked. Allow Rooted notifications in your device settings.");
  const { publicKey } = await notificationKey();
  const bytes = Uint8Array.from(atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
  // Unregister the legacy scoped worker so only the root-scope worker remains.
  const legacy = await navigator.serviceWorker.getRegistration("/notifications/");
  if (legacy) await legacy.unregister();
  const registration = await navigator.serviceWorker.register("/rooted-push-worker.js", { scope: "/" });
  if (!registration.active) await new Promise<void>((resolve, reject) => {
    const worker = registration.installing ?? registration.waiting;
    if (!worker) { reject(new Error("Couldn't enable notifications. Try again.")); return; }
    worker.addEventListener("statechange", () => { if (worker.state === "activated") resolve(); if (worker.state === "redundant") reject(new Error("Couldn't enable notifications.")); });
  });
  const sub = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
  await registerDevice({ data: sub.toJSON() });
  return sub;
}
export async function disableDevice() {
  const sub = await deviceSubscription();
  if (!sub) return;
  await removeDevice({ data: { endpoint: sub.endpoint } });
  await sub.unsubscribe();
}