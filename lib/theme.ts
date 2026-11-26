"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useLocalPref } from "./prefs";
import { THEME_STORAGE_KEY, type ThemePref } from "./theme-script";

const THEME_PREFS = ["system", "light", "dark"] as const;
const DARK_QUERY = "(prefers-color-scheme: dark)";

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

function subscribeSystem(onChange: () => void): () => void {
  let mq: MediaQueryList | null = null;
  try {
    mq = window.matchMedia(DARK_QUERY);
    mq.addEventListener("change", onChange);
  } catch {
    mq = null;
  }
  return () => mq?.removeEventListener("change", onChange);
}

function storedPref(): ThemePref {
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function resolve(p: ThemePref): "light" | "dark" {
  return p === "system" ? (systemPrefersDark() ? "dark" : "light") : p;
}

/** Sets data-theme and color-scheme on <html> without animating every colour at once. */
export function applyTheme(resolved: "light" | "dark"): void {
  const d = document.documentElement;
  if (d.dataset.theme === resolved) return;
  d.classList.add("theme-switching");
  d.dataset.theme = resolved;
  d.style.colorScheme = resolved;
  requestAnimationFrame(() => requestAnimationFrame(() => d.classList.remove("theme-switching")));
}

export function useTheme(): { pref: ThemePref; resolved: "light" | "dark"; setPref: (p: ThemePref) => void } {
  const [pref, setStored] = useLocalPref<ThemePref>(THEME_STORAGE_KEY, "system", THEME_PREFS);
  const systemDark = useSyncExternalStore(subscribeSystem, systemPrefersDark, () => false);
  const resolved: "light" | "dark" = pref === "system" ? (systemDark ? "dark" : "light") : pref;

  // Keep <html> in step with the OS setting and with changes made in other tabs. The inline
  // script already applied the right theme before paint, so nothing is applied on mount.
  useEffect(() => {
    const sync = () => applyTheme(resolve(storedPref()));
    const unsubscribe = subscribeSystem(sync);
    window.addEventListener("storage", sync);
    return () => {
      unsubscribe();
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setPref = useCallback(
    (p: ThemePref) => {
      setStored(p);
      applyTheme(resolve(p));
    },
    [setStored]
  );

  return { pref, resolved, setPref };
}
