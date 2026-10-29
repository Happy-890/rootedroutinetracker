import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireVerifiedAuth } from "./auth.server";
import { backupBodySchema } from "./backup";
import type { Json } from "@/integrations/supabase/types";

export const exportBackup = createServerFn({ method: "GET" })
  .middleware([requireVerifiedAuth])
  .handler(async ({ context }) => {
    // One database snapshot keeps writing and its awarded activity consistent.
    const result = await context.supabase.rpc("export_rooted_growth_backup_data");
    if (
      result.error ||
      !result.data ||
      typeof result.data !== "object" ||
      Array.isArray(result.data)
    )
      throw new Error("Couldn't export your account. Try again.");
    const body = backupBodySchema.parse({
      ...result.data,
      format: "rooted-backup",
      version: 2,
      owner_id: context.userId,
      exported_at: new Date().toISOString(),
    });
    const { signBackup } = await import("./backup-signing.server");
    const file = JSON.stringify(await signBackup(body), null, 2);
    if (new TextEncoder().encode(file).byteLength > 10_000_000)
      throw new Error(
        "This backup exceeds the supported 10 MB size. Contact support for a full export.",
      );
    return file;
  });
export const restoreBackup = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .validator((input) => z.object({ file: z.string().max(10_000_000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { verifyBackup } = await import("./backup-signing.server");
    const backup = await verifyBackup(data.file, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin.rpc("restore_rooted_backup", {
      p_user_id: context.userId,
      p_backup: backup as unknown as Json,
    });
    if (result.error) throw new Error("Couldn't restore this backup. No changes were saved.");
    return { ok: true };
  });
