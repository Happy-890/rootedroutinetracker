import { act, render, screen, cleanup } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import {
  HomeSkeleton,
  LaunchCover,
  LaunchProvider,
  useLaunchReady,
  LoadingScreen,
} from "@/components/rooted/LoadingScreen";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
function Ready({ ready }: { ready: boolean }) {
  useLaunchReady(ready);
  return <p>Page</p>;
}
it("keeps the server-rendered sprout for at least 850ms even if ready immediately", () => {
  vi.useFakeTimers();
  const html = renderToString(
    <LaunchProvider>
      <LaunchCover />
    </LaunchProvider>,
  );
  expect(html).toContain('id="rooted-launch"');
  expect(html).toContain("/icons/icon-192.png");
  const { container } = render(
    <LaunchProvider>
      <LaunchCover />
      <Ready ready />
    </LaunchProvider>,
  );
  act(() => vi.advanceTimersByTime(849));
  expect(container.querySelector("#rooted-launch")).not.toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(container.querySelector("#rooted-launch")).toBeNull();
});
it("keeps the same cover until the page is ready and never replays it on background refresh", () => {
  vi.useFakeTimers();
  const view = (ready: boolean) => (
    <LaunchProvider>
      <LaunchCover />
      <Ready ready={ready} />
    </LaunchProvider>
  );
  const { container, rerender } = render(view(false));
  act(() => vi.advanceTimersByTime(2000));
  expect(container.querySelector("#rooted-launch")).not.toBeNull();
  rerender(view(true));
  expect(container.querySelector("#rooted-launch")).toBeNull();
  rerender(view(false));
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
