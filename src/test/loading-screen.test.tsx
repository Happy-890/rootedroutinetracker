import { act, render, screen, cleanup } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { HomeSkeleton, LaunchCover, LoadingScreen } from "@/components/rooted/LoadingScreen";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("puts the local sprout into initial server HTML and releases the cover after hydration", () => {
  const html = renderToString(<LaunchCover />);
  expect(html).toContain('id="rooted-launch"');
  expect(html).toContain("/icons/icon-192.png");
  expect(html).not.toContain("https://");
  const { container } = render(<LaunchCover />);
  expect(container.querySelector("#rooted-launch")).toBeNull();
});
it("offers recovery after a slow load without inventing progress", () => {
  vi.useFakeTimers();
  render(<LoadingScreen />);
  expect(screen.queryByRole("button")).toBeNull();
  act(() => vi.advanceTimersByTime(10000));
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
});
it("marks home placeholders as loading rather than showing fake account values", () => {
  render(<HomeSkeleton />);
  expect(screen.getByRole("status", { name: "Loading today's progress" })).toBeTruthy();
  expect(screen.queryByText("0")).toBeNull();
});
