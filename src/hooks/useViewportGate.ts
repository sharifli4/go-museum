"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

function getSnapshot() {
  return window.innerWidth < 1024 || window.innerHeight < 700;
}

function getServerSnapshot() {
  return false;
}

/** Width < 1024 or height < 700 shows the small-viewport gate (lock §9). */
export function useViewportGate(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
