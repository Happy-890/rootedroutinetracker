import { z } from "zod";
import { PILLARS, type RootedData } from "./logic";

export const calendarDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T12:00:00Z`);
    return !Number.isNaN(+d) && d.toISOString().slice(0, 10) === s;
  });
const habit = z.enum([
  "bible",
  "prayer",
  "marriage",
  "relationship",
  "exercise",
  "nutrition",
  "learn",
  "plan",
]);
export const prioritySchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    pillar: z.enum(["", "faith", "family", "fitness", "finance"]),
    when: z.string().trim().max(200),
    done: z.boolean(),
  })
  .strict();
export const growthRecordSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("review"),
      key: calendarDay.refine((d) => weekStart(d) === d),
      value: z
        .object({
          worked: z.string().max(2000),
          obstacle: z.string().max(2000),
          change: z.string().max(2000),
          commitment: z.string().max(500),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("priorities"),
      key: calendarDay,
      value: z.array(prioritySchema).max(3),
    })
    .strict(),
  z
    .object({
      kind: z.literal("definitions"),
      key: z.literal("personal"),
      value: z
        .object({
          why: z.string().max(1000),
          habits: z.record(habit, z.string().max(200)),
        })
        .strict(),
    })
    .strict(),
]);
export type GrowthRecord = z.infer<typeof growthRecordSchema>;
export type Priority = z.infer<typeof prioritySchema>;
export type Review = Extract<GrowthRecord, { kind: "review" }>["value"];
export const emptyReview = (): Review => ({ worked: "", obstacle: "", change: "", commitment: "" });
export type HabitActivity = z.infer<typeof habit>;
export const emptyDefinitions = (): Extract<GrowthRecord, { kind: "definitions" }>["value"] => ({
  why: "",
  habits: {},
});
export function growthRecord<K extends GrowthRecord["kind"]>(
  data: RootedData,
  kind: K,
  key: string,
) {
  return data.growth?.find((r) => r.kind === kind && r.key === key) as
    Extract<GrowthRecord, { kind: K }> | undefined;
}
export function putGrowth(data: RootedData, record: GrowthRecord): RootedData {
  return {
    ...data,
    growth: [
      ...(data.growth ?? []).filter((r) => r.kind !== record.kind || r.key !== record.key),
      record,
    ],
  };
}
export function addDays(day: string, days: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function weekStart(day: string) {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}
export function weekSummary(data: RootedData, start: string, today: string) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter((d) => d <= today);
  return PILLARS.map((pillar) => ({
    ...pillar,
    possible: days.length * 2,
    completed: days.reduce(
      (n, d) => n + pillar.activities.filter((a) => data.records[`${d}|${a}`]).length,
      0,
    ),
  }));
}
export function friendlyDay(day: string) {
  return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
