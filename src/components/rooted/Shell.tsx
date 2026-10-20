import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Flame, History, House, Loader2, Settings } from "lucide-react";
import type { ReactNode } from "react";
import logo from "@/assets/logo.png";
import { useRooted } from "@/lib/rooted/store";
import { streak, totalPoints } from "@/lib/rooted/logic";
import { AuthScreen } from "./AuthScreen";
import { cn } from "@/lib/utils";

export function Shell({ children, title, back }: { children: ReactNode; title?: string; back?: boolean }) {
  const { mode, data, today, dataError, reload } = useRooted();
  const router = useRouter();

  if (mode === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" aria-label="Loading" />
      </div>
    );
  }
  if (mode === "none") return <AuthScreen />;

  const name = data.profile.display_name || (mode === "guest" ? "Guest" : "You");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
      <header className="pt-safe sticky top-0 z-20 bg-background/95 px-4 pb-3 backdrop-blur">
        {back ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => (window.history.length > 1 ? router.history.back() : router.navigate({ to: "/" }))}
              className="flex size-11 items-center justify-center rounded-xl bg-card"
              aria-label="Back"
            >
              <ArrowLeft className="size-5" />
            </button>
            <h1 className="text-xl font-extrabold">{title}</h1>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <Link to="/" className="flex min-w-0 items-center gap-2">
              <img src={logo} alt="" width={40} height={40} className="size-10 rounded-xl" />
              <div className="min-w-0">
                <div className="text-lg font-extrabold leading-tight">Rooted</div>
                <div className="truncate text-xs text-muted-foreground">Hi, {name}</div>
              </div>
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              <div className="rounded-full bg-card px-3 py-1.5 text-sm font-bold" aria-label={`${totalPoints(data)} total points`}>
                <span className="text-primary">{totalPoints(data)}</span> P
              </div>
              <div className="flex items-center gap-1 rounded-full bg-card px-3 py-1.5 text-sm font-bold" aria-label={`${streak(data, today)} day streak`}>
                <Flame className="size-4 text-coral" /> {streak(data, today)}
              </div>
            </div>
          </div>
        )}
        {mode === "guest" && (
          <p className="mt-2 rounded-lg bg-gold-soft px-3 py-1.5 text-xs text-primary">
            Guest mode — saved on this device only, not backed up.{" "}
            <Link to="/settings" className="font-bold underline">Create account</Link>
          </p>
        )}
        {dataError && (
          <div role="alert" className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-destructive/15 px-3 py-2 text-xs text-destructive">
            <span>Couldn't load your data: {dataError}</span>
            <button onClick={() => void reload()} className="min-h-11 font-bold underline">Retry</button>
          </div>
        )}
      </header>
      <main className="flex-1 px-4 pb-28">{children}</main>
      <BottomNav />
    </div>
  );
}

function BottomNav() {
  const items = [
    { to: "/", label: "Home", icon: House },
    { to: "/history", label: "History", icon: History },
    { to: "/settings", label: "Settings", icon: Settings },
  ] as const;
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur" aria-label="Main">
      <div className="mx-auto flex max-w-xl justify-around">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/" }}
            className="flex min-h-14 min-w-20 flex-col items-center justify-center gap-0.5 text-xs font-bold text-muted-foreground"
            activeProps={{ className: "text-primary" }}
          >
            <Icon className="size-6" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function SaveStatus() {
  const { save, mode } = useRooted();
  if (save.kind === "idle") return null;
  return (
    <p
      role="status"
      className={cn(
        "text-xs",
        save.kind === "error" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {save.kind === "saving" && "Saving…"}
      {save.kind === "saved" && (mode === "guest" ? "Saved on this device" : "Saved to your account")}
      {save.kind === "error" && (save.message ?? "Couldn't save")}
    </p>
  );
}
