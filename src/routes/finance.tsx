import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Shell, SaveStatus } from "@/components/rooted/Shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useDraft, useRooted } from "@/lib/rooted/store";
import { isDone } from "@/lib/rooted/logic";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/finance")({
  validateSearch: (s: Record<string, unknown>): { tab: "learn" | "plan" } => ({
    tab: s["tab"] === "plan" ? "plan" : "learn",
  }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Finance — Rooted" },
      { name: "description", content: "Log what you learned and plan your day." },
      { property: "og:title", content: "Finance — Rooted" },
      { property: "og:description", content: "Log what you learned and plan your day." },
    ],
  }),
  component: Finance,
});

function Finance() {
  const { tab } = Route.useSearch();
  return (
    <Shell back title="Finance">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-card p-1" role="tablist">
        {(["learn", "plan"] as const).map((t) => (
          <Link
            key={t}
            to="/finance"
            search={{ tab: t }}
            replace
            role="tab"
            aria-selected={tab === t}
            className={cn("flex h-9 items-center justify-center rounded-lg text-sm font-bold", tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
          >
            {t === "learn" ? "Learn" : "Plan"}
          </Link>
        ))}
      </div>
      <div className="mt-4">{tab === "learn" ? <Learn /> : <Plan />}</div>
    </Shell>
  );
}

function Learn() {
  const { createEntry, data, today } = useRooted();
  const [text, setText, clear] = useDraft("learn", "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const done = isDone(data, today, "learn");

  async function submit() {
    if (!text.trim()) { setErr("Write what you learned first."); return; }
    setErr("");
    setBusy(true);
    const ok = await createEntry("learn", null, { text: text.trim() });
    setBusy(false);
    if (ok) {
      clear();
      toast.success(done ? "Saved to archives (point already earned today)" : "Saved · +1 Learn point");
      navigate({ to: "/" });
    } else toast.error("Couldn't save. Your text is kept — try again.");
  }

  return (
    <div className="space-y-3 rounded-2xl bg-card p-3.5">
      <label htmlFor="learn" className="text-base font-extrabold">What have you learned?</label>
      <Textarea id="learn" placeholder="Write your text here" rows={5} value={text} onChange={(e) => setText(e.target.value)} aria-invalid={!!err} className="bg-surface" />
      {err && <p className="text-sm text-destructive">{err}</p>}
      {done && <p className="text-sm text-teal">Learn point earned today. More entries are welcome.</p>}
      <SaveStatus />
      <Button className="w-full" onClick={submit} disabled={busy}>Submit</Button>
      <Button variant="secondary" className="w-full" asChild>
        <Link to="/history" search={{ view: "entries", kind: "learn" }}>View Archives</Link>
      </Button>
    </div>
  );
}

function Plan() {
  const { setActivity, data, today } = useRooted();
  const done = isDone(data, today, "plan");
  const [checks, setChecks] = useDraft<{ date: string; cal: boolean; quests: boolean }>("plan", { date: "", cal: false, quests: false });
  const state = checks.date === today ? checks : { date: today, cal: false, quests: false };
  const cal = done || state.cal;
  const quests = done || state.quests;
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function finish() {
    setBusy(true);
    const ok = await setActivity("plan", true);
    setBusy(false);
    if (ok) {
      toast.success("Plan complete · +1 point");
      navigate({ to: "/" });
    } else toast.error("Couldn't save. Try again.");
  }

  const Row = ({ k, label, on }: { k: "cal" | "quests"; label: string; on: boolean }) => (
    <button
      role="checkbox"
      aria-checked={on}
      disabled={done}
      onClick={() => setChecks({ ...state, [k]: !on })}
      className={cn("flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-bold", on ? "bg-gold-soft" : "bg-surface")}
    >
      <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px]", on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/60")}>
        {on && <Check className="size-3" strokeWidth={3.5} />}
      </span>
      {label}
    </button>
  );

  return (
    <div className="space-y-3 rounded-2xl bg-card p-3.5">
      <h2 className="text-base font-extrabold">Plan your day</h2>
      <Row k="cal" label="Review your calendar for the day." on={cal} />
      <Row k="quests" label="Review all your quests." on={quests} />
      <SaveStatus />
      {done ? (
        <p className="rounded-xl bg-gold-soft p-2.5 text-center text-sm font-bold text-primary">Plan complete for today ✓</p>
      ) : (
        <Button className="w-full" disabled={!(cal && quests) || busy} onClick={finish}>Done</Button>
      )}
    </div>
  );
}
