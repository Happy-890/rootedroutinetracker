import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendPush } from "./push.server";
import { logEvent } from "./log.server";

export async function deliverDueReminders() {
  const due = await supabaseAdmin.rpc("claim_rooted_reminders_v3");
  if (due.error) throw new Error("Couldn't claim reminders.");
  let sent = 0;
  // Bounded batches keep the job and push providers from being overwhelmed.
  const queue = [...(due.data ?? [])];
  await Promise.all(
    Array.from({ length: Math.min(5, queue.length) }, async () => {
      for (let device = queue.shift(); device; device = queue.shift()) {
        let ok = false,
          retryable = true,
          status = 0,
          expired = false;
        try {
          const result = await sendPush(device, device.message, device.title, device.reminder_id);
          ({ ok, status, expired } = result);
          retryable = status === 408 || status === 429 || status >= 500;
          await logEvent(
            device.user_id,
            ok ? "Daily reminder sent" : "Daily reminder rejected",
            ok ? "info" : "warning",
            `${result.host} responded ${status}`,
          );
        } catch (error) {
          await logEvent(
            device.user_id,
            "Daily reminder failed; retry scheduled",
            "warning",
            error,
          );
        }
        const finished = await supabaseAdmin.rpc("finish_rooted_delivery", {
          p_reminder_id: device.reminder_id,
          p_device_id: device.device_id,
          p_local_date: device.local_date,
          p_lease_token: device.lease_token,
          p_ok: ok,
          p_retryable: retryable,
          p_status: status,
        });
        if (finished.error || !finished.data)
          await logEvent(device.user_id, "Couldn't record delivery result", "error");
        if (ok) sent++;
        if (expired) await supabaseAdmin.from("push_devices").delete().eq("id", device.device_id);
      }
    }),
  );
  return { sent };
}
