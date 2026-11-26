"use client";

// The floating ink pill bar below md: the role's main views plus More (which opens the drawer).
import React from "react";
import { MoreHorizontal } from "lucide-react";
import type { ViewDef, ViewId } from "@/lib/views";

/** Short labels for the active pill; everything else uses the view label. */
const SHORT: Partial<Record<ViewId, string>> = {
  overview: "Home",
  today: "Home",
  mkt_deals: "Deals",
  mkt_visits: "Visits",
  eng_log: "Work log",
  clients: "Clients",
  assistant: "Assistant",
  help: "Guide",
};

export function MobileNav({
  items,
  active,
  onNavigate,
  onMore,
  moreOpen,
}: {
  items: readonly ViewDef[];
  active: ViewId;
  onNavigate: (id: ViewId) => void;
  onMore: () => void;
  moreOpen: boolean;
}) {
  const activeInBar = items.some((v) => v.id === active);
  return (
    <nav
      data-shell-chrome
      aria-label="Main views"
      className="no-print fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-40 mx-auto flex h-16 max-w-[420px] items-center justify-between gap-1 rounded-full bg-ink-panel px-2 text-on-ink-panel shadow-float ring-1 ring-white/10 md:hidden"
    >
      {items.map((v) => {
        const isActive = v.id === active;
        const Icon = v.icon;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onNavigate(v.id)}
            aria-current={isActive ? "page" : undefined}
            aria-label={v.label}
            className={`flex h-12 min-w-0 items-center justify-center gap-1.5 rounded-full transition-[background-color,color] duration-200 focus-visible:outline-lime ${
              isActive ? "max-w-[160px] flex-1 bg-white/10 px-3 text-lime" : "w-12 shrink-0 text-white/65 hover:text-white"
            }`}
          >
            <Icon aria-hidden className="h-5 w-5 shrink-0" />
            {isActive && <span className="truncate text-[13px] font-medium text-white">{SHORT[v.id] ?? v.label}</span>}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onMore}
        aria-label="More views"
        aria-haspopup="dialog"
        aria-expanded={moreOpen}
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-lime ${
          !activeInBar ? "bg-white/10 text-lime" : "text-white/65 hover:text-white"
        }`}
      >
        <MoreHorizontal aria-hidden className="h-5 w-5" />
      </button>
    </nav>
  );
}
