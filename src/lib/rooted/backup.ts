import { growthRecordSchema } from "./growth";
import { z } from "zod";
import { isValidTimeZone } from "./logic";
import { scheduledReminderSchema } from "./push-validation";

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(+parsed) && parsed.toISOString().slice(0, 10) === value;
  });
const activity = z.enum([
  "bible",
  "prayer",
  "marriage",
  "relationship",
  "exercise",
  "nutrition",
  "learn",
  "plan",
  "gratitude",
  "journal",
]);
export const backupBodySchema = z
  .object({
    growth: z.array(growthRecordSchema).max(50000).optional(),
    format: z.literal("rooted-backup"),
    version: z.literal(2),
    owner_id: z.string().uuid(),
    exported_at: z.string().datetime({ offset: true }),
    profile: z
      .object({
        display_name: z.string().max(200),
        timezone: z.string().max(100).refine(isValidTimeZone),
      })
      .strict(),
    records: z.array(z.object({ local_date: date, activity }).strict()).max(100000),
    entries: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            kind: z.enum(["learn", "gratitude", "journal"]),
            subtype: z.string().nullable(),
            content: z.record(z.unknown()),
            local_date: date,
            created_at: z.string().datetime({ offset: true }),
            updated_at: z.string().datetime({ offset: true }),
          })
          .strict(),
      )
      .max(20000),
    reminders: z
      .array(scheduledReminderSchema.extend({ id: z.string().uuid() }).strict())
      .max(10000),
  })
  .strict();
export type BackupBody = z.infer<typeof backupBodySchema>;
