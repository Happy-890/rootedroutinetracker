import { createServerFn } from "@tanstack/react-start";
import { requireVerifiedAuth } from "./auth.server";

/** Permanently deletes the signed-in user's data and sign-in account. */
export const deleteRootedAccount = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const wipe = await (supabaseAdmin.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }>)(
      "delete_rooted_account_data",
      { p_user: context.userId },
    );
    if (wipe.error) throw new Error("Couldn't delete your data. Nothing was removed from your sign-in.");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error("Your data was deleted, but the sign-in account couldn't be removed. Try again.");
    return { ok: true };
  });
