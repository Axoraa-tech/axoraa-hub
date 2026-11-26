import React from "react";
import { ArrowUpRight } from "lucide-react";

export interface SummaryItem {
  label: string;
  value: React.ReactNode;
  compare?: { text: string; tone?: "positive" | "negative" | "warning" | "neutral" };
  onClick?: () => void;
}

const TONE_TEXT = {
  positive: "text-positive",
  negative: "text-negative",
  warning: "text-warning",
  neutral: "text-ink-3",
} as const;

const TONE_TEXT_INK = {
  positive: "text-lime",
  negative: "text-coral",
  warning: "text-amber",
  neutral: "text-white/55",
} as const;

/**
 * A bento row of stat cards: 2 columns below md, 3 at md, all in one row at lg.
 * With `hero`, the first card is the ink hero (use only when the page has no other ink card).
 */
export function SummaryBand({ items, ariaLabel = "Summary", hero = false }: { items: SummaryItem[]; ariaLabel?: string; hero?: boolean }) {
  return (
    <section aria-label={ariaLabel} className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none lg:gap-5">
      {items.map((it, i) => {
        const ink = hero && i === 0;
        const body = (
          <>
            <span className="flex items-start justify-between gap-2">
              <span className={`block truncate text-[13px] ${ink ? "text-white/60" : "text-ink-3"}`}>{it.label}</span>
              {it.onClick && (
                <span
                  aria-hidden
                  className={`-mr-1 -mt-1 flex size-7 shrink-0 items-center justify-center rounded-full transition-colors [&>svg]:size-3.5 ${
                    ink ? "bg-white/10 text-lime" : "bg-surface-2 text-ink-2 group-hover:bg-lime group-hover:text-on-lime"
                  }`}
                >
                  <ArrowUpRight />
                </span>
              )}
            </span>
            <span className="num mt-5 block truncate text-[30px] sm:text-[34px]">{it.value}</span>
            {it.compare && (
              <span className={`mt-2 block truncate text-[12px] tabular-nums ${(ink ? TONE_TEXT_INK : TONE_TEXT)[it.compare.tone ?? "neutral"]}`}>
                {it.compare.text}
              </span>
            )}
          </>
        );
        const shell = `${ink ? "card-ink" : "card"} min-w-0 p-5`;
        return it.onClick ? (
          <button
            key={it.label}
            type="button"
            onClick={it.onClick}
            className={`${shell} card-interactive group flex flex-col text-left`}
          >
            {body}
          </button>
        ) : (
          <div key={it.label} className={`${shell} flex flex-col`}>
            {body}
          </div>
        );
      })}
    </section>
  );
}
