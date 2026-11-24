import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useRooted } from "@/lib/rooted/store";
import { deleteRootedAccount } from "@/lib/rooted/account.functions";
import { unsubscribeDeviceLocally } from "@/lib/rooted/push-client";

/** Removes every Rooted value saved on this device (guest data, drafts, preferences). */
export function wipeRootedDeviceData() {
  for (const key of Object.keys(localStorage)) if (key.startsWith("rooted:")) localStorage.removeItem(key);
}

export function DangerZone() {
  const r = useRooted();
  const deleteAccount = useServerFn(deleteRootedAccount);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    setBusy(true);
    try {
      if (r.mode === "account") await deleteAccount();
      await unsubscribeDeviceLocally().catch(() => undefined);
      wipeRootedDeviceData();
      if (r.mode === "account") await supabase.auth.signOut({ scope: "local" });
      window.location.assign("/");
    } catch (error) {
      setBusy(false);
      toast.error(error instanceof Error ? error.message : "Couldn't delete your account.");
    }
  }

  return (
    <section className="space-y-3 border-t border-border py-5">
      <h2 className="font-extrabold">Danger zone</h2>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => void r.signOut()}>
          <LogOut />
          {r.mode === "account" ? "Log out" : "Leave guest"}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive">
              <Trash2 />
              Delete account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                You are deleting your entire account. This permanently erases everything attached to your name or this
                phone — habits, points, journal entries, reminders and guest data. This is irreversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={busy}
                onClick={(event) => { event.preventDefault(); void confirmDelete(); }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {busy ? "Deleting…" : "Delete everything"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}
