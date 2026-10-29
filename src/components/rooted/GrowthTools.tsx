import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Info, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useRooted } from "@/lib/rooted/store";
import { ACTIVITY_LABEL, PILLARS, type Activity, type PillarId } from "@/lib/rooted/logic";
import {
  addDays,
  emptyDefinitions,
  emptyReview,
  friendlyDay,
  growthRecord,
  weekStart,
  weekSummary,
  type HabitActivity,
  type Priority,
  type Review,
} from "@/lib/rooted/growth";

// Preserve edits through navigation, account changes and failed saves; hydrate saved cloud data only when no draft exists.
function useGrowthDraft<T>(key: string, saved: T) {
  const r = useRooted();
  const full = `rooted:draft:${r.draftNs}:growth:${key}`;
  const [value, setValue] = useState(saved);
  const active = useRef("");
  const serialized = JSON.stringify(saved);
  useEffect(() => {
    let next = JSON.parse(serialized) as T;
    try {
      const raw = localStorage.getItem(full);
      if (raw) next = JSON.parse(raw) as T;
    } catch {
      /* Fall back to saved cloud data. */
    }
    setValue(next);
    active.current = full;
  }, [full, serialized]);
  const set = (next: T) => {
    if (active.current !== full) return;
    setValue(next);
    try {
      localStorage.setItem(full, JSON.stringify(next));
    } catch {
      toast.warning("Draft storage is unavailable. Save before leaving this page.");
    }
  };
  const savedDraft = (next: T) => {
    if (active.current !== full) return;
    localStorage.removeItem(full);
    setValue(next);
  };
  return [value, set, savedDraft] as const;
}

export function WeeklyReview() {
  const r = useRooted();
  const current = weekStart(r.today);
  const [week, setWeek] = useState(() => addDays(current, -7));
  const summary = weekSummary(r.data, week, r.today);
  const prior = weekSummary(r.data, addDays(week, -7), r.today);
  const points = summary.reduce((n, p) => n + p.completed, 0);
  const previous = prior.reduce((n, p) => n + p.completed, 0);
  // A first recorded week has no comparable prior history; do not imply a measured improvement from zero.
  const hasPrevious = Object.keys(r.data.records).some(
    (key) => key.slice(0, 10) >= addDays(week, -7) && key.slice(0, 10) < week,
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous review week"
          onClick={() => setWeek(addDays(week, -7))}
        >
          <ChevronLeft />
        </Button>
        <div className="text-center">
          <h2 className="text-sm font-bold">
            {friendlyDay(week)} – {friendlyDay(addDays(week, 6))}
          </h2>
          <p className="text-xs text-muted-foreground">
            {week === current ? "This week · so far" : "Weekly review"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next review week"
          disabled={week >= current}
          onClick={() => setWeek(addDays(week, 7))}
        >
          <ChevronRight />
        </Button>
      </div>
      <section className="space-y-3 rounded-2xl bg-card p-4" aria-label="Weekly pillar progress">
        <p className="text-xs text-muted-foreground">
          Pillar habits completed · writing bonuses are separate
        </p>
        {summary.map((p) => (
          <div key={p.id}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-semibold">{p.name}</span>
              <span>
                {p.completed}/{p.possible}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${p.possible ? (p.completed / p.possible) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          {week === current
            ? "Review this week so far; its totals are still growing."
            : hasPrevious
              ? `${points === previous ? "Same number of" : `${Math.abs(points - previous)} ${points > previous ? "more" : "fewer"}`} pillar completions than the previous week.`
              : "No previous recorded week to compare yet."}
        </p>
        <p className="text-xs text-muted-foreground">
          {points === summary.reduce((n, p) => n + p.possible, 0)
            ? "Every pillar habit was completed. What helped you stay consistent?"
            : points
              ? `An area to consider: ${summary.reduce((a, b) => (a.completed <= b.completed ? a : b)).name}. What would help next week?`
              : "No recorded habits this week. You can still reflect and choose a next step."}
        </p>
      </section>
      <ReviewForm key={`${r.draftNs}:${week}`} week={week} />
    </div>
  );
}

function ReviewForm({ week }: { week: string }) {
  const r = useRooted();
  const saved = growthRecord(r.data, "review", week)?.value ?? emptyReview();
  const [value, set, clear] = useGrowthDraft(`review:${week}`, saved);
  const [busy, setBusy] = useState(false);
  const prompts: [keyof Review, string][] = [
    ["worked", "What worked?"],
    ["obstacle", "What got in the way?"],
    ["change", "What will I change next week?"],
    ["commitment", "My one commitment for next week"],
  ];
  return (
    <section className="space-y-3 rounded-2xl bg-card p-4">
      {prompts.map(([key, label]) => (
        <div key={key}>
          <label htmlFor={`review-${key}`} className="text-sm font-semibold">
            {label}
          </label>
          <Textarea
            id={`review-${key}`}
            rows={key === "commitment" ? 2 : 3}
            maxLength={key === "commitment" ? 500 : 2000}
            value={value[key]}
            disabled={busy || !r.dataReady}
            onChange={(e) => set({ ...value, [key]: e.target.value })}
            className="mt-1 bg-surface"
          />
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Private reflection. Your commitment appears in Plan during the following week. Reviews do
        not earn points.
      </p>
      <Button
        className="w-full"
        disabled={busy || !r.dataReady || !!r.dataError}
        onClick={async () => {
          setBusy(true);
          const ok = await r.saveGrowth({ kind: "review", key: week, value });
          setBusy(false);
          if (ok) {
            clear(value);
            toast.success("Weekly review saved");
          } else toast.error("Couldn't save your review. Your draft is kept.");
        }}
      >
        {busy ? "Saving…" : "Save review"}
      </Button>
    </section>
  );
}

export function DailyPriorities() {
  const r = useRooted();
  return <PrioritiesForm key={`${r.draftNs}:${r.today}`} />;
}
function PrioritiesForm() {
  const r = useRooted();
  const saved = growthRecord(r.data, "priorities", r.today)?.value ?? [];
  const [items, set, clear] = useGrowthDraft<Priority[]>(`priorities:${r.today}`, saved);
  const [busy, setBusy] = useState(false);
  const commitment = growthRecord(r.data, "review", addDays(weekStart(r.today), -7))?.value
    .commitment;
  const update = (i: number, changes: Partial<Priority>) =>
    set(items.map((p, index) => (index === i ? { ...p, ...changes } : p)));
  return (
    <section className="space-y-3 rounded-2xl bg-card p-3.5">
      <h2 className="font-extrabold">My three priorities</h2>
      <p className="text-xs text-muted-foreground">
        Choose up to three meaningful actions for today. These do not add points.
      </p>
      {commitment && (
        <p className="whitespace-pre-wrap break-words rounded-xl bg-gold-soft p-3 text-sm">
          <strong>This week's commitment:</strong> {commitment}
        </p>
      )}
      {items.map((p, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-border p-3">
          <div className="flex items-center justify-between">
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={p.done}
                disabled={busy || !r.dataReady}
                onChange={(e) => update(i, { done: e.target.checked })}
                className="size-4 accent-primary"
              />
              Priority {i + 1} complete
            </label>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove priority ${i + 1}`}
              disabled={busy || !r.dataReady}
              onClick={() => set(items.filter((_, index) => index !== i))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <label className="sr-only" htmlFor={`priority-${i}`}>
            Priority {i + 1}
          </label>
          <Input
            id={`priority-${i}`}
            placeholder="One action that matters"
            maxLength={160}
            value={p.title}
            disabled={busy || !r.dataReady}
            onChange={(e) => update(i, { title: e.target.value })}
          />
          <Select
            value={p.pillar || "none"}
            onValueChange={(value) =>
              update(i, { pillar: value === "none" ? "" : (value as Priority["pillar"]) })
            }
            disabled={busy || !r.dataReady}
          >
            <SelectTrigger aria-label={`Pillar for priority ${i + 1}`} className="h-11 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rooted-menu-motion rounded-2xl">
              <SelectItem value="none">No pillar selected</SelectItem>
              {PILLARS.map((pillar) => (
                <SelectItem key={pillar.id} value={pillar.id}>
                  {pillar.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label htmlFor={`priority-when-${i}`} className="block text-xs text-muted-foreground">
            When will I do it? (optional)
          </label>
          <Input
            id={`priority-when-${i}`}
            placeholder="After dinner, I will…"
            maxLength={200}
            value={p.when}
            disabled={busy || !r.dataReady}
            onChange={(e) => update(i, { when: e.target.value })}
          />
        </div>
      ))}
      {items.length < 3 && (
        <Button
          variant="secondary"
          className="w-full"
          disabled={busy || !r.dataReady}
          onClick={() => set([...items, { title: "", pillar: "", when: "", done: false }])}
        >
          <Plus />
          Add priority
        </Button>
      )}
      <Button
        className="w-full"
        disabled={busy || !r.dataReady || !!r.dataError}
        onClick={async () => {
          if (items.some((p) => !p.title.trim())) {
            toast.error("Give each priority a title, or remove the empty one.");
            return;
          }
          const value = items.map((p) => ({ ...p, title: p.title.trim(), when: p.when.trim() }));
          setBusy(true);
          const ok = await r.saveGrowth({ kind: "priorities", key: r.today, value });
          setBusy(false);
          if (ok) {
            clear(value);
            toast.success("Priorities saved");
          } else toast.error("Couldn't save your priorities. Your draft is kept.");
        }}
      >
        {busy ? "Saving…" : "Save priorities"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Save after checking off or editing priorities. Each day starts fresh; past priorities stay
        in History.
      </p>
    </section>
  );
}

const suggestions: Partial<Record<Activity, string>> = {
  bible: "Read a passage and consider its application.",
  prayer: "Set aside intentional time for prayer.",
  marriage: "Give my spouse undivided attention.",
  relationship: "Reach out to someone intentionally.",
  exercise: "Make time for purposeful movement.",
  nutrition: "Follow the food commitment I chose.",
  learn: "Learn something I can put into practice.",
  plan: "Choose my priorities and review my day.",
};
export function HabitDefinitions() {
  const r = useRooted();
  const saved = growthRecord(r.data, "definitions", "personal")?.value ?? emptyDefinitions();
  const [value, set, clear] = useGrowthDraft("definitions", saved);
  const [busy, setBusy] = useState(false);
  return (
    <section id="habit-commitments" className="space-y-3 border-t border-border py-5">
      <h2 className="font-extrabold">My habit commitments</h2>
      <p className="text-sm text-muted-foreground">
        Define what completing each habit means to you. These optional commitments do not change
        scoring.
      </p>
      <label htmlFor="personal-why" className="block text-sm font-semibold">
        Why do these four pillars matter to me?
      </label>
      <Textarea
        id="personal-why"
        rows={3}
        maxLength={1000}
        value={value.why}
        disabled={busy || !r.dataReady}
        onChange={(e) => set({ ...value, why: e.target.value })}
      />
      {PILLARS.map((pillar) => (
        <details key={pillar.id} className="rounded-2xl bg-card p-3">
          <summary className="min-h-8 cursor-pointer text-sm font-bold">{pillar.name}</summary>
          <div className="mt-3 space-y-3">
            {pillar.activities.map((a) => (
              <div key={a}>
                <label htmlFor={`definition-${a}`} className="text-sm font-semibold">
                  {ACTIVITY_LABEL[a]}
                </label>
                <Textarea
                  id={`definition-${a}`}
                  rows={2}
                  maxLength={200}
                  value={value.habits[a as HabitActivity] ?? ""}
                  placeholder={suggestions[a]}
                  disabled={busy || !r.dataReady}
                  onChange={(e) =>
                    set({ ...value, habits: { ...value.habits, [a]: e.target.value } })
                  }
                />
              </div>
            ))}
          </div>
        </details>
      ))}
      <Button
        className="w-full"
        disabled={busy || !r.dataReady || !!r.dataError}
        onClick={async () => {
          setBusy(true);
          const ok = await r.saveGrowth({ kind: "definitions", key: "personal", value });
          setBusy(false);
          if (ok) {
            clear(value);
            toast.success("Habit commitments saved");
          } else toast.error("Couldn't save your commitments. Your draft is kept.");
        }}
      >
        {busy ? "Saving…" : "Save commitments"}
      </Button>
    </section>
  );
}
export function PillarCommitments({ id }: { id: PillarId }) {
  const r = useRooted();
  const definitions = growthRecord(r.data, "definitions", "personal")?.value;
  const pillar = PILLARS.find((p) => p.id === id)!;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${pillar.name} habit commitments`}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="max-w-[calc(100vw-2rem)] space-y-3 rounded-2xl text-sm"
        align="center"
      >
        <h3 className="font-bold">{pillar.name} commitments</h3>
        {pillar.activities.map((a) => (
          <p key={a} className="whitespace-pre-wrap break-words">
            <strong>{ACTIVITY_LABEL[a]}:</strong>{" "}
            {definitions?.habits[a as HabitActivity]?.trim() || suggestions[a]}
          </p>
        ))}
        <Button variant="secondary" size="sm" asChild>
          <Link to="/settings" hash="habit-commitments">
            Set my commitments
          </Link>
        </Button>
      </PopoverContent>
    </Popover>
  );
}
