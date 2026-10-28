import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const failure = await authenticateCronRequest(request);
        if (failure) return failure;
        const { deliverDueReminders } = await import("@/lib/rooted/delivery.server");
        try {
          return Response.json(await deliverDueReminders());
        } catch {
          const { logEvent } = await import("@/lib/rooted/log.server");
          await logEvent(null, "Reminder job couldn't claim reminders", "error");
          return Response.json({ error: "Couldn't claim reminders" }, { status: 500 });
        }
      },
    },
  },
});
