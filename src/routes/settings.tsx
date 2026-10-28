import { BackupSettings } from "@/components/rooted/BackupSettings";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/rooted/Shell";
import { AuthForm } from "@/components/rooted/AuthScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRooted } from "@/lib/rooted/store";
import { isValidTimeZone } from "@/lib/rooted/logic";
import { useAppearance, type Appearance } from "@/lib/rooted/appearance";
import { Sun, Moon, Monitor, UserRound, LogOut, Sprout, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ReminderSettings } from "@/components/rooted/ReminderSettings";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Settings — Rooted" },
      {
        name: "description",
        content: "Manage Rooted reminders, appearance, profile and private backups.",
      },
      { property: "og:title", content: "Settings — Rooted" },
      {
        property: "og:description",
        content: "Manage Rooted reminders, appearance, profile and private backups.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const r = useRooted();
  const [backupRevision, setBackupRevision] = useState(0);
  const { appearance, setAppearance } = useAppearance();
  const appearanceOptions = [
    { value: "light", label: "Light", Icon: Sun },
    { value: "dark", label: "Dark", Icon: Moon },
    { value: "device", label: "Device", Icon: Monitor },
  ] as const;
  const selectedAppearance = appearanceOptions.find((option) => option.value === appearance)!;
  const AppearanceIcon = selectedAppearance.Icon;
  const [name, setName] = useState(r.data.profile.display_name);
  const [tz, setTz] = useState(r.data.profile.timezone);
  const lastSaved = useRef(r.data.profile);
  const queue = useRef(Promise.resolve());
  const requested = useRef<typeof r.data.profile | null>(null);
  const pendingSaves = useRef(0);
  const revision = useRef(0);
  const identity = `${r.mode}:${r.userId ?? "guest"}`;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const loadedIdentity = useRef(identity);
  const [profileStatus, setProfileStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  useEffect(() => {
    if (loadedIdentity.current !== identity) {
      loadedIdentity.current = identity;
      revision.current++;
      requested.current = null;
      lastSaved.current = r.data.profile;
      setName(r.data.profile.display_name);
      setTz(r.data.profile.timezone);
      setProfileStatus("idle");
      return;
    }
    const previous = lastSaved.current;
    setName((value) => (value === previous.display_name ? r.data.profile.display_name : value));
    setTz((value) => (value === previous.timezone ? r.data.profile.timezone : value));
    lastSaved.current = r.data.profile;
    if (pendingSaves.current === 0) requested.current = null;
  }, [r.data.profile, identity]);
  useEffect(() => {
    if (profileStatus !== "saved") return;
    const timer = setTimeout(() => setProfileStatus("idle"), 2000);
    return () => clearTimeout(timer);
  }, [profileStatus]);

  function saveProfile() {
    const profile = { display_name: name.trim(), timezone: tz.trim() };
    const target = requested.current ?? lastSaved.current;
    if (profile.display_name === target.display_name && profile.timezone === target.timezone)
      return;
    if (!profile.display_name) {
      toast.error("Enter your display name.");
      return;
    }
    if (!isValidTimeZone(profile.timezone)) {
      toast.error("Unknown timezone. Use a name like America/Chicago.");
      return;
    }
    requested.current = profile;
    const saveRevision = ++revision.current;
    const saveIdentity = identity;
    pendingSaves.current++;
    setProfileStatus("saving");
    // Serialize requests, including reverting a field while an earlier save is in flight.
    queue.current = queue.current
      .then(async () => {
        if (identityRef.current !== saveIdentity) return;
        const ok = await r.saveProfile(profile);
        if (identityRef.current !== saveIdentity) return;
        if (ok) lastSaved.current = profile;
        if (saveRevision !== revision.current) return;
        requested.current = ok ? profile : null;
        setProfileStatus(ok ? "saved" : "error");
        if (!ok) toast.error("Couldn't save your profile. Tap away from a field to retry.");
      })
      .catch(() => {
        if (identityRef.current !== saveIdentity || saveRevision !== revision.current) return;
        requested.current = null;
        setProfileStatus("error");
        toast.error("Couldn't save your profile. Tap away from a field to retry.");
      })
      .finally(() => {
        pendingSaves.current--;
      });
  }

  return (
    <Shell>
      <h1 className="mb-4 text-xl font-extrabold">Settings</h1>
      <div>
        <section className="flex items-center justify-between gap-3 pb-5">
          <h2 className="font-extrabold">Appearance</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full bg-card"
                aria-label={`Appearance: ${selectedAppearance.label}`}
                title={`Appearance: ${selectedAppearance.label}`}
              >
                <AppearanceIcon
                  key={appearance}
                  className="rooted-icon-motion size-5"
                  aria-hidden="true"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="rooted-menu-motion min-w-0 rounded-full p-1.5"
            >
              <DropdownMenuRadioGroup
                value={appearance}
                onValueChange={(value) => setAppearance(value as Appearance)}
              >
                {appearanceOptions.map(({ value, label, Icon }) => (
                  <DropdownMenuRadioItem
                    key={value}
                    value={value}
                    title={label}
                    className="my-0.5 size-11 justify-center rounded-full p-0 transition-colors duration-200 data-[state=checked]:bg-gold-soft data-[state=checked]:text-primary [&>span:first-child]:hidden"
                  >
                    <Icon className="size-5" aria-hidden="true" />
                    <span className="sr-only">{label}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </section>
        <section className="space-y-3 border-t border-border py-5">
          <h2 className="flex items-center gap-2 font-extrabold">
            <UserRound className="size-4 text-primary" />
            Profile & account
          </h2>
          {r.mode === "account" && (
            <p className="break-all text-sm text-muted-foreground">{r.email}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 space-y-1">
              <Label htmlFor="dn">Display name</Label>
              <Input
                id="dn"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setProfileStatus("idle");
                }}
                onBlur={saveProfile}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
            </div>
            <div className="min-w-0 space-y-1">
              <Label htmlFor="tz">Timezone</Label>
              <Input
                id="tz"
                list="tzs"
                value={tz}
                onChange={(e) => {
                  setTz(e.target.value);
                  setProfileStatus("idle");
                }}
                onBlur={saveProfile}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
            </div>
          </div>
          <datalist id="tzs">
            {(Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
              .supportedValuesOf?.("timeZone")
              .map((z) => (
                <option key={z} value={z} />
              ))}
          </datalist>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <span
              role="status"
              aria-live="polite"
              className="flex items-center text-xs text-muted-foreground"
            >
              <span
                className={cn(
                  "flex items-center gap-1 transition-opacity duration-300 motion-reduce:transition-none",
                  profileStatus === "idle" && "opacity-0",
                )}
              >
                {profileStatus === "saved" && <Check className="size-3.5 text-success" />}
                {profileStatus === "saving"
                  ? "Saving…"
                  : profileStatus === "error"
                    ? "Not saved — tap away to retry"
                    : "Saved"}
              </span>
            </span>
            <Button variant="ghost" onClick={() => void r.signOut()}>
              <LogOut />
              {r.mode === "account" ? "Log out" : "Leave guest"}
            </Button>
          </div>
          {r.mode !== "account" && (
            <details className="border-t border-border pt-3">
              <summary className="cursor-pointer text-sm font-semibold">
                Sign in or create an account
              </summary>
              <div className="mt-3">
                <AuthForm />
              </div>
            </details>
          )}
        </section>
        <ReminderSettings key={backupRevision} />
        <section className="space-y-3 border-t border-border py-5">
          <h2 className="font-extrabold">Data & backup</h2>
          <p className="text-sm text-muted-foreground">
            {r.mode === "account"
              ? "Your writing and progress are private to your account."
              : "Guest data is stored only on this device."}
          </p>
          <BackupSettings onRestored={() => setBackupRevision((value) => value + 1)} />
          {r.mode === "account" && r.guestImportAvailable && (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-sm text-muted-foreground">
                Guest writing found on this device. Older entries stay archived; only today's points
                are imported.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  const ok = await r.importGuest();
                  toast[ok ? "success" : "error"](
                    ok ? "Guest data imported" : "Couldn't import guest data",
                  );
                }}
              >
                Import guest data
              </Button>
            </div>
          )}
        </section>
        <section className="space-y-3 border-t border-border py-5 text-xs text-muted-foreground">
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Sprout className="size-4 text-primary" />
            Rooted
          </h2>
          <p>Points close at midnight Central time. No catch-up window.</p>
          <details>
            <summary className="cursor-pointer font-semibold">Add to Home Screen</summary>
            <p className="mt-2">In Safari, tap Share → Add to Home Screen → Add.</p>
          </details>
        </section>
      </div>
    </Shell>
  );
}
