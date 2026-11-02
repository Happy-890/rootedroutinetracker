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
  archiveReady: boolean;
  loadArchive: () => Promise<void>;
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

  const identity = useRef<string | null>(null);
  const [archiveReady, setArchiveReady] = useState(false);
  const inflight = useRef(new WeakMap<Repo, Promise<void>>());
  const archiveFlight = useRef(new WeakMap<Repo, Promise<void>>());
  const cacheKey = "rooted:last-greeting";
  const remember = (id: string, name: string) => {
    try { localStorage.setItem(cacheKey, JSON.stringify([id, name])); } catch { /* optional cache */ }
  };
  const loadFrom = useCallback((repo: Repo) => {
    const existing = inflight.current.get(repo);
    if (existing) return existing;
    repoRef.current = repo;
    const work = (async () => {
      try {
        const loaded = repo instanceof CloudRepo ? await repo.load(false) : await repo.load();
        if (repoRef.current !== repo) return;
        setData(previous => repo instanceof CloudRepo ? {...loaded, entries: previous.entries} : loaded);
        if (repo instanceof CloudRepo && identity.current) remember(identity.current, loaded.profile.display_name);
        setDataReady(true);
        setDataError(null);
      } catch (e) {
        if (repoRef.current === repo) setDataError((e as Error).message || "Couldn't load your data.");
      }
    })().finally(() => inflight.current.delete(repo));
    inflight.current.set(repo, work);
    return work;
  }, []);
  const loadArchive = useCallback(async () => {
    const repo = repoRef.current;
    if (!(repo instanceof CloudRepo)) return;
    const active = archiveFlight.current.get(repo);
    if (active) return active;
    const work = (async () => {
      const result = await repo.loadEntries();
      if (repoRef.current !== repo) return;
      if (result.error) throw result.error;
      setData(d => ({...d, entries: result.data as Entry[]}));
      setArchiveReady(true);
    })().catch(() => { if (repoRef.current === repo) setDataError("Couldn't load archives."); })
      .finally(() => archiveFlight.current.delete(repo));
    archiveFlight.current.set(repo, work);
    return work;
  }, []);
  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      queueMicrotask(() => {
        if (!active) return;
        if (session) {
          const uid = session.user.id;
          setEmail(session.user.email ?? null);
          if (identity.current === uid) return;
          identity.current = uid;
          let name = "";
          try {
            const saved = JSON.parse(localStorage.getItem(cacheKey) || "null");
            if (saved?.[0] === uid && typeof saved[1] === "string") name = saved[1];
            else localStorage.removeItem(cacheKey);
          } catch { /* optional cache */ }
          const initial = emptyData();
          initial.profile.display_name = name;
          setData(initial); setDataReady(false); setArchiveReady(false); setDataError(null);
          setUserId(uid); setMode("account");
          void loadFrom(new CloudRepo(uid));
          void reconcileDeviceAccount().catch(() => undefined);
          // Data requests already enforce auth; verify the stored identity in parallel.
          void supabase.auth.getUser().then(({error}) => {
            if (active && identity.current === uid && error?.status === 401)
              void supabase.auth.signOut({scope:"local"});
          }).catch(() => undefined);
        } else {
          identity.current = null; repoRef.current = null;
          setUserId(null); setEmail(null); setData(emptyData()); setDataReady(false);
          setArchiveReady(false); setDataError(null);
          try { localStorage.removeItem(cacheKey); } catch { /* optional cache */ }
          if (event === "SIGNED_OUT") void unsubscribeDeviceLocally().catch(() => undefined);
          if (localStorage.getItem(MODE_KEY) === "guest") {
            setMode("guest"); void loadFrom(new LocalRepo());
          } else setMode("none");
        }
      });
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [loadFrom]);

  // Rollover + refresh on focus
  useEffect(() => {
    const tick = () => setNow(new Date());
    let lastFocus = 0;
    const onFocus = () => {
      tick();
      if (repoRef.current && document.visibilityState === "visible" && Date.now()-lastFocus>1500) { lastFocus=Date.now(); void loadFrom(repoRef.current); }
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
      if (repoRef.current !== repo) return false;
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
      if (ok) { setData((d) => ({ ...d, profile: p })); if(identity.current) remember(identity.current,p.display_name); }
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
    if (window.location.pathname === "/history" && new URLSearchParams(window.location.search).get("view") === "entries") await loadArchive();
  }, [loadFrom, loadArchive]);

  const value: Ctx = {
    mode,
    email,
    userId,
    data,
    dataError,
    archiveReady: mode === "guest" ? dataReady : archiveReady,
    loadArchive,
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
