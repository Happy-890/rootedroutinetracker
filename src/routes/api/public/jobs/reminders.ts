import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/reminders")({
  server: { handlers: { POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendPush } = await import("@/lib/rooted/push.server");
    const { logEvent } = await import("@/lib/rooted/log.server");
    const due = await supabaseAdmin.rpc("claim_rooted_reminders");
    if (due.error) { await logEvent(null, "Reminder job couldn't claim reminders", "error", due.error.message); return Response.json({ error: "Couldn't claim reminders" }, { status: 500 }); }
    const ids = (due.data ?? []).map(d => d.device_id);
    const owners = new Map<string, string>();
    if (ids.length) for (const row of (await supabaseAdmin.from("push_devices").select("id,user_id").in("id", ids)).data ?? []) owners.set(row.id, row.user_id);
    let sent = 0;
    await Promise.all((due.data ?? []).map(async device => {
      try {
        const result = await sendPush(device, device.message);
        if (result.ok) sent++;
        if (result.expired) await supabaseAdmin.from("push_devices").delete().eq("id", device.device_id);
        await logEvent(owners.get(device.device_id) ?? null, result.ok ? "Daily reminder sent" : "Daily reminder rejected", result.ok ? "info" : "error", `${result.host} responded ${result.status}${result.expired ? " (device removed)" : ""}`);
      } catch (error) {
        await logEvent(owners.get(device.device_id) ?? null, "Daily reminder failed", "error", error);
      }
    }));
    return Response.json({ sent });
  } } },
});
