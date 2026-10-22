import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Shell, SaveStatus } from "@/components/rooted/Shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useDraft, useRooted } from "@/lib/rooted/store";
import { JOURNAL_LABEL, REFRAME_PROMPTS, isDone, type JournalType } from "@/lib/rooted/logic";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/journal")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Journal — Rooted" },
      { name: "description", content: "Free-Flow, Re-Frame and Devotional journaling." },
      { property: "og:title", content: "Journal — Rooted" },
      { property: "og:description", content: "Free-Flow, Re-Frame and Devotional journaling." },
    ],
  }),
  component: Journal,
});

const MIN_ANSWER = 2;

function Journal() {
  const { createEntry, data, today } = useRooted();
  const [type, setType] = useDraft<JournalType>("journal:type", "freeflow");
  const [free, setFree, clearFree] = useDraft("journal:freeflow", "");
  const [dev, setDev, clearDev] = useDraft("journal:devotional", "");
  const [rf, setRf, clearRf] = useDraft<string[]>("journal:reframe", REFRAME_PROMPTS.map(() => ""));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const done = isDone(data, today, "journal");

  async function submit() {
    setTried(true);
    let content: Record<string, unknown>;
    if (type === "reframe") {
      if (rf.some((a) => a.trim().length < MIN_ANSWER)) return;
      content = { answers: REFRAME_PROMPTS.map((q, i) => ({ q, a: (rf[i] ?? "").trim() })) };
    } else {
      const t = (type === "freeflow" ? free : dev).trim();
      if (!t) return;
      content = { text: t };
    }
    setBusy(true);
    const ok = await createEntry("journal", type, content);
    setBusy(false);
    if (ok) {
      if (type === "reframe") clearRf();
      else if (type === "freeflow") clearFree();
      else clearDev();
      setTried(false);
      toast.success(done ? "Saved (journal bonus already earned today)" : "Saved · +1 bonus point");
      navigate({ to: "/" });
    } else toast.error("Couldn't save. Your text is kept — try again.");
  }

  return (
    <Shell back title="Journal">
      <h2 className="mb-2 text-sm font-bold text-muted-foreground">Select Type</h2>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-card p-1" role="tablist">
        {(Object.keys(JOURNAL_LABEL) as JournalType[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={type === t}
            onClick={() => { setType(t); setTried(false); }}
            className={cn("h-9 whitespace-nowrap rounded-lg px-1 text-[13px] font-bold", type === t ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
          >
            {JOURNAL_LABEL[t]}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-3 rounded-2xl bg-card p-3.5">
        {type === "reframe" ? (
          REFRAME_PROMPTS.map((q, i) => {
            const bad = tried && (rf[i] ?? "").trim().length < MIN_ANSWER;
            return (
              <div key={i}>
                <label htmlFor={`rf${i}`} className="text-sm font-bold">{i + 1}. {q}</label>
                <Textarea id={`rf${i}`} placeholder="Write your text here" rows={3} value={rf[i] ?? ""} aria-invalid={bad} onChange={(e) => setRf(rf.map((x, j) => (j === i ? e.target.value : x)))} className="mt-1 bg-surface" />
                {bad && <p className="text-sm text-destructive">Please write an answer.</p>}
              </div>
            );
          })
        ) : (
          <div>
            <label htmlFor="je" className="text-sm font-bold">Journal Entry</label>
            <Textarea
              id="je"
              placeholder="Write your text here"
              rows={10}
              value={type === "freeflow" ? free : dev}
              onChange={(e) => (type === "freeflow" ? setFree : setDev)(e.target.value)}
              aria-invalid={tried && !(type === "freeflow" ? free : dev).trim()}
              className="mt-1 bg-surface"
            />
            {tried && !(type === "freeflow" ? free : dev).trim() && <p className="text-sm text-destructive">Write something before submitting.</p>}
          </div>
        )}
        {done && <p className="text-sm text-teal">Journal bonus earned today. Extra entries are saved without extra points.</p>}
        <SaveStatus />
        <Button className="w-full" onClick={submit} disabled={busy}>Submit</Button>
      </div>
    </Shell>
  );
}
