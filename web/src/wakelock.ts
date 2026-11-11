import { useEffect } from "react";

/**
 * Keeps the screen on while this page is open (control phone and big screen).
 * A phone that locks itself drops its connection, which is the usual reason a
 * control phone "goes offline" mid-event. Browsers release the lock when the page
 * is hidden, so it's requested again whenever the page comes back.
 * Needs https (the tunnel link) or localhost; quietly does nothing where unsupported.
 */
export function useWakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const get = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        // battery saver or not allowed: the app still works, the screen may just sleep
      }
    };
    get();
    document.addEventListener("visibilitychange", get);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", get);
      lock?.release().catch(() => {});
    };
  }, []);
}
