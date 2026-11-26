"use client";

// Per-viewer preferences kept in localStorage, read through useSyncExternalStore so nothing is
// copied into state inside an effect and the server render always uses the fallback.
import { useCallback, useSyncExternalStore } from "react";
import type { ComposePref } from "./company";
import { THEME_STORAGE_KEY } from "./theme-script";

export const PREF = {
  theme: THEME_STORAGE_KEY,
  density: "axoraa:density",
  dealsView: "axoraa:deals-view",
  compose: "axoraa:compose",
  alertsSeen: (id: string) => `axoraa:alerts-seen:${id}`,
  assistantLast: (id: string) => `axoraa:assistant-last:${id}`,
} as const;

/** Same-tab change event. The 'storage' event only fires in other tabs. */
export const PREF_EVENT = "axoraa:pref";

function readPref(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Writes a preference and notifies every useLocalPref in this tab. */
export function writePref(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the change still applies for this page view below.
  }
  try {
    window.dispatchEvent(new CustomEvent(PREF_EVENT, { detail: { key } }));
  } catch {
    // Non-browser environment.
  }
}

function subscribePrefs(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(PREF_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(PREF_EVENT, onChange);
  };
}

const serverNull = () => null;

export function useLocalPref<T extends string>(key: string, fallback: T, allowed?: readonly T[]): [T, (v: T) => void] {
  const raw = useSyncExternalStore(
    subscribePrefs,
    () => readPref(key),
    serverNull
  );
  const value = raw !== null && (!allowed || (allowed as readonly string[]).includes(raw)) ? (raw as T) : fallback;
  const set = useCallback((v: T) => writePref(key, v), [key]);
  return [value, set];
}

/* ------------------------------------------------------------------ clock */

interface Ticker {
  now: number;
  listeners: Set<() => void>;
  timer: ReturnType<typeof setInterval> | null;
}

const tickers = new Map<number, Ticker>();

function tickerFor(intervalMs: number): Ticker {
  let t = tickers.get(intervalMs);
  if (!t) {
    t = { now: 0, listeners: new Set(), timer: null };
    tickers.set(intervalMs, t);
  }
  return t;
}

function onVisible() {
  if (document.visibilityState !== "visible") return;
  for (const t of tickers.values()) {
    if (!t.listeners.size) continue;
    t.now = Date.now();
    t.listeners.forEach((l) => l());
  }
}

let visibilityBound = false;

/**
 * Current time in ms, shared by every caller with the same interval. The server snapshot is 0, so
 * callers render absolute dates (or nothing time-relative) until the client takes over.
 */
export function useNow(intervalMs = 60000): number {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const t = tickerFor(intervalMs);
      t.listeners.add(onChange);
      if (!t.timer) {
        t.timer = setInterval(() => {
          t.now = Date.now();
          t.listeners.forEach((l) => l());
        }, intervalMs);
      }
      if (!visibilityBound) {
        visibilityBound = true;
        document.addEventListener("visibilitychange", onVisible);
      }
      return () => {
        t.listeners.delete(onChange);
        if (!t.listeners.size && t.timer) {
          clearInterval(t.timer);
          t.timer = null;
        }
      };
    },
    [intervalMs]
  );
  const getSnapshot = useCallback(() => {
    const t = tickerFor(intervalMs);
    if (t.now === 0) t.now = Date.now();
    return t.now;
  }, [intervalMs]);
  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}

/* ------------------------------------------------------------------ typed prefs */

export type Density = "default" | "compact";
const DENSITIES = ["default", "compact"] as const;

export function useDensity(): [Density, (v: Density) => void] {
  return useLocalPref<Density>(PREF.density, "default", DENSITIES);
}

const COMPOSE_PREFS = ["mailto", "gmail", "outlook"] as const;

export function useComposePref(): [ComposePref, (v: ComposePref) => void] {
  return useLocalPref<ComposePref>(PREF.compose, "mailto", COMPOSE_PREFS);
}
