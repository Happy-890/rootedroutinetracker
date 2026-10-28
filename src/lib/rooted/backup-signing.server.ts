import { backupBodySchema, type BackupBody } from "./backup";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
async function key() {
  const secret =
    process.env["ROOTED_BACKUP_SIGNING_SECRET"] ?? process.env["ROOTED_PUSH_SIGNING_SEED"];
  if (!secret) throw new Error("Backup signing is not configured.");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
const message = (body: unknown) => new TextEncoder().encode(`rooted-backup-v2\0${canonical(body)}`);
export async function signBackup(body: BackupBody) {
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await key(), message(body)));
  return {
    body,
    signature: Array.from(signature, (b) => b.toString(16).padStart(2, "0")).join(""),
  };
}
export async function verifyBackup(file: string, userId: string) {
  let parsed: { body: unknown; signature: string };
  try {
    parsed = JSON.parse(file);
    if (!parsed || typeof parsed.signature !== "string" || !/^[0-9a-f]{64}$/.test(parsed.signature))
      throw new Error();
    const signature = Uint8Array.from(parsed.signature.match(/../g)!, (value) =>
      parseInt(value, 16),
    );
    if (!(await crypto.subtle.verify("HMAC", await key(), signature, message(parsed.body))))
      throw new Error();
  } catch {
    throw new Error("This isn't a verified Rooted backup. Export a new backup from Rooted.");
  }
  const body = backupBodySchema.parse(parsed.body);
  if (body.owner_id !== userId) throw new Error("Sign in to the account that created this backup.");
  return body;
}
