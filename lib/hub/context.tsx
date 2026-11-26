"use client";

// The hub context: data, viewer, features and the URL-driven view state, provided by HubApp.
// Views take no props and read everything from useHub().
//
// Keyboard: the shell's shortcut handler uses the element given to registerSearch. '/' focuses it
// when it is still connected to the document, otherwise it opens the command palette.
// Ctrl/⌘K always opens the palette. Views pass `ref={registerSearch}` to their main search input.
import { createContext, use, type ReactNode } from "react";
import type { FeatureFlags } from "@/lib/features";
import type { HubViewer } from "@/lib/hub/types";
import type { HubData } from "@/lib/useHubData";
import type { Overlay, ViewId, ViewParams } from "@/lib/views";

export interface HubContextValue {
  /** Scoped to the workspace owner for members; everything for the admin workspace. */
  data: HubData;
  /** Unscoped data. */
  all: HubData;
  viewer: HubViewer;
  features: FeatureFlags;
  view: ViewId;
  params: URLSearchParams;
  /** '/admin' or '/u/<id>'. */
  basePath: string;
  /** Pushes ?view=<view>&... onto history and scrolls to the top. */
  navigate(view: ViewId, params?: ViewParams): void;
  /** Merges into the current query with replaceState. null or undefined removes a key. */
  setParams(patch: ViewParams): void;
  openOverlay(o: Overlay): void;
  closeOverlay(): void;
  /** Ref callback for the view's main search input. */
  registerSearch(el: HTMLInputElement | null): void;
}

const HubContext = createContext<HubContextValue | null>(null);
HubContext.displayName = "HubContext";

export function HubProvider({ value, children }: { value: HubContextValue; children: ReactNode }) {
  return <HubContext value={value}>{children}</HubContext>;
}

export function useHub(): HubContextValue {
  const ctx = use(HubContext);
  if (!ctx) throw new Error("useHub must be used inside HubProvider");
  return ctx;
}

/** Same as useHub, but null outside a HubProvider (primitives that also render on /dev pages). */
export function useOptionalHub(): HubContextValue | null {
  return use(HubContext);
}
