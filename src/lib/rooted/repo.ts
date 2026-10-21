import { supabase } from "@/integrations/supabase/client";
import {
  type Activity,
  type Entry,
  type Profile,
  type RootedData,
  applyActivity,
  applyEntryEdit,
  applyNewEntry,
  emptyData,
  recordKey,
} from "./logic";

export interface Repo {
  load(): Promise<RootedData>;
  setActivity(date: string, a: Activity, on: boolean): Promise<void>;
  createEntry(entry: Entry): Promise<void>;
  editEntry(id: string, subtype: string | null, content: Record<string, unknown>): Promise<void>;
  saveProfile(p: Profile): Promise<void>;
}

export const GUEST_KEY = "rooted:guest:v1";

export function readGuest(): RootedData | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(GUEST_KEY);
  if (!raw) return null;
  try {
    return { ...emptyData(), ...JSON.parse(raw) } as RootedData;
  } catch {
    return null;
  }
}

/** Device-only storage for guest mode. */
export class LocalRepo implements Repo {
  constructor(private key = GUEST_KEY) {}
  private read(): RootedData {
    const raw = localStorage.getItem(this.key);
    if (!raw) return emptyData();
    return { ...emptyData(), ...JSON.parse(raw) };
  }
  private write(d: RootedData) {
    localStorage.setItem(this.key, JSON.stringify(d));
  }
  async load() {
    return this.read();
  }
  async setActivity(date: string, a: Activity, on: boolean) {
    this.write(applyActivity(this.read(), date, a, on));
  }
  async createEntry(entry: Entry) {
    this.write(applyNewEntry(this.read(), entry));
  }
  async editEntry(id: string, subtype: string | null, content: Record<string, unknown>) {
    this.write(applyEntryEdit(this.read(), id, { subtype, content }, new Date().toISOString()));
  }
  async saveProfile(p: Profile) {
    this.write({ ...this.read(), profile: p });
  }
}

function offlineGuard() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new Error("You're offline. This change was not saved.");
  }
}

/** Account storage; row-level security restricts every row to its owner. */
export class CloudRepo implements Repo {
  constructor(private userId: string) {}
  async load(): Promise<RootedData> {
    offlineGuard();
    const [p, r, e] = await Promise.all([
      supabase.from("profiles").select("display_name,timezone").eq("id", this.userId).maybeSingle(),
      supabase.from("activity_records").select("local_date,activity").limit(10000),
      supabase.from("entries").select("*").order("created_at", { ascending: false }).limit(5000),
    ]);
    if (p.error) throw p.error;
    if (r.error) throw r.error;
    if (e.error) throw e.error;
    const records: Record<string, true> = {};
    for (const row of r.data ?? []) records[recordKey(row.local_date, row.activity as Activity)] = true;
    return {
      records,
      entries: (e.data ?? []).map((x) => ({
        id: x.id,
        kind: x.kind as Entry["kind"],
        subtype: x.subtype,
        content: (x.content ?? {}) as Record<string, unknown>,
        local_date: x.local_date,
        created_at: x.created_at,
        updated_at: x.updated_at,
      })),
      profile: p.data ?? { display_name: "", timezone: "America/Chicago" },
    };
  }
  async setActivity(date: string, a: Activity, on: boolean) {
    offlineGuard();
    if (on) {
      const { error } = await supabase
        .from("activity_records")
        .upsert({ user_id: this.userId, local_date: date, activity: a }, {
          onConflict: "user_id,local_date,activity",
          ignoreDuplicates: true,
        });
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("activity_records")
        .delete()
        .eq("user_id", this.userId)
        .eq("local_date", date)
        .eq("activity", a);
      if (error) throw error;
    }
  }
  async createEntry(entry: Entry) {
    offlineGuard();
    const { error } = await supabase.from("entries").upsert(
      {
        id: entry.id,
        user_id: this.userId,
        kind: entry.kind,
        subtype: entry.subtype,
        content: entry.content as never,
        local_date: entry.local_date,
        created_at: entry.created_at,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (error) throw error;
    await this.setActivity(entry.local_date, entry.kind, true);
  }
  async editEntry(id: string, subtype: string | null, content: Record<string, unknown>) {
    offlineGuard();
    const { error } = await supabase
      .from("entries")
      .update({ subtype, content: content as never })
      .eq("id", id);
    if (error) throw error;
  }
  async saveProfile(p: Profile) {
    offlineGuard();
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: this.userId, display_name: p.display_name, timezone: p.timezone });
    if (error) throw error;
  }
  /** One-time, non-destructive import of device data; duplicates are ignored. */
  async importGuest(g: RootedData) {
    offlineGuard();
    const recs = Object.keys(g.records).flatMap((k) => {
      const [local_date, activity] = k.split("|");
      return local_date && activity ? [{ user_id: this.userId, local_date, activity }] : [];
    });
    if (recs.length) {
      const { error } = await supabase
        .from("activity_records")
        .upsert(recs, { onConflict: "user_id,local_date,activity", ignoreDuplicates: true });
      if (error) throw error;
    }
    if (g.entries.length) {
      const { error } = await supabase.from("entries").upsert(
        g.entries.map((e) => ({
          id: e.id,
          user_id: this.userId,
          kind: e.kind,
          subtype: e.subtype,
          content: e.content as never,
          local_date: e.local_date,
          created_at: e.created_at,
        })),
        { onConflict: "id", ignoreDuplicates: true },
      );
      if (error) throw error;
    }
  }
}
