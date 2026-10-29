import type { GrowthRecord } from "./growth";
// Pure, framework-free rules for Rooted. Everything date-related works on
// local calendar strings (YYYY-MM-DD) derived from an IANA timezone, never on
// elapsed hours, so DST and UTC offsets cannot shift a day.

export const PILLAR_ACTIVITIES = [
  "bible",
  "prayer",
  "marriage",
  "relationship",
  "exercise",
  "nutrition",
  "learn",
  "plan",
] as const;
export const BONUS_ACTIVITIES = ["gratitude", "journal"] as const;
export const ALL_ACTIVITIES = [...PILLAR_ACTIVITIES, ...BONUS_ACTIVITIES] as const;
export type Activity = (typeof ALL_ACTIVITIES)[number];
export const MAX_DAILY = ALL_ACTIVITIES.length; // 10

export const ACTIVITY_LABEL: Record<Activity, string> = {
  bible: "Read Bible",
  prayer: "Prayer",
  marriage: "Marriage",
  relationship: "Relationship",
  exercise: "Exercise",
  nutrition: "Nutrition",
  learn: "Learn",
  plan: "Plan",
  gratitude: "Gratitude",
  journal: "Journal",
};

export type PillarId = "faith" | "family" | "fitness" | "finance";
export const PILLARS: { id: PillarId; name: string; activities: [Activity, Activity] }[] = [
  { id: "faith", name: "Faith", activities: ["bible", "prayer"] },
  { id: "family", name: "Family", activities: ["marriage", "relationship"] },
  { id: "fitness", name: "Fitness", activities: ["exercise", "nutrition"] },
  { id: "finance", name: "Finance", activities: ["learn", "plan"] },
];

export type EntryKind = "learn" | "gratitude" | "journal";
export type JournalType = "freeflow" | "reframe" | "devotional";
export interface Entry {
  id: string;
  kind: EntryKind;
  subtype: string | null;
  content: Record<string, unknown>;
  local_date: string;
  created_at: string;
  updated_at: string;
}
export interface Profile {
  display_name: string;
  timezone: string;
}
export interface RootedData {
  /** Unique activity records keyed `${date}|${activity}` */
  records: Record<string, true>;
  entries: Entry[];
  profile: Profile;
  growth?: GrowthRecord[];
}

export const DEFAULT_TZ = "America/Chicago";

/** Scoring is always Central time, independent of reminder timezone. */
export const scoringDate = (now: Date = new Date()) => localDate(DEFAULT_TZ, now);
export function assertOpenScoringDate(date: string, now: Date = new Date()) {
  if (date !== scoringDate(now)) throw new Error("This scoring day is closed. No catch-up after midnight Central time.");
}

export function reminderDue(timezone: string, deliveryTime: string, lastSent: string | null, now: Date): boolean {
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  return time === deliveryTime && lastSent !== localDate(timezone, now);
}

export function emptyData(): RootedData {
  return { records: {}, entries: [], growth: [], profile: { display_name: "", timezone: DEFAULT_TZ } };
}

export const recordKey = (date: string, a: Activity) => `${date}|${a}`;

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Local calendar date in a timezone for a given instant. */
export function localDate(tz: string, now: Date = new Date()): string {
  const zone = isValidTimeZone(tz) ? tz : DEFAULT_TZ;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => {
    const part = parts.find((p) => p.type === t);
    if (!part) throw new Error("Couldn't determine the local date.");
    return part.value;
  };
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Calendar arithmetic on date strings (UTC-anchored, so no DST effects). */
export function addDays(date: string, n: number): string {
  const [y = 2000, m = 1, d = 1] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
export function weekday(date: string): number {
  const [y = 2000, m = 1, d = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun
}
export function mondayOf(date: string): string {
  const wd = weekday(date);
  return addDays(date, wd === 0 ? -6 : 1 - wd);
}

export function isDone(data: RootedData, date: string, a: Activity) {
  return !!data.records[recordKey(date, a)];
}

/** Idempotent: setting an existing state returns identical records. */
export function applyActivity(data: RootedData, date: string, a: Activity, on: boolean): RootedData {
  const key = recordKey(date, a);
  if (!!data.records[key] === on) return data;
  const records = { ...data.records };
  if (on) records[key] = true;
  else delete records[key];
  return { ...data, records };
}

/** Insert entry by id (idempotent) and award its activity on its own date. */
export function applyNewEntry(data: RootedData, entry: Entry): RootedData {
  const exists = data.entries.some((e) => e.id === entry.id);
  const next = exists ? data : { ...data, entries: [entry, ...data.entries] };
  return applyActivity(next, entry.local_date, entry.kind, true);
}

/** Edit content only; the earned date, kind and creation time never change. */
export function applyEntryEdit(
  data: RootedData,
  id: string,
  patch: { subtype?: string | null; content: Record<string, unknown> },
  nowIso: string,
): RootedData {
  return {
    ...data,
    entries: data.entries.map((e) =>
      e.id === id
        ? { ...e, subtype: patch.subtype ?? e.subtype, content: patch.content, updated_at: nowIso }
        : e,
    ),
  };
}

export function pointsByDate(data: RootedData): Map<string, number> {
  const m = new Map<string, number>();
  for (const key of Object.keys(data.records)) {
    const [date, a] = key.split("|");
    if (!date || !a || !(ALL_ACTIVITIES as readonly string[]).includes(a)) continue;
    m.set(date, Math.min(MAX_DAILY, (m.get(date) ?? 0) + 1));
  }
  return m;
}

export function dayPoints(data: RootedData, date: string): number {
  return ALL_ACTIVITIES.filter((a) => isDone(data, date, a)).length;
}

export function totalPoints(data: RootedData): number {
  let t = 0;
  for (const v of pointsByDate(data).values()) t += v;
  return t;
}

export function pillarCount(data: RootedData, date: string, p: PillarId): number {
  const pillar = PILLARS.find((x) => x.id === p);
  if (!pillar) return 0;
  return pillar.activities.filter((a) => isDone(data, date, a)).length;
}

/**
 * Streak: today counts if it has any point; if today is empty but yesterday
 * qualified, yesterday's streak stays alive until today ends.
 */
export function streak(data: RootedData, today: string): number {
  const pts = pointsByDate(data);
  const q = (d: string) => (pts.get(d) ?? 0) > 0;
  let cursor = q(today) ? today : q(addDays(today, -1)) ? addDays(today, -1) : null;
  let n = 0;
  while (cursor && q(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export type Period = "daily" | "weekly" | "monthly";
export interface Bar {
  label: string;
  value: number;
  max: number;
  current: boolean;
  title: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function chart(data: RootedData, today: string, period: Period): { bars: Bar[]; total: number; caption: string } {
  const pts = pointsByDate(data);
  const sumRange = (start: string, days: number) => {
    let s = 0;
    for (let i = 0; i < days; i++) s += pts.get(addDays(start, i)) ?? 0;
    return s;
  };
  if (period === "daily") {
    const mon = mondayOf(today);
    const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const bars = names.map((label, i) => {
      const d = addDays(mon, i);
      return { label, value: pts.get(d) ?? 0, max: MAX_DAILY, current: d === today, title: d };
    });
    return { bars, total: bars.reduce((a, b) => a + b.value, 0), caption: "This week (Mon–Sun)" };
  }
  if (period === "weekly") {
    const mon = mondayOf(today);
    const bars: Bar[] = [];
    for (let i = 7; i >= 0; i--) {
      const start = addDays(mon, -7 * i);
      const [, m, d] = start.split("-").map(Number);
      bars.push({
        label: `${m}/${d}`,
        value: sumRange(start, 7),
        max: MAX_DAILY * 7,
        current: i === 0,
        title: `Week of ${start}`,
      });
    }
    return { bars, total: bars.reduce((a, b) => a + b.value, 0), caption: "Last 8 weeks" };
  }
  const [ty = 2000, tm = 1] = today.split("-").map(Number);
  const bars: Bar[] = [];
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(Date.UTC(ty, tm - 1 - i, 1));
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth();
    const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    bars.push({
      label: MONTHS[m] ?? "",
      value: sumRange(start, days),
      max: MAX_DAILY * days,
      current: i === 0,
      title: `${MONTHS[m]} ${y}`,
    });
  }
  return { bars, total: bars.reduce((a, b) => a + b.value, 0), caption: "Last 6 months" };
}

export const REFRAME_PROMPTS = [
  "What emotion am I feeling?",
  "What thought or situation triggered this emotion?",
  "Why did I get triggered by this specific thought or situation?",
  "What is the belief I have about myself, that event or another person?",
  "Is this belief true?",
  "Can you be certain this is 100% true?",
  "How does this belief affect me or the people around me? How do I treat others when I believe this?",
  "How could I see myself, this situation or person differently in a way that serves me and the people around me?",
  "What evidence is there to support this new belief?",
];

export const JOURNAL_LABEL: Record<JournalType, string> = {
  freeflow: "Free-Flow",
  reframe: "Re-Frame",
  devotional: "Devotional",
};

/** Merge two datasets without overwriting: union of records, entries by id (existing wins). */
export function mergeData(target: RootedData, incoming: RootedData): RootedData {
  const records = { ...incoming.records, ...target.records };
  const ids = new Set(target.entries.map((e) => e.id));
  const entries = [...target.entries, ...incoming.entries.filter((e) => !ids.has(e.id))];
  return { ...target, records, entries, growth: [...(target.growth ?? []), ...(incoming.growth ?? []).filter((r) => !(target.growth ?? []).some((t) => t.kind === r.kind && t.key === r.key))] };
}

export function newId(): string {
  return crypto.randomUUID();
}
