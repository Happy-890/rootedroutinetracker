import { WeeklyReview } from "@/components/rooted/GrowthTools";
import { growthRecord } from "@/lib/rooted/growth";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/rooted/Shell";
import { ArchiveDateFilter } from "@/components/rooted/ArchiveDateFilter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRooted } from "@/lib/rooted/store";
import { ACTIVITY_LABEL, ALL_ACTIVITIES, JOURNAL_LABEL, dayPoints, type Entry, type JournalType } from "@/lib/rooted/logic";
import { cn } from "@/lib/utils";

type Search = { view: "activity" | "entries" | "review"; kind: "all" | "learn" | "gratitude" | "journal" };

export const Route = createFileRoute("/history")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    view: s["view"] === "review" ? "review" : s["view"] === "entries" ? "entries" : "activity",
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
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-card p-1">
        {(["activity", "entries", "review"] as const).map((v) => (
          <button key={v} onClick={() => nav({ search: { ...search, view: v }, replace: true })}
            className={cn("min-h-11 rounded-xl text-xs font-bold sm:text-sm", search.view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            {v === "activity" ? "Daily activity" : v === "review" ? "Weekly review" : "Archives"}
          </button>
        ))}
      </div>
      <div className="mt-4">{search.view === "activity" ? <Activity /> : search.view === "review" ? <WeeklyReview /> : <Archives kind={search.kind} setKind={(k) => nav({ search: { ...search, kind: k }, replace: true })} />}</div>
    </Shell>
  );
}

function Activity() {
  const { data } = useRooted();
  const dates = [...new Set([...Object.keys(data.records).map((k) => k.split("|")[0] ?? ""), ...(data.growth ?? []).filter((r) => r.kind === "priorities" && r.value.length).map((r) => r.key)])].sort().reverse();
  if (!dates.length) return <p className="rounded-3xl bg-card p-6 text-center text-muted-foreground">No activity yet. Complete a habit or save priorities to start.</p>;
  return (
    <ul className="space-y-2">
      {dates.map((d) => (
        <li key={d} className="rounded-2xl bg-card p-3">
          <div className="flex justify-between font-bold"><span>{shortDate(d)}</span><span className="text-teal">{dayPoints(data, d)}/10</span></div>
          <p className="mt-1 text-sm text-muted-foreground">{ALL_ACTIVITIES.filter((a) => data.records[`${d}|${a}`]).map((a) => ACTIVITY_LABEL[a]).join(" · ")}</p>
          {!!growthRecord(data, "priorities", d)?.value.length && <div className="mt-3 border-t border-border pt-2"><p className="mb-1 text-xs font-semibold text-muted-foreground">Priorities · no points</p>{growthRecord(data, "priorities", d)?.value.map((p, i) => <p key={i} className="whitespace-pre-wrap break-words text-sm">{p.done ? "✓" : "○"} {p.title}{p.when ? ` · ${p.when}` : ""}</p>)}</div>}
        </li>
      ))}
    </ul>
  );
}

function Archives({ kind, setKind }: { kind: Search["kind"]; setKind: (k: Search["kind"]) => void }) {
  const { data, today } = useRooted();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const list = data.entries
    .filter((e) => kind === "all" || e.kind === kind)
    .filter((e) => (!from || e.local_date >= from) && (!to || e.local_date <= to))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <Select value={kind} onValueChange={(value) => setKind(value as Search["kind"])}>
          <SelectTrigger aria-label="Entry type" className="col-span-2 h-11 rounded-2xl border-border bg-card px-4 font-semibold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent sideOffset={6} className="rooted-menu-motion rounded-2xl">
            <SelectItem value="all" className="min-h-11 rounded-xl">All</SelectItem><SelectItem value="learn" className="min-h-11 rounded-xl">Learn</SelectItem>
            <SelectItem value="gratitude" className="min-h-11 rounded-xl">Gratitude</SelectItem><SelectItem value="journal" className="min-h-11 rounded-xl">Journal</SelectItem>
          </SelectContent>
        </Select>
        <ArchiveDateFilter label="From" value={from} onChange={setFrom} today={today} max={to || today} />
        <ArchiveDateFilter label="To" value={to} onChange={setTo} today={today} min={from} align="end" />
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
        <span className="min-w-0 truncate font-bold">{title}</span>
        <span className="shrink-0 pl-2 text-xs text-muted-foreground">{shortDate(e.local_date)} · {new Date(e.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
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

function shortDate(d: string) {
  const [, m, day] = d.split("-");
  return m && day ? `${Number(m)}/${Number(day)}` : d;
}
