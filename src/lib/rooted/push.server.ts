import { buildPushPayload } from "@block65/webcrypto-web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { allowedPushEndpoint } from "./push-validation";

const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const decode = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

export async function pushKeys() {
  const seed = process.env['ROOTED_PUSH_SIGNING_SEED'];
  if (!seed) throw new Error("Notifications are not configured yet.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
  const encryptionKey = await crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
  let result = await supabaseAdmin.from("push_signing_config").select("*").eq("id", true).maybeSingle();
  if (result.error) throw new Error("Couldn't load notification configuration.");
  if (!result.data) {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
    if (!jwk.d) throw new Error("Couldn't configure notifications.");
    const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, encryptionKey, new TextEncoder().encode(jwk.d));
    const inserted = await supabaseAdmin.from("push_signing_config").upsert({ id: true, public_key: encode(publicKey), encrypted_private_key: encode(new Uint8Array(encrypted)), iv: encode(iv) }, { onConflict: "id", ignoreDuplicates: true });
    if (inserted.error) throw new Error("Couldn't configure notifications.");
    result = await supabaseAdmin.from("push_signing_config").select("*").eq("id", true).single();
  }
  if (!result.data || result.error) throw new Error("Couldn't configure notifications.");
  const config = result.data;
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(config.iv) }, encryptionKey, decode(config.encrypted_private_key));
  return { publicKey: config.public_key, privateKey: new TextDecoder().decode(clear), subject: "https://rootedroutinetracker.lovable.app" };
}

export async function sendPush(device: { endpoint: string; p256dh: string; auth: string }, message: string) {
  if (!allowedPushEndpoint(device.endpoint)) return { ok: false, expired: true };
  const payload = await buildPushPayload({ data: JSON.stringify({ title: "Rooted", body: message }), options: { ttl: 300, urgency: "normal" } }, { endpoint: device.endpoint, expirationTime: null, keys: { p256dh: device.p256dh, auth: device.auth } }, await pushKeys());
  const response = await fetch(device.endpoint, { ...payload, redirect: "error", signal: AbortSignal.timeout(8000) });
  return { ok: response.ok, expired: response.status === 404 || response.status === 410 };
}