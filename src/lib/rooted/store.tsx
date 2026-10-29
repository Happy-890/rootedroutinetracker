import { putGrowth, type GrowthRecord } from "./growth";
import { toast } from "sonner";
import { reconcileDeviceAccount, releaseDevice, unsubscribeDeviceLocally } from "./push-client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  type Activity,
  type Entry,
  type EntryKind,
  type Profile,
  type RootedData,
  applyActivity,
  applyEntryEdit,
  applyNewEntry,
  emptyData,
  isDone,
  scoringDate,
  newId,
} from "./logic";
import { CloudRepo, GUEST_KEY, LocalRepo, readGuest, type Repo } from "./repo";

type Mode = "loading" | "none" | "guest" | "account";
export type SaveState = { kind: "idle" | "saving" | "saved" | "error"; message?: string };

interface Ctx {
  mode: Mode;
  email: string | null;
  userId: string | null;
  data: RootedData;
  dataError: string | null;
  dataReady: boolean;
  today: string;
  save: SaveState;
  toggle: (a: Activity) => Promise<void>;
  setActivity: (a: Activity, on: boolean) => Promise<boolean>;
  createEntry: (
    kind: EntryKind,
    subtype: string | null,
    content: Record<string, unknown>,
  ) => Promise<boolean>;
  editEntry: (
    id: string,
    subtype: string | null,
    content: Record<string, unknown>,
  ) => Promise<boolean>;
  saveProfile: (p: Profile) => Promise<boolean>;
  saveGrowth: (record: GrowthRecord) => Promise<boolean>;
  startGuest: () => void;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
  guestImportAvailable: boolean;
  importGuest: () => Promise<boolean>;
  draftNs: string;
}

const C = createContext<Ctx | null>(null);
const MODE_KEY = "rooted:mode";
const migratedKey = (uid: string) => `${GUEST_KEY}:imported:${uid}`;

export function RootedProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [data, setData] = useState<RootedData>(emptyData());
  const [dataReady, setDataReady] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [now, setNow] = useState(() => new Date());
  const [importTick, setImportTick] = useState(0);
  const repoRef = useRef<Repo | null>(null);
  const pending = useRef(new Set<string>());

  const today = scoringDate(now);

  const loadFrom = useCallback(async (repo: Repo) => {
    if (repoRef.current !== repo) setDataReady(false);
    repoRef.current = repo;
    try {
      const loaded = await repo.load();
      if (repoRef.current !== repo) return;
      setData(loaded);
      setDataReady(true);
      setDataError(null);
    } catch (e) {
      if (repoRef.current !== repo) return;
      setDataError((e as Error).message || "Couldn't load your data.");
    }
  }, []);

  // Session bootstrap
  useEffect(() => {
    let active = true;
    const apply = (session: { user: { id: string; email?: string } } | null) => {
      if (!active) return;
      if (session) {
        setData(emptyData());
        setUserId(session.user.id);
        setEmail(session.user.email ?? null);
        setMode("account");
        void reconcileDeviceAccount().catch(() => undefined);
        void loadFrom(new CloudRepo(session.user.id));
      } else if (localStorage.getItem(MODE_KEY) === "guest") {
        setUserId(null);
        setEmail(null);
        setMode("guest");
        void loadFrom(new LocalRepo());
      } else {
        repoRef.current = null;
        setUserId(null);
        setEmail(null);
        setData(emptyData());
        setMode("none");
      }
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") void unsubscribeDeviceLocally().catch(() => undefined);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        queueMicrotask(() => apply(session));
      }
    });
    supabase.auth
      .getUser()
      .then(({ data }) => apply(data.user ? { user: data.user } : null))
      .catch(() => apply(null));
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadFrom]);

  // Rollover + refresh on focus
  useEffect(() => {
    const tick = () => setNow(new Date());
    const onFocus = () => {
      tick();
      if (repoRef.current && document.visibilityState === "visible") void loadFrom(repoRef.current);
    };
    const id = setInterval(tick, 30_000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [loadFrom]);

  const run = useCallback(async (fn: (r: Repo) => Promise<void>) => {
    const repo = repoRef.current;
    if (!repo) return false;
    setSave({ kind: "saving" });
    try {
      await fn(repo);
      setSave({ kind: "saved" });
      return true;
    } catch (e) {
      setSave({ kind: "error", message: (e as Error).message || "Couldn't save. Try again." });
      return false;
    }
  }, []);

  const setActivity = useCallback(
    async (a: Activity, on: boolean) => {
      const date = scoringDate();
      const key = `${date}|${a}`;
      if (pending.current.has(key)) return false; // double-tap guard
      pending.current.add(key);
      const previous = isDone(data, date, a);
      setData((d) => applyActivity(d, date, a, on));
      const ok = await run((r) => r.setActivity(date, a, on));
      if (!ok) setData((current) => applyActivity(current, date, a, previous));
      pending.current.delete(key);
      return ok;
    },
    [data, today, run],
  );

  const toggle = useCallback(
    async (a: Activity) => {
      await setActivity(a, !isDone(data, today, a));
    },
    [data, today, setActivity],
  );

  const createEntry = useCallback(
    async (kind: EntryKind, subtype: string | null, content: Record<string, unknown>) => {
      const key = `entry|${kind}`;
      if (pending.current.has(key)) return false;
      pending.current.add(key);
      const ts = new Date().toISOString();
      const entry: Entry = {
        id: newId(),
        kind,
        subtype,
        content,
        local_date: scoringDate(),
        created_at: ts,
        updated_at: ts,
      };
      const ok = await run((r) => r.createEntry(entry));
      if (ok) setData((d) => applyNewEntry(d, entry));
      pending.current.delete(key);
      return ok;
    },
    [today, run],
  );

  const editEntry = useCallback(
    async (id: string, subtype: string | null, content: Record<string, unknown>) => {
      const ok = await run((r) => r.editEntry(id, subtype, content));
      if (ok) setData((d) => applyEntryEdit(d, id, { subtype, content }, new Date().toISOString()));
      return ok;
    },
    [run],
  );

  const saveProfile = useCallback(
    async (p: Profile) => {
      const ok = await run((r) => r.saveProfile(p));
      if (ok) setData((d) => ({ ...d, profile: p }));
      return ok;
    },
    [run],
  );

  const saveGrowth = useCallback(async (record: GrowthRecord) => {
    const repo = repoRef.current;
    const key = `growth|${record.kind}|${record.key}`;
    if (!repo || pending.current.has(key)) return false;
    pending.current.add(key);
    try {
      const ok = await run((r) => r.saveGrowth(record));
      if (ok && repoRef.current === repo) setData((d) => putGrowth(d, record));
      return ok && repoRef.current === repo;
    } finally { pending.current.delete(key); }
  }, [run]);

  const startGuest = useCallback(() => {
    localStorage.setItem(MODE_KEY, "guest");
    setMode("guest");
    setUserId(null);
    setEmail(null);
    void loadFrom(new LocalRepo());
  }, [loadFrom]);

  const signOut = useCallback(async () => {
    localStorage.removeItem(MODE_KEY);
    if (mode === "account") {
      try {
        await releaseDevice();
      } catch {
        const message = "Couldn't disconnect this device's notifications. Try logging out again.";
        setSave({ kind: "error", message });
        toast.error(message);
        return;
      }
      const { error } = await supabase.auth.signOut();
      if (error) {
        setSave({ kind: "error", message: error.message });
        return;
      }
    } else {
      repoRef.current = null;
      setMode("none");
      setData(emptyData());
    }
  }, [mode]);

  const guestImportAvailable = useMemo(() => {
    void importTick;
    if (mode !== "account" || !userId || typeof localStorage === "undefined") return false;
    if (localStorage.getItem(migratedKey(userId))) return false;
    const g = readGuest();
    return !!g && (Object.keys(g.records).length > 0 || g.entries.length > 0 || !!g.growth?.length);
  }, [mode, userId, importTick]);

  const importGuest = useCallback(async () => {
    const g = readGuest();
    if (!g || !userId || !(repoRef.current instanceof CloudRepo)) return false;
    const repo = repoRef.current;
    const ok = await run(() => repo.importGuest(g));
    if (ok) {
      localStorage.setItem(migratedKey(userId), new Date().toISOString());
      setImportTick((t) => t + 1);
      await loadFrom(repo);
    }
    return ok;
  }, [userId, run, loadFrom]);

  const reload = useCallback(async () => {
    if (repoRef.current) await loadFrom(repoRef.current);
  }, [loadFrom]);

  const value: Ctx = {
    mode,
    email,
    userId,
    data,
    dataError,
    dataReady,
    today,
    save,
    toggle,
    setActivity,
    createEntry,
    editEntry,
    saveProfile,
    saveGrowth,
    startGuest,
    signOut,
    reload,
    guestImportAvailable,
    importGuest,
    draftNs: mode === "account" && userId ? `u:${userId}` : "guest",
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useRooted() {
  const c = useContext(C);
  if (!c) throw new Error("useRooted outside provider");
  return c;
}

/** Text drafts survive navigation, type switches, refreshes and failed saves. */
export function useDraft<T>(key: string, initial: T): [T, (v: T) => void, () => void] {
  const { draftNs } = useRooted();
  const full = `rooted:draft:${draftNs}:${key}`;
  const [val, setVal] = useState<T>(initial);
  const loaded = useRef<string | null>(null);
  useEffect(() => {
    const raw = localStorage.getItem(full);
    setVal(raw ? (JSON.parse(raw) as T) : initial);
    loaded.current = full;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full]);
  const set = useCallback(
    (v: T) => {
      setVal(v);
      if (loaded.current === full) localStorage.setItem(full, JSON.stringify(v));
    },
    [full],
  );
  const clear = useCallback(() => {
    localStorage.removeItem(full);
    setVal(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full]);
  return [val, set, clear];
}
