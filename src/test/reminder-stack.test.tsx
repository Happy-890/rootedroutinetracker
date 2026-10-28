import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ReminderStack } from "@/components/rooted/ReminderStack";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("reserves the right space for stacked and expanded cards of different heights", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    return Number(this.firstElementChild?.getAttribute("data-height") ?? 0);
  });
  const { container } = render(
    <ReminderStack editing={false}>
      <article key="a" data-height="100">
        First
      </article>
      <article key="b" data-height="200">
        Second
      </article>
      <article key="c" data-height="140">
        Third
      </article>
    </ReminderStack>,
  );
  const stack = container.firstElementChild as HTMLElement;
  expect(stack.style.height).toBe("120px");
  fireEvent.click(screen.getByRole("button", { name: "Expand reminders" }));
  expect(stack.style.height).toBe("464px");
  expect((stack.children[1] as HTMLElement).style.transform).toBe("translateY(112px) scaleX(1)");
  expect((stack.children[2] as HTMLElement).style.transform).toBe("translateY(324px) scaleX(1)");
  fireEvent.pointerDown(document.body);
  expect(stack.style.height).toBe("120px");
});

it("keeps a single reminder directly available without a stack button", () => {
  render(
    <ReminderStack editing={false}>
      <article>
        <button>Edit single reminder</button>
      </article>
    </ReminderStack>,
  );
  expect(screen.queryByRole("button", { name: "Expand reminders" })).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Edit single reminder" }).closest("[inert]"),
  ).toBeNull();
});

// These are visual edge guarantees, including the short-back-card regression.
it.each([
  [280, 90, 130],
  [110, 110, 110],
  [100, 200, 140],
])("keeps two visible bottom edges with card heights %i, %i, %i", (front, second, third) => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    return Number(this.firstElementChild?.getAttribute("data-height") ?? 0);
  });
  const { container } = render(
    <ReminderStack editing={false}>
      {[front, second, third].map((height, i) => (
        <article key={i} data-height={height}>
          Reminder
        </article>
      ))}
    </ReminderStack>,
  );
  const stack = container.firstElementChild as HTMLElement;
  [second, third].forEach((height, i) => {
    const layer = stack.children[i + 1] as HTMLElement;
    const y = Number(layer.style.transform.match(/translateY\(([-.\d]+)px\)/)?.[1]);
    expect(y + height - front).toBe((i + 1) * 10);
    expect(layer.style.clipPath).toContain("-16px -100vw)"); // bottom shadow remains visible
  });
  expect(stack.style.height).toBe(`${front + 20}px`);
});
