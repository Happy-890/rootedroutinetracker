import { registerRootedWorker } from "./pwa";
import { registerDevice, notificationKey, ownsDevice, removeDevice } from "./reminders.functions";

async function localSubscription() {
  if (!("serviceWorker" in navigator)) return null;
  // iOS requires the push worker at root scope; check root first, then the legacy scope.
  const root = await navigator.serviceWorker.getRegistration("/");
  const sub = await root?.pushManager.getSubscription();
  if (sub) return sub;
  const legacy = await navigator.serviceWorker.getRegistration("/notifications/");
  return legacy?.pushManager.getSubscription() ?? null;
}
export async function deviceSubscription() {
  const sub = await localSubscription();
  if (!sub || !("Notification" in window) || Notification.permission !== "granted") return null;
  return (await ownsDevice({ data: { endpoint: sub.endpoint } })).owned ? sub : null;
}
export async function reconcileDeviceAccount() {
  const sub = await localSubscription();
  if (sub && !(await ownsDevice({ data: { endpoint: sub.endpoint } })).owned)
    await sub.unsubscribe();
}
export async function unsubscribeDeviceLocally() {
  await (await localSubscription())?.unsubscribe();
}
export async function releaseDevice() {
  const sub = await localSubscription();
  if (!sub) return;
  await removeDevice({ data: { endpoint: sub.endpoint } });
  await sub.unsubscribe();
}
export async function enableDevice() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window))
    throw new Error(
      "Install Rooted on your Home Screen to enable notifications on iPhone (iOS 16.4 or later).",
    );
  if (
    !import.meta.env.PROD ||
    window.self !== window.top ||
    location.hostname.startsWith("id-preview--") ||
    location.hostname.startsWith("preview--")
  )
    throw new Error("Enable notifications in the published Rooted app, not this preview.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error(
      "Notifications are blocked. Allow Rooted notifications in your device settings.",
    );
  const { publicKey } = await notificationKey();
  const bytes = Uint8Array.from(atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  );
  // Unregister the legacy scoped worker so only the root-scope worker remains.
  const legacy = await navigator.serviceWorker.getRegistration("/notifications/");
  if (legacy) {
    await (await legacy.pushManager.getSubscription())?.unsubscribe();
    await legacy.unregister();
  }
  const registration = await registerRootedWorker();
  const sub =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: bytes,
    }));
  await registerDevice({ data: sub.toJSON() });
  return sub;
}
