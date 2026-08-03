"use client";

import { useEffect } from "react";

// Registers the service worker (enables PWA install) and, on installed/fullscreen
// contexts that allow it, locks the screen to landscape. Renders nothing.
export default function PwaSetup() {
  useEffect(() => {
    if (typeof navigator === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {});
    }

    // Best-effort landscape lock. Only succeeds in fullscreen/installed contexts;
    // ignored (and harmless) everywhere else — OrientationGate is the real fallback.
    const orientation = (
      typeof screen !== "undefined" ? screen : undefined
    )?.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;
    orientation?.lock?.("landscape").catch(() => {});
  }, []);

  return null;
}
