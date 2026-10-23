import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/reminders")({
  server: { handlers: { POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendPush } = await import("@/lib/rooted/push.server");
    const due = await supabaseAdmin.rpc("claim_rooted_reminders");
    if (due.error) return Response.json({ error: "Couldn't claim reminders" }, { status: 500 });
    let sent = 0;
    await Promise.all((due.data ?? []).map(async device => {
      try {
        const result = await sendPush(device, device.message);
        if (result.ok) sent++;
        if (result.expired) await supabaseAdmin.from("push_devices").delete().eq("id", device.device_id);
      } catch { /* Do not log endpoints, credentials or private reminder text. */ }
    }));
    return Response.json({ sent });
  } } },
});