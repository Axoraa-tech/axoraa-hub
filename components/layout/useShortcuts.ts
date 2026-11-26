"use client";

// Global keyboard shortcuts for the hub.
//   Ctrl/⌘K  command bar (also closes it)
//   /        the view's search, or the command bar when the view has none
//   n        the page's primary action
//   ?        the shortcuts list
//   g <key>  jump to a view (chords come from VIEWS[].chord)
// Nothing fires while typing in a field or while a dialog, sheet or menu is open.
import { useEffect, useEffectEvent } from "react";
import type { ViewDef, ViewId } from "@/lib/views";

export interface ShortcutHandlers {
  /** Views the viewer can open; only their chords are active. */
  views: readonly ViewDef[];
  onPalette(): void;
  onSlash(): void;
  onPrimary(): void;
  onHelp(): void;
  onView(view: ViewId): void;
  /** True while the command bar is open (Ctrl/⌘K still toggles it). */
  paletteOpen: boolean;
}

function isTyping(target: EventTarget | null): boolean {
  const el = target instanceof HTMLElement ? target : null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type;
    return !["button", "checkbox", "radio", "range", "reset", "submit", "color", "file", "image"].includes(type);
  }
  return false;
}

/** Any modal layer, popover or open menu on the page. */
function layerOpen(): boolean {
  return !!document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]');
}

const CHORD_WINDOW_MS = 1200;

export function useShortcuts(handlers: ShortcutHandlers): void {
  const onKey = useEffectEvent((e: KeyboardEvent, chord: { at: number }) => {
    if (e.defaultPrevented || e.isComposing) return;
    const key = e.key;

    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && key.toLowerCase() === "k") {
      if (!handlers.paletteOpen && layerOpen()) return;
      e.preventDefault();
      handlers.onPalette();
      return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (handlers.paletteOpen || isTyping(e.target) || layerOpen()) {
      chord.at = 0;
      return;
    }

    if (chord.at && e.timeStamp - chord.at < CHORD_WINDOW_MS && /^[a-z]$/i.test(key)) {
      chord.at = 0;
      const want = `g ${key.toLowerCase()}`;
      const hit = handlers.views.find((v) => v.chord === want);
      if (hit) {
        e.preventDefault();
        handlers.onView(hit.id);
      }
      return;
    }
    chord.at = 0;

    switch (key) {
      case "/":
        e.preventDefault();
        handlers.onSlash();
        return;
      case "?":
        e.preventDefault();
        handlers.onHelp();
        return;
      case "n":
      case "N":
        if (e.shiftKey) return;
        e.preventDefault();
        handlers.onPrimary();
        return;
      case "g":
      case "G":
        if (e.shiftKey) return;
        chord.at = e.timeStamp || 1;
        return;
    }
  });

  useEffect(() => {
    const chord = { at: 0 };
    const listener = (e: KeyboardEvent) => onKey(e, chord);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);
}
