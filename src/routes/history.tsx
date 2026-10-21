import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/rooted/Shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRooted } from "@/lib/rooted/store";
import { ACTIVITY_LABEL, ALL_ACTIVITIES, JOURNAL_LABEL, dayPoints, type Entry, type JournalType } from "@/lib/rooted/logic";
import { cn } from "@/lib/utils";

type Search = { view: "activity" | "entries"; kind: "all" | "learn" | "gratitude" | "journal" };

export const Route = createFileRoute("/history")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    view: s["view"] === "entries" ? "entries" : "activity",
    kind: (["learn", "gratitude", "journal"] as const).includes(s["kind"] as never) ? (s["kind"] as Search["kind"]) : "all",
  }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "History — Rooted" },
      { name: "description", content: "Your daily activity and archived entries." },
      { property: "og:title", content: "History — Rooted" },
      { property: "og:description", content: "Your daily activity and archived entries." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const search = Route.useSearch();
  const nav = Route.useNavigate();
  return (
    <Shell>
      <h1 className="mb-3 text-xl font-extrabold">History</h1>
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-card p-1">
        {(["activity", "entries"] as const).map((v) => (
          <button key={v} onClick={() => nav({ search: { ...search, view: v }, replace: true })}
            className={cn("min-h-11 rounded-xl font-bold", search.view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            {v === "activity" ? "Daily activity" : "Archives"}
          </button>
        ))}
      </div>
      <div className="mt-4">{search.view === "activity" ? <Activity /> : <Archives kind={search.kind} setKind={(k) => nav({ search: { ...search, kind: k }, replace: true })} />}</div>
    </Shell>
  );
}

function Activity() {
  const { data } = useRooted();
  const dates = [...new Set(Object.keys(data.records).map((k) => k.split("|")[0] ?? ""))].sort().reverse();
  if (!dates.length) return <p className="rounded-3xl bg-card p-6 text-center text-muted-foreground">No activity yet. Complete a habit on Home to start.</p>;
  return (
    <ul className="space-y-2">
      {dates.map((d) => (
        <li key={d} className="rounded-2xl bg-card p-3">
          <div className="flex justify-between font-bold"><span>{d}</span><span className="text-teal">{dayPoints(data, d)}/10</span></div>
          <p className="mt-1 text-sm text-muted-foreground">{ALL_ACTIVITIES.filter((a) => data.records[`${d}|${a}`]).map((a) => ACTIVITY_LABEL[a]).join(" · ")}</p>
        </li>
      ))}
    </ul>
  );
}

function Archives({ kind, setKind }: { kind: Search["kind"]; setKind: (k: Search["kind"]) => void }) {
  const { data } = useRooted();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const list = data.entries
    .filter((e) => kind === "all" || e.kind === kind)
    .filter((e) => (!from || e.local_date >= from) && (!to || e.local_date <= to))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        <select aria-label="Type" value={kind} onChange={(e) => setKind(e.target.value as Search["kind"])} className="h-11 rounded-xl border bg-card px-2">
          <option value="all">All</option><option value="learn">Learn</option><option value="gratitude">Gratitude</option><option value="journal">Journal</option>
        </select>
        <input aria-label="From date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-11 min-w-0 rounded-xl border bg-card px-2" />
        <input aria-label="To date" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-11 min-w-0 rounded-xl border bg-card px-2" />
      </div>
      {list.length === 0 ? <p className="mt-4 rounded-3xl bg-card p-6 text-center text-muted-foreground">No entries found.</p> : (
        <ul className="mt-3 space-y-2">{list.map((e) => <EntryItem key={e.id} e={e} />)}</ul>
      )}
    </div>
  );
}

function fields(e: Entry): { label: string; value: string }[] {
  const c = e.content as { text?: string; items?: string[]; answers?: { q: string; a: string }[] };
  if (c.answers) return c.answers.map((x) => ({ label: x.q, value: x.a }));
  if (c.items) return c.items.map((x, i) => ({ label: `${i + 1}.`, value: x }));
  return [{ label: "", value: c.text ?? "" }];
}

function EntryItem({ e }: { e: Entry }) {
  const { editEntry } = useRooted();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<string[] | null>(null);
  const f = fields(e);
  const title = e.kind === "journal" ? `Journal · ${JOURNAL_LABEL[(e.subtype ?? "freeflow") as JournalType]}` : e.kind === "learn" ? "Learn" : "Gratitude";
  async function saveEdit() {
    if (!edit || edit.some((v) => !v.trim())) { toast.error("Fields can't be empty."); return; }
    const c = e.content as { items?: unknown; answers?: { q: string }[] };
    const content = c.answers ? { answers: c.answers.map((x, i) => ({ q: x.q, a: (edit[i] ?? "").trim() })) } : c.items ? { items: edit.map((v) => v.trim()) } : { text: (edit[0] ?? "").trim() };
    if (await editEntry(e.id, e.subtype, content)) { setEdit(null); toast.success("Updated"); } else toast.error("Couldn't save. Your edits are kept.");
  }
  return (
    <li className="rounded-2xl bg-card p-3">
      <button className="flex min-h-11 w-full items-center justify-between text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="font-bold">{title}</span>
        <span className="text-xs text-muted-foreground">{e.local_date} · {new Date(e.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
      </button>
      {!open && <p className="line-clamp-2 text-sm text-muted-foreground">{f[0]?.value}</p>}
      {open && (
        <div className="mt-2 space-y-2">
          {f.map((x, i) => (
            <div key={i}>
              {x.label && <p className="text-sm font-bold text-muted-foreground">{x.label}</p>}
              {edit ? <Textarea value={edit[i]} onChange={(ev) => setEdit(edit.map((v, j) => (j === i ? ev.target.value : v)))} className="bg-surface" />
                : <p className="whitespace-pre-wrap text-sm">{x.value}</p>}
            </div>
          ))}
          {edit ? (
            <div className="flex gap-2"><Button onClick={saveEdit} className="flex-1">Save</Button><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button></div>
          ) : <Button variant="secondary" size="sm" onClick={() => setEdit(f.map((x) => x.value))}>Edit</Button>}
        </div>
      )}
    </li>
  );
}
