import { PillarCommitments } from "@/components/rooted/GrowthTools";
import { growthRecord } from "@/lib/rooted/growth";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Check,
  ChartColumnIncreasing,
  ChevronRight,
  Cross,
  Dumbbell,
  NotebookPen,
  Sparkles,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Shell } from "@/components/rooted/Shell";
import { useRooted } from "@/lib/rooted/store";
import {
  ACTIVITY_LABEL,
  MAX_DAILY,
  PILLARS,
  chart,
  dayPoints,
  isDone,
  pillarCount,
  type Activity,
  type Period,
  type PillarId,
} from "@/lib/rooted/logic";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Rooted — Build what matters, daily" },
      {
        name: "description",
        content: "Track Faith, Family, Fitness and Finance habits daily with Rooted.",
      },
      { property: "og:title", content: "Rooted — Build what matters, daily" },
      {
        property: "og:description",
        content: "Track Faith, Family, Fitness and Finance habits daily with Rooted.",
      },
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
  const r = useRooted();
  const priorities = growthRecord(r.data, "priorities", r.today)?.value ?? [];
  return (
    <Shell>
      <ProgressCard />
      <div className="mt-5 flex items-baseline justify-between">
        <h2 className="text-base font-extrabold">4 Pillars</h2>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:gap-3">
        {PILLARS.map((p) => (
          <PillarCard key={p.id} id={p.id} />
        ))}
      </div>
      <h2 className="mt-5 text-base font-extrabold">Bonus Points</h2>
      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:gap-3">
        <BonusButton to="/gratitude" activity="gratitude" label="Add Gratitude" icon={Sparkles} />
        <BonusButton to="/journal" activity="journal" label="Add Journal" icon={NotebookPen} />
      </div>
      <Link to="/finance" search={{tab: "plan"}} className="mt-3 block py-2 text-center text-sm font-semibold text-primary">{priorities.length ? `Today's priorities · ${priorities.filter((p) => p.done).length}/${priorities.length} complete` : "Choose today's priorities"}</Link>
    </Shell>
  );
}

function ProgressCard() {
  const { data, today } = useRooted();
  const [period, setPeriod] = useState<Period>("daily");
  const c = chart(data, today, period);
  const todayPts = dayPoints(data, today);
  const scaleMax = period === "daily" ? MAX_DAILY : Math.max(1, ...c.bars.map((b) => b.value));
  return (
    <section className="rounded-2xl bg-card p-3.5" aria-label="Progress">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-1">
        <Stat label="Today" value={`${todayPts}/${MAX_DAILY}`} />
        <Stat label={c.caption.replace(/\s*\(.*\)/, "")} value={`${c.total} pts`} />
        <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
          <SelectTrigger
            aria-label="Chart period"
            className="h-10 w-28 rounded-full border-transparent bg-surface font-bold"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            align="end"
            sideOffset={6}
            className="rooted-menu-motion min-w-28 rounded-2xl"
          >
            <SelectItem value="daily" className="min-h-11 rounded-xl">
              Day
            </SelectItem>
            <SelectItem value="weekly" className="min-h-11 rounded-xl">
              Week
            </SelectItem>
            <SelectItem value="monthly" className="min-h-11 rounded-xl">
              Month
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div
        key={period}
        className="rooted-chart-motion mt-3 flex h-32 items-end gap-1.5"
        role="img"
        aria-label={`${c.caption}: ${c.bars.map((b) => `${b.title} ${b.value} points`).join(", ")}`}
      >
        {c.bars.map((b) => (
          <div key={b.title} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] font-bold text-muted-foreground">{b.value || ""}</span>
            <div className="flex w-full flex-1 items-end overflow-hidden rounded-md bg-surface">
              <div
                className={cn(
                  "w-full rounded-md transition-[height] duration-500 ease-out motion-reduce:transition-none",
                  b.current ? "bg-gold-gradient" : "bg-teal",
                )}
                style={{ height: `${(b.value / scaleMax) * 100}%` }}
              />
            </div>
            <span
              className={cn(
                "text-[11px] font-bold",
                b.current ? "text-primary" : "text-muted-foreground",
              )}
            >
              {b.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-1.5">
      <div className="text-base font-extrabold leading-tight">{value}</div>
      <div className="truncate text-[10px] leading-tight text-muted-foreground">{label}</div>
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
    <section
      className={cn(
        "rounded-2xl border border-transparent bg-card p-2 transition-colors sm:p-3",
        full && "card-gold",
      )}
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <Icon className={cn("size-[18px] shrink-0", color)} strokeWidth={2.5} />
          <h3 className="truncate text-[15px] font-extrabold">{p.name}</h3>
          <PillarCommitments id={id} />
        </div>
        <span
          className="shrink-0 text-xs font-extrabold text-teal"
          aria-label={`${count} of 2 complete`}
        >
          {count}/2
        </span>
      </div>
      <div className="mt-2 space-y-1.5">
        {p.activities.map((a) =>
          id === "finance" ? (
            <Link
              key={a}
              to="/finance"
              search={{ tab: a as "learn" | "plan" }}
              className={activityClass(isDone(data, today, a))}
            >
              <span className="min-w-0 truncate">{ACTIVITY_LABEL[a]}</span>
              {isDone(data, today, a) ? (
                <DoneMark />
              ) : (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              )}
            </Link>
          ) : (
            <Button
              variant="ghost"
              key={a}
              aria-pressed={isDone(data, today, a)}
              onClick={() => void toggle(a as Activity)}
              className={activityClass(isDone(data, today, a))}
            >
              <span className="min-w-0 truncate">{ACTIVITY_LABEL[a]}</span>
              {isDone(data, today, a) ? (
                <DoneMark />
              ) : (
                <span className="size-[18px] shrink-0 rounded-full border-[1.5px] border-muted-foreground/50" />
              )}
            </Button>
          ),
        )}
      </div>
    </section>
  );
}

function DoneMark() {
  return (
    <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-primary-foreground/15">
      <Check className="size-3" strokeWidth={3.5} />
    </span>
  );
}

function activityClass(done: boolean) {
  return cn(
    "flex h-10 w-full items-center justify-between gap-1.5 rounded-lg px-2.5 text-left text-[13px] font-bold tracking-tight transition-colors",
    done ? "bg-gold-gradient text-primary-foreground" : "bg-surface",
  );
}

function BonusButton({
  to,
  activity,
  label,
  icon: Icon,
}: {
  to: "/gratitude" | "/journal";
  activity: Activity;
  label: string;
  icon: typeof Cross;
}) {
  const { data, today } = useRooted();
  const done = isDone(data, today, activity);
  return (
    <Link
      to={to}
      className={cn(
        "flex min-h-11 items-center gap-2 rounded-lg px-3",
        done ? "bg-gold-gradient text-primary-foreground" : "bg-card",
      )}
    >
      <Icon className={cn("size-[18px] shrink-0", !done && "text-primary")} />
      <span className="flex-1 truncate text-sm font-extrabold">{label}</span>
      {done && <Check className="size-4 shrink-0" strokeWidth={3} />}
    </Link>
  );
}
