import { Link } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useRooted } from "@/lib/rooted/store";
import { ACTIVITY_LABEL, PILLARS, type Activity, type PillarId } from "@/lib/rooted/logic";
import { growthRecord, type HabitActivity } from "@/lib/rooted/growth";
import { suggestions } from "./habit-suggestions";
export function CommitmentPopover({ id }: { id: PillarId }) {
  const r = useRooted();
  const definitions = growthRecord(r.data, "definitions", "personal")?.value;
  const pillar = PILLARS.find((p) => p.id === id)!;
  return (
    <Popover defaultOpen>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${pillar.name} habit commitments`}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="max-w-[calc(100vw-2rem)] space-y-3 rounded-2xl text-sm"
        align="center"
      >
        <h3 className="font-bold">{pillar.name} commitments</h3>
        {pillar.activities.map((a) => (
          <p key={a} className="whitespace-pre-wrap break-words">
            <strong>{ACTIVITY_LABEL[a]}:</strong>{" "}
            {definitions?.habits[a as HabitActivity]?.trim() || suggestions[a]}
          </p>
        ))}
        <Button variant="secondary" size="sm" asChild>
          <Link to="/settings" hash="habit-commitments">
            Set my commitments
          </Link>
        </Button>
      </PopoverContent>
    </Popover>
  );
}
