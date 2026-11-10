import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { LaunchCover } from "@/components/rooted/LoadingScreen";
import { RootedProvider, useRooted } from "@/lib/rooted/store";
import { Toaster } from "@/components/ui/sonner";
import { registerRootedOffline } from "@/lib/rooted/pwa";
import { AppearanceProvider } from "@/lib/rooted/appearance";
import { removeHostBadge } from "@/lib/rooted/remove-host-badge";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Rooted" },
       { title: "Rooted — Build what matters, daily" },
       { name: "description", content: "Your daily Faith, Family, Fitness and Finance practice." },
       { property: "og:title", content: "Rooted" },
       { property: "og:description", content: "Build what matters, daily." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
       { name: "theme-color", content: "#202020" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
       { rel: "preload", href: "/icons/icon-192.png", as: "image" },
       { rel: "icon", href: "/favicon.png", type: "image/png" },
       { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
       { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <LaunchCover />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(removeHostBadge, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
       <AppearanceProvider><RootedProvider><OfflineRegistration /><Outlet /><Toaster /></RootedProvider></AppearanceProvider>
    </QueryClientProvider>
  );
}


// Cache other pages only after the opening page has its account data.
function OfflineRegistration() {
  const {mode, dataReady} = useRooted();
  useEffect(() => {
    if (mode === "loading" || ((mode === "account" || mode === "guest") && !dataReady)) return;
    const register = () => { void registerRootedOffline().catch(() => undefined); };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(register, {timeout: 10000});
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(register, 1500);
    return () => clearTimeout(id);
  }, [mode, dataReady]);
  return null;
}
