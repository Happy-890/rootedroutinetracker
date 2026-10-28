import { Children, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Keep the actual reminder cards mounted so collapsing never discards a draft. */
export function ReminderStack({ children, editing }: { children: ReactNode; editing: boolean }) {
  const cards = Children.toArray(children);
  const root = useRef<HTMLDivElement>(null);
  const items = useRef<Array<HTMLDivElement | null>>([]);
  const [heights, setHeights] = useState<number[]>([]);
  const [opened, setOpened] = useState(false);
  const multiple = cards.length > 1;
  const expanded = !multiple || opened || editing;

  useEffect(() => {
    if (editing && multiple) setOpened(true);
  }, [editing, multiple]);
  useEffect(() => {
    if (!multiple) setOpened(false);
  }, [multiple]);
  useLayoutEffect(() => {
    if (!multiple) return;
    const measure = () => {
      const next = items.current.slice(0, cards.length).map((item) => item?.offsetHeight ?? 0);
      setHeights((previous) =>
        previous.length === next.length && previous.every((value, i) => value === next[i])
          ? previous
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    items.current.slice(0, cards.length).forEach((item) => {
      if (item) observer.observe(item);
    });
    return () => observer.disconnect();
  }, [multiple, cards.length]);
  useEffect(() => {
    if (!multiple || !opened || editing) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpened(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [multiple, opened, editing]);

  let offset = 0;
  const total =
    heights.reduce((sum, height) => sum + height, 0) + Math.max(0, cards.length - 1) * 12;
  return (
    <div
      ref={root}
      className={multiple ? "rooted-reminder-stack relative isolate" : "space-y-3"}
      style={
        multiple
          ? { height: expanded ? total : (heights[0] ?? 0) + Math.min(cards.length - 1, 2) * 10 }
          : undefined
      }
      data-expanded={expanded}
    >
      {cards.map((card, index) => {
        const top = offset;
        offset += (heights[index] ?? 0) + 12;
        const layer = Math.min(index, 2);
        // Anchor the visible bottom edges; text height must not swallow the peek.
        const stackedTop = index === 0 ? 0 : (heights[0] ?? 0) - (heights[index] ?? 0) + layer * 10;
        const clippedTop = Math.max(0, (heights[0] ?? 0) / 2 - stackedTop);
        return (
          <div
            key={typeof card === "object" && card !== null && "key" in card ? card.key : index}
            ref={(element) => {
              items.current[index] = element;
            }}
            className={
              multiple
                ? "rooted-reminder-stack-card absolute inset-x-0 top-0 origin-top"
                : undefined
            }
            inert={multiple && !expanded}
            aria-hidden={multiple && !expanded && index > 0 ? true : undefined}
            style={
              multiple
                ? {
                    zIndex: cards.length - index,
                    transform: expanded
                      ? `translateY(${top}px) scaleX(1)`
                      : `translateY(${stackedTop}px) scaleX(${1 - layer * 0.035})`,
                    opacity: expanded || index < 3 ? 1 : 0,
                    filter: `brightness(${expanded ? 1 : 1 - layer * 0.06})`,
                    clipPath:
                      expanded || index === 0
                        ? "inset(-16px -100vw -16px -100vw)"
                        : `inset(${clippedTop}px -100vw -16px -100vw)`,
                  }
                : undefined
            }
          >
            {card}
          </div>
        );
      })}
      {multiple && !expanded && (
        <button
          type="button"
          aria-label="Expand reminders"
          aria-expanded="false"
          className="absolute inset-y-0 left-1/2 w-[95vw] -translate-x-1/2 cursor-pointer min-[576px]:left-0 min-[576px]:w-full min-[576px]:translate-x-0 rounded-[1.75rem] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          style={{ zIndex: cards.length + 1 }}
          onClick={() => setOpened(true)}
        />
      )}
    </div>
  );
}
