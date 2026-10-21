import { describe, expect, it } from "vitest";
import { ALL_ACTIVITIES, PILLARS, applyActivity, applyNewEntry, applyEntryEdit, emptyData, dayPoints, totalPoints, streak, localDate, addDays, chart, mergeData, type Entry } from "@/lib/rooted/logic";

const date = "2026-10-21";
const entry = (id: string, subtype = "freeflow"): Entry => ({ id, kind: "journal", subtype, content: { text: "Reflection" }, local_date: date, created_at: `${date}T20:00:00Z`, updated_at: `${date}T20:00:00Z` });
describe("Rooted daily rules", () => {
  it("starts empty with America/Chicago", () => {
    const d = emptyData(); expect(totalPoints(d)).toBe(0); expect(d.profile.timezone).toBe("America/Chicago");
  });
  it("caps ten unique activities per day even after repeated awards", () => {
    let d = emptyData(); for (let i=0; i<3; i++) for (const a of ALL_ACTIVITIES) d = applyActivity(d, date, a, true);
    expect(dayPoints(d, date)).toBe(10); expect(totalPoints(d)).toBe(10);
  });
  it("undo removes one point and rechecking never inflates it", () => {
    let d = applyActivity(emptyData(), date, "bible", true);
    d = applyActivity(d, date, "bible", false); expect(dayPoints(d,date)).toBe(0);
    d = applyActivity(d, date, "bible", true); d = applyActivity(d,date,"bible",true); expect(totalPoints(d)).toBe(1);
  });
  it("duplicate entry ids persist only once", () => {
    const d = applyNewEntry(applyNewEntry(emptyData(),entry("one")),entry("one")); expect(d.entries).toHaveLength(1); expect(totalPoints(d)).toBe(1);
  });
  it("three journal modes share exactly one daily bonus", () => {
    let d=emptyData(); for(const t of ["freeflow","reframe","devotional"]) d=applyNewEntry(d,entry(t,t));
    expect(d.entries).toHaveLength(3); expect(dayPoints(d,date)).toBe(1);
  });
  it("repeat gratitude awards only once", () => {
    let d=emptyData(); for(const id of ["a","b"]) d=applyNewEntry(d,{...entry(id),kind:"gratitude",subtype:null,content:{items:["one","two","three"]}}); expect(dayPoints(d,date)).toBe(1);
  });
  it("editing does not change original earned date or points", () => {
    const d=applyEntryEdit(applyNewEntry(emptyData(),entry("a")),"a",{content:{text:"Changed"}},"2026-10-22T10:00:00Z"); expect(d.entries[0]?.local_date).toBe(date); expect(totalPoints(d)).toBe(1); expect(dayPoints(d,"2026-10-22")).toBe(0);
  });
  it("pillar mapping excludes bonus activities", () => {
    expect(PILLARS.flatMap(p=>p.activities)).toHaveLength(8); expect(PILLARS.flatMap(p=>p.activities)).not.toContain("journal");
  });
  it("any earned activity begins a one-day streak", () => { expect(streak(applyActivity(emptyData(),date,"journal",true),date)).toBe(1); });
  it("consecutive calendar dates grow and yesterday remains active", () => {
    let d=emptyData(); for(const day of ["2026-10-19","2026-10-20"]) d=applyActivity(d,day,"prayer",true);
    expect(streak(d,date)).toBe(2); d=applyActivity(d,date,"bible",true); expect(streak(d,date)).toBe(3);
  });
  it("a full missed day resets the streak", () => { const d=applyActivity(emptyData(),"2026-10-19","bible",true); expect(streak(d,date)).toBe(0); });
  it("Chicago midnight resets checklist but keeps total and history", () => {
    const before=localDate("America/Chicago",new Date("2026-10-22T04:59:59Z")); const after=localDate("America/Chicago",new Date("2026-10-22T05:00:00Z"));
    expect(before).toBe(date); expect(after).toBe("2026-10-22"); const d=applyActivity(emptyData(),before,"bible",true); expect(dayPoints(d,after)).toBe(0); expect(totalPoints(d)).toBe(1);
  });
  it("DST transitions use dates not elapsed hours", () => { expect(localDate("America/Chicago",new Date("2026-11-01T06:30:00Z"))).toBe("2026-11-01"); expect(localDate("America/Chicago",new Date("2026-11-01T07:30:00Z"))).toBe("2026-11-01"); expect(addDays("2026-11-01",1)).toBe("2026-11-02"); });
  it("daily chart is Monday to Sunday with real totals", () => { const c=chart(applyActivity(emptyData(),date,"bible",true),date,"daily"); expect(c.bars.map(b=>b.label)).toEqual(["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]); expect(c.total).toBe(1); });
  it("guest merge keeps existing entries and deduplicates points", () => { const d=applyNewEntry(emptyData(),entry("a")); const m=mergeData(d,d); expect(m.entries).toHaveLength(1); expect(totalPoints(m)).toBe(1); });
});