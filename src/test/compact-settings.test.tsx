import { cleanup, act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentType } from "react";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  load: vi.fn(),
  saveProfile: vi.fn(),
  setAppearance: vi.fn(),
  records: {} as Record<string, true>,
  profile: { display_name: "Harvey", timezone: "America/Chicago" },
}));
vi.mock("@/lib/rooted/store", () => ({
  useRooted: () => ({
    mode: "account",
    userId: "test-user",
    data: { profile: mocks.profile, records: mocks.records, entries: [] },
    today: "2026-10-26",
    toggle: vi.fn(),
    saveProfile: mocks.saveProfile,
    save: { kind: "idle" },
  }),
}));
vi.mock("@/components/rooted/Shell", () => ({
  Shell: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/rooted/AuthScreen", () => ({ AuthForm: () => null }));
vi.mock("@/lib/rooted/appearance", () => ({
  useAppearance: () => ({ appearance: "device", setAppearance: mocks.setAppearance }),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/lib/rooted/reminders.functions", () => ({
  loadScheduledReminders: mocks.load,
  saveScheduledReminder: mocks.save,
  deleteScheduledReminder: vi.fn(),
  testReminder: vi.fn(),
}));
vi.mock("@/lib/rooted/push-client", () => ({
  deviceSubscription: async () => null,
  enableDevice: vi.fn(),
  disableDevice: vi.fn(),
}));
import { ReminderSettings } from "@/components/rooted/ReminderSettings";
import { formatReminderTime } from "@/lib/rooted/reminder-time";
import { Route } from "@/routes/settings";
import { Route as HomeRoute } from "@/routes/index";
const Home = HomeRoute.options.component as ComponentType;
const Settings = Route.options.component as ComponentType;
const reminder = {
  id: "5d2daf6b-d132-4b67-94ac-f54a0cbbca74",
  title: "Morning Focus",
  message: "Start with prayer",
  delivery_time: "08:00",
  timezone: "America/New_York",
  enabled: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.records = {};
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  mocks.load.mockResolvedValue([reminder]);
  mocks.save.mockImplementation(async ({ data }) => data);
  mocks.saveProfile.mockResolvedValue(true);
});
afterEach(cleanup);

describe("Compact settings", () => {
  it("opens an icon-only appearance menu with accessible choices", async () => {
    render(<Settings />);
    const trigger = screen.getByRole("button", { name: "Appearance: Device" });
    expect(trigger).toHaveTextContent("");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const light = await screen.findByRole("menuitemradio", { name: "Light" });
    expect(light).toHaveTextContent("Light"); // screen-reader-only label
    expect(screen.getByRole("menuitemradio", { name: "Device" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    fireEvent.click(light);
    expect(mocks.setAppearance).toHaveBeenCalledWith("light");
  });
  it("changes chart periods from a dropdown without changing today's score", async () => {
    mocks.records = { "2026-10-26|bible": true, "2026-10-25|prayer": true };
    render(<Home />);
    expect(screen.getByText("1/10")).toBeInTheDocument();
    expect(screen.getByText("1 pts")).toBeInTheDocument();
    const trigger = screen.getByRole("combobox", { name: "Chart period" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Month" }));
    expect(screen.getByText("Last 6 months")).toBeInTheDocument();
    expect(screen.getByText("2 pts")).toBeInTheDocument();
    expect(screen.getByText("1/10")).toBeInTheDocument();
  });
  it("shows saved reminders collapsed and preserves their existing timezone", async () => {
    render(<ReminderSettings />);
    const edit = await screen.findByRole("button", { name: "Edit reminder 1" });
    expect(edit).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Delivery log")).not.toBeInTheDocument();
    fireEvent.click(edit);
    expect(edit).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Reminder timezone")).toHaveValue("America/New_York");
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Morning Prayer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(edit).toHaveAttribute("aria-expanded", "false"));
    expect(mocks.save).toHaveBeenCalledWith({
      data: expect.objectContaining({ title: "Morning Prayer", timezone: "America/New_York" }),
    });
  });
  it("keeps failed saves open with the draft intact", async () => {
    mocks.save.mockRejectedValue(new Error("Offline"));
    render(<ReminderSettings />);
    const edit = await screen.findByRole("button", { name: "Edit reminder 1" });
    fireEvent.click(edit);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Keep this draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
    expect(edit).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Title")).toHaveValue("Keep this draft");
  });
  it("auto-saves on blur without a profile save button", async () => {
    render(<Settings />);
    expect(screen.queryByRole("button", { name: "Save profile" })).not.toBeInTheDocument();
    const field = screen.getByLabelText("Display name");
    fireEvent.change(field, { target: { value: "Harvey Miller" } });
    expect(mocks.saveProfile).not.toHaveBeenCalled();
    fireEvent.blur(field);
    await waitFor(() =>
      expect(mocks.saveProfile).toHaveBeenCalledWith({
        display_name: "Harvey Miller",
        timezone: "America/Chicago",
      }),
    );
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });
  it("serializes rapid edits, including reverting to the original value", async () => {
    let finishFirst!: (value: boolean) => void;
    mocks.saveProfile.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finishFirst = resolve;
        }),
    );
    render(<Settings />);
    const field = screen.getByLabelText("Display name");
    fireEvent.change(field, { target: { value: "New name" } });
    fireEvent.blur(field);
    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledTimes(1));
    fireEvent.change(field, { target: { value: "Harvey" } });
    fireEvent.blur(field);
    expect(mocks.saveProfile).toHaveBeenCalledTimes(1);
    await act(async () => {
      finishFirst(true);
    });
    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledTimes(2));
    expect(mocks.saveProfile).toHaveBeenLastCalledWith({
      display_name: "Harvey",
      timezone: "America/Chicago",
    });
  });
  it("allows retry after an unsuccessful profile save", async () => {
    mocks.saveProfile.mockResolvedValueOnce(false);
    render(<Settings />);
    const field = screen.getByLabelText("Display name");
    fireEvent.change(field, { target: { value: "New name" } });
    fireEvent.blur(field);
    await screen.findByText("Not saved — tap away to retry");
    fireEvent.blur(field);
    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });
  it("keeps the editor usable when the time field is cleared", async () => {
    render(<ReminderSettings />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit reminder 1" }));
    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "" } });
    expect(screen.getByText("Set time")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("uses locale defaults for 12-hour and 24-hour times", () => {
    expect(formatReminderTime("20:30", "en-US")).toBe("8:30 PM");
    expect(formatReminderTime("20:30", "en-GB")).toBe("20:30");
  });
});
