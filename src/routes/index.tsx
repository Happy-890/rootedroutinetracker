import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ChartColumnIncreasing, ChevronRight, Cross, Dumbbell, NotebookPen, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { Shell, SaveStatus } from "@/components/rooted/Shell";
import { useRooted } from "@/lib/rooted/store";
import {
  ACTIVITY_LABEL, MAX_DAILY, PILLARS, chart, dayPoints, isDone, pillarCount, totalPoints,
  type Activity, type Period, type PillarId,
} from "@/lib/rooted/logic";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Rooted — Build what matters, daily" },
      { name: "description", content: "Track Faith, Family, Fitness and Finance habits daily with Rooted." },
      { property: "og:title", content: "Rooted — Build what matters, daily" },
      { property: "og:description", content: "Track Faith, Family, Fitness and Finance habits daily with Rooted." },
    ],
  }),
  component: Home,
});

const ICONS: Record<PillarId, { icon: typeof Cross; color: string }> = {
  faith: { icon: Cross, color: "text-teal" },
  family: { icon: Users, color: "text-coral" },
  fitness: { icon: Dumbbell, color: "text-cyan" },
  finance: { icon: ChartColumnIncreasing, color: "text-gold" },
};

function Home() {
  return (
    <Shell>
      <ProgressCard />
      <div className="mt-6 flex items-baseline justify-between">
        <h2 className="text-lg font-extrabold">4 Pillars</h2>
        <SaveStatus />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {PILLARS.map((p) => <PillarCard key={p.id} id={p.id} />)}
      </div>
      <h2 className="mt-6 text-lg font-extrabold">Bonus Points</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <BonusButton to="/gratitude" activity="gratitude" label="Add Gratitude" icon={Sparkles} />
        <BonusButton to="/journal" activity="journal" label="Add Journal" icon={NotebookPen} />
      </div>
    </Shell>
  );
}

function ProgressCard() {
  const { data, today } = useRooted();
  const [period, setPeriod] = useState<Period>("daily");
  const c = chart(data, today, period);
  const todayPts = dayPoints(data, today);
  const top = Math.max(...c.bars.map((b) => b.max));
  const scaleMax = period === "daily" ? MAX_DAILY : Math.max(1, ...c.bars.map((b) => b.value));
  return (
    <section className="rounded-3xl bg-card p-4" aria-labelledby="progress-h">
      <div className="flex items-center justify-between">
        <h2 id="progress-h" className="text-lg font-extrabold">Progress</h2>
        <label className="sr-only" htmlFor="period">Chart period</label>
        <select
          id="period"
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          className="h-11 rounded-xl border bg-surface px-3 font-bold"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Today" value={`${todayPts}/${MAX_DAILY}`} />
        <Stat label={c.caption} value={String(c.total)} />
        <Stat label="All-time" value={`${totalPoints(data)} P`} />
      </div>
      <div
        className="mt-4 flex h-36 items-end gap-1.5"
        role="img"
        aria-label={`${c.caption}: ${c.bars.map((b) => `${b.title} ${b.value} points`).join(", ")}`}
      >
        {c.bars.map((b) => (
          <div key={b.title} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] font-bold text-muted-foreground">{b.value || ""}</span>
            <div className="flex w-full flex-1 items-end rounded-lg bg-surface">
              <div
                className={cn("w-full rounded-lg", b.current ? "bg-gold-gradient" : "bg-teal")}
                style={{ height: `${(b.value / scaleMax) * 100}%` }}
              />
            </div>
            <span className={cn("text-[11px] font-bold", b.current ? "text-primary" : "text-muted-foreground")}>{b.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {period === "daily" ? `Daily max ${MAX_DAILY} points` : `Bars scaled to highest period · max possible ${top} per bar`}
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface px-2 py-2">
      <div className="text-lg font-extrabold">{value}</div>
      <div className="text-[11px] leading-tight text-muted-foreground">{label}</div>
    </div>
  );
}

function PillarCard({ id }: { id: PillarId }) {
  const { data, today, toggle } = useRooted();
  const p = PILLARS.find((x) => x.id === id);
  if (!p) return null;
  const count = pillarCount(data, today, id);
  const full = count === 2;
  const { icon: Icon, color } = ICONS[id];
  return (
    <section className={cn("rounded-3xl border-2 border-transparent bg-card p-3 transition-colors", full && "card-gold")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn("size-6", color)} strokeWidth={2.5} />
          <h3 className="font-extrabold">{p.name}</h3>
        </div>
        <span className="text-sm font-extrabold text-teal" aria-label={`${count} of 2 complete`}>{count}/2</span>
      </div>
      <div className="mt-3 space-y-2">
        {p.activities.map((a) =>
          id === "finance" ? (
            <Link
              key={a}
              to="/finance"
              search={{ tab: a as "learn" | "plan" }}
              className={activityClass(isDone(data, today, a))}
            >
              <span className="min-w-0 whitespace-normal">{ACTIVITY_LABEL[a]}</span>
              {isDone(data, today, a) ? <Check className="size-5 shrink-0" strokeWidth={3} /> : <ChevronRight className="size-5 shrink-0" />}
            </Link>
          ) : (
            <Button variant="ghost"
              key={a}
              aria-pressed={isDone(data, today, a)}
              onClick={() => void toggle(a as Activity)}
              className={activityClass(isDone(data, today, a))}
            >
              <span className="min-w-0 whitespace-normal">{ACTIVITY_LABEL[a]}</span>
              {isDone(data, today, a) ? <Check className="size-5 shrink-0" strokeWidth={3} /> : <span className="size-5 shrink-0 rounded-md border-2 border-muted-foreground/50" />}
            </Button>
          ),
        )}
      </div>
    </section>
  );
}

function activityClass(done: boolean) {
  return cn(
    "flex h-auto min-h-11 w-full items-center justify-between gap-1 rounded-xl px-3 text-left text-sm font-bold transition-all active:scale-[0.98]",
    done ? "bg-gold-gradient text-primary-foreground" : "bg-surface",
  );
}

function BonusButton({ to, activity, label, icon: Icon }: { to: "/gratitude" | "/journal"; activity: Activity; label: string; icon: typeof Cross }) {
  const { data, today } = useRooted();
  const done = isDone(data, today, activity);
  return (
    <Link to={to} className={cn("flex min-h-16 flex-col justify-center rounded-3xl p-3", done ? "bg-gold-gradient text-primary-foreground" : "bg-card")}>
      <div className="flex items-center justify-between">
        <Icon className={cn("size-5", !done && "text-primary")} />
        {done && <Check className="size-5" strokeWidth={3} />}
      </div>
      <span className="mt-1 font-extrabold">{label}</span>
      <span className="text-xs opacity-80">{done ? "+1 earned today" : "+1 point"}</span>
    </Link>
  );
}
