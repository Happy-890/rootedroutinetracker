import { expect, it } from "vitest";
import { emptyData, totalPoints, mergeData } from "@/lib/rooted/logic";
import {
  addDays,
  growthRecordSchema,
  putGrowth,
  weekStart,
  weekSummary,
} from "@/lib/rooted/growth";
import { LocalRepo } from "@/lib/rooted/repo";

it("uses Monday calendar weeks without DST or year-boundary drift", () => {
  expect(weekStart("2026-11-01")).toBe("2026-10-26");
  expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
  expect(weekStart("2027-01-01")).toBe("2026-12-28");
});
it("counts each pillar separately and excludes bonuses and future days", () => {
  const data = emptyData();
  data.records = {
    "2026-10-26|bible": true,
    "2026-10-26|journal": true,
    "2026-10-27|nutrition": true,
    "2026-10-30|exercise": true,
  };
  const result = weekSummary(data, "2026-10-26", "2026-10-28");
  expect(result.map((p) => [p.completed, p.possible])).toEqual([
    [1, 6],
    [0, 6],
    [1, 6],
    [0, 6],
  ]);
});
it("rejects a fourth priority, empty titles and non-Monday review keys", () => {
  const p = { title: "Walk", pillar: "fitness", when: "After dinner", done: false };
  expect(
    growthRecordSchema.safeParse({ kind: "priorities", key: "2026-10-28", value: [p, p, p, p] })
      .success,
  ).toBe(false);
  expect(
    growthRecordSchema.safeParse({
      kind: "priorities",
      key: "2026-10-28",
      value: [{ ...p, title: " " }],
    }).success,
  ).toBe(false);
  expect(
    growthRecordSchema.safeParse({
      kind: "review",
      key: "2026-10-28",
      value: { worked: "", obstacle: "", change: "", commitment: "" },
    }).success,
  ).toBe(false);
  expect(
    growthRecordSchema.safeParse({ kind: "priorities", key: "2026-02-30", value: [] }).success,
  ).toBe(false);
});
it("persists guest priorities without awarding points or losing existing data", async () => {
  const repo = new LocalRepo("rooted-qa:growth");
  await repo.saveGrowth({
    kind: "priorities",
    key: "2026-10-28",
    value: [{ title: "Walk", pillar: "fitness", when: "After dinner", done: true }],
  });
  const saved = await repo.load();
  expect(saved.growth?.[0]?.value).toHaveLength(1);
  expect(totalPoints(saved)).toBe(0);
  expect(saved.entries).toHaveLength(0);
  localStorage.removeItem("rooted-qa:growth");
});
it("merges growth by kind and date, preserving existing account commitments", () => {
  const account = putGrowth(emptyData(), {
    kind: "definitions",
    key: "personal",
    value: { why: "Account", habits: {} },
  });
  const guest = putGrowth(emptyData(), {
    kind: "definitions",
    key: "personal",
    value: { why: "Guest", habits: {} },
  });
  const merged = mergeData(account, guest);
  expect(merged.growth).toEqual(account.growth);
});
