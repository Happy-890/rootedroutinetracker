import { lazy, Suspense, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Load the calendar only when a filter is opened.
const Calendar = lazy(() =>
  import("@/components/ui/calendar").then((module) => ({ default: module.Calendar })),
);

function calendarDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function ArchiveDateFilter({
  label,
  value,
  onChange,
  today,
  min,
  max,
  align = "start",
}: {
  label: "From" | "To";
  value: string;
  onChange: (value: string) => void;
  today: string;
  min?: string;
  max?: string;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? calendarDate(value) : undefined;
  const text = !selected
    ? "Any date"
    : value === today
      ? "Today"
      : selected.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          ...(value.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}),
        });
  return (
    <div className="flex min-w-0 items-center rounded-2xl border border-border bg-card shadow-sm transition-colors focus-within:border-primary/60">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${label} date: ${selected ? selected.toLocaleDateString() : "Any date"}`}
            className="flex min-h-14 min-w-0 flex-1 items-center gap-2 rounded-2xl px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
              </span>
              <span className="block truncate text-sm font-semibold">{text}</span>
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align={align}
          sideOffset={8}
          aria-label={`Choose ${label.toLowerCase()} date`}
          className="w-auto max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl p-0 duration-200 motion-reduce:animate-none"
        >
          <Suspense
            fallback={
              <p className="p-6 text-sm text-muted-foreground" role="status">
                Loading calendar…
              </p>
            }
          >
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected ?? calendarDate(min || max || today)}
              captionLayout="dropdown"
              startMonth={new Date(1900, 0)}
              endMonth={calendarDate(today)}
              disabled={[
                { after: calendarDate(max || today) },
                ...(min ? [{ before: calendarDate(min) }] : []),
              ]}
              onSelect={(date) => {
                onChange(date ? dateKey(date) : "");
                setOpen(false);
              }}
              autoFocus
            />
          </Suspense>
        </PopoverContent>
      </Popover>
      {value && (
        <button
          type="button"
          aria-label={`Clear ${label.toLowerCase()} date`}
          onClick={() => onChange("")}
          className="mr-1 flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      )}
    </div>
  );
}
