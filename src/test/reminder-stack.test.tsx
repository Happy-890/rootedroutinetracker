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
  expect(stack.style.height).toBe("116px");
  fireEvent.click(screen.getByRole("button", { name: "Expand reminders" }));
  expect(stack.style.height).toBe("464px");
  expect((stack.children[1] as HTMLElement).style.transform).toBe("translateY(112px) scale(1)");
  expect((stack.children[2] as HTMLElement).style.transform).toBe("translateY(324px) scale(1)");
  fireEvent.pointerDown(document.body);
  expect(stack.style.height).toBe("116px");
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
