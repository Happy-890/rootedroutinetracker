import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Shell, SaveStatus } from "@/components/rooted/Shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useDraft, useRooted } from "@/lib/rooted/store";
import { isDone } from "@/lib/rooted/logic";

export const Route = createFileRoute("/gratitude")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Gratitude — Rooted" },
      { name: "description", content: "Write three things you are grateful for." },
      { property: "og:title", content: "Gratitude — Rooted" },
      { property: "og:description", content: "Write three things you are grateful for." },
    ],
  }),
  component: Gratitude,
});

function Gratitude() {
  const { createEntry, data, today } = useRooted();
  const [items, setItems, clear] = useDraft<string[]>("gratitude", ["", "", ""]);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const done = isDone(data, today, "gratitude");

  async function submit() {
    setTried(true);
    if (items.some((i) => !i.trim())) return;
    setBusy(true);
    const ok = await createEntry("gratitude", null, { items: items.map((i) => i.trim()) });
    setBusy(false);
    if (ok) {
      clear();
      toast.success(done ? "Saved (bonus already earned today)" : "Saved · +1 bonus point");
      navigate({ to: "/" });
    } else toast.error("Couldn't save. Your text is kept — try again.");
  }

  return (
    <Shell back title="Gratitude">
      <div className="space-y-3 rounded-3xl bg-card p-4">
        <h2 className="text-lg font-extrabold">Write 3 things that you are grateful for.</h2>
        {items.map((v, i) => (
          <div key={i}>
            <label htmlFor={`g${i}`} className="text-sm font-bold text-muted-foreground">{i + 1}.</label>
            <Textarea
              id={`g${i}`}
              placeholder="I am grateful for..."
              rows={2}
              value={v}
              aria-invalid={tried && !v.trim()}
              onChange={(e) => setItems(items.map((x, j) => (j === i ? e.target.value : x)))}
              className="bg-surface"
            />
            {tried && !v.trim() && <p className="text-sm text-destructive">Required</p>}
          </div>
        ))}
        {done && <p className="text-sm text-teal">Gratitude bonus earned today.</p>}
        <SaveStatus />
        <Button className="w-full" onClick={submit} disabled={busy}>Submit</Button>
      </div>
    </Shell>
  );
}
