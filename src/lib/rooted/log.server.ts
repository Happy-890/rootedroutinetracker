import { describeError } from "@/lib/error-capture";

type Level = "info" | "warning" | "error";

/** Server-side app event log. Never pass endpoints, keys, or private journal/reminder text. */
export async function logEvent(userId: string | null, event: string, level: Level = "info", detail?: unknown) {
  const text = detail === undefined ? null : (typeof detail === "string" ? detail : describeError(detail)).slice(0, 2000);
  const line = `[rooted] ${level} ${event}${text ? `: ${text}` : ""}`;
  if (level === "error") console.error(line); else console.log(line);
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("app_event_logs").insert({ user_id: userId, event, level, detail: text });
  } catch { /* logging must never break the app */ }
}
