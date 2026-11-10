import { lazy, Suspense, useState } from "react";
import { Info } from "lucide-react";
import { PILLARS, type PillarId } from "@/lib/rooted/logic";
const Popover = lazy(() =>
  import("./CommitmentPopover").then((m) => ({ default: m.CommitmentPopover })),
);
export function PillarCommitments({ id }: { id: PillarId }) {
  const [opened, setOpened] = useState(false);
  const name = PILLARS.find((p) => p.id === id)!.name;
  const trigger = (
    <button
      type="button"
      onClick={() => setOpened(true)}
      aria-label={opened ? "Loading habit commitments" : name + " habit commitments"}
      aria-busy={opened}
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Info className="size-3.5" />
    </button>
  );
  return opened ? (
    <Suspense fallback={trigger}>
      <Popover id={id} />
    </Suspense>
  ) : (
    trigger
  );
}
