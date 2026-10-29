import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportBackup, restoreBackup } from "@/lib/rooted/backup.functions";
import { useRooted } from "@/lib/rooted/store";

export function BackupSettings({ onRestored }: { onRestored: () => void }) {
  const r = useRooted();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function exportData() {
    setBusy(true);
    try {
      const backup =
        r.mode === "account"
          ? await exportBackup()
          : JSON.stringify({ exported_at: new Date().toISOString(), ...r.data }, null, 2);
      const url = URL.createObjectURL(new Blob([backup], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `rooted-backup-${r.today}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't export your data.");
    } finally {
      setBusy(false);
    }
  }
  async function restore(file: File | undefined) {
    if (!file) return;
    if (file.size > 10_000_000) {
      toast.error("This backup is too large to restore here (10 MB maximum).");
      return;
    }
    if (
      !window.confirm(
        "Restore profile settings and merge missing writing, activity and reminders into this account? Existing writing and reminders will be kept. Unsaved edits on this page will close.",
      )
    )
      return;
    setBusy(true);
    try {
      await restoreBackup({ data: { file: await file.text() } });
      await r.reload();
      onRestored();
      toast.success("Backup restored. Existing writing and reminders were kept.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't restore this backup.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <>
      <Button
        variant="secondary"
        className="w-full"
        disabled={busy}
        onClick={() => void exportData()}
      >
        <Download />
        {busy ? "Working…" : "Export my data"}
      </Button>
      {r.mode === "account" && (
        <>
          <input
            ref={input}
            type="file"
            accept=".json,application/json"
            className="hidden"
            aria-label="Choose Rooted backup"
            onChange={(event) => void restore(event.target.files?.[0])}
          />
          <Button
            variant="outline"
            className="mt-2 w-full"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <Upload />
            Restore backup
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Backups include your writing, activity, profile, reminders, reviews, priorities and commitments. Restore uses a verified
            backup exported here for this account. Keep the file private.
          </p>
        </>
      )}
    </>
  );
}
