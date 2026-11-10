import { useEffect, useState } from "react";

/** Public branding only: safe to render in the initial HTML before auth or JS. */
export function LoadingScreen() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 10000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div
      className="rooted-loading"
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "#202020",
        color: "#f4f0e8",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <img
          src="/icons/icon-192.png"
          alt=""
          width={88}
          height={88}
          fetchPriority="high"
          style={{ display: "block", margin: "0 auto", borderRadius: 24 }}
        />
        <div style={{ marginTop: 18, fontWeight: 800, fontSize: 25, letterSpacing: "-.025em" }}>
          Rooted
        </div>
        <p style={{ marginTop: 6, fontSize: 13, color: "#b5b1a8" }}>Build what matters, daily.</p>
        <div role="status" aria-live="polite" style={{ marginTop: 24 }}>
          <span className="rooted-loading-dot" aria-hidden="true" />
          <span className="sr-only">Loading Rooted…</span>
        </div>
        {slow && (
          <div style={{ marginTop: 20, fontSize: 13, color: "#b5b1a8" }}>
            <p>This is taking longer than usual.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ marginTop: 8, minHeight: 44, color: "#d5b85f", textDecoration: "underline" }}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function LaunchCover() {
  const [visible, setVisible] = useState(true);
  useEffect(() => setVisible(false), []);
  return visible ? (
    <div
      id="rooted-launch"
      style={{ position: "fixed", inset: 0, zIndex: 10000, background: "#202020" }}
    >
      <LoadingScreen />
    </div>
  ) : null;
}

export function HomeSkeleton() {
  return (
    <div role="status" aria-label="Loading today's progress" className="space-y-5">
      <div aria-hidden="true" className="rounded-2xl bg-card p-4">
        <div className="mb-5 flex justify-between">
          <span className="rooted-skeleton h-5 w-16" />
          <span className="rooted-skeleton h-5 w-20" />
          <span className="rooted-skeleton h-5 w-16" />
        </div>
        <div className="rooted-skeleton h-32 w-full" />
      </div>
      <div aria-hidden="true" className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl bg-card p-4">
            <div className="rooted-skeleton mb-5 h-4 w-20" />
            <div className="rooted-skeleton mb-3 h-8" />
            <div className="rooted-skeleton h-8" />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="grid grid-cols-2 gap-3">
        <div className="rooted-skeleton h-12" />
        <div className="rooted-skeleton h-12" />
      </div>
    </div>
  );
}
