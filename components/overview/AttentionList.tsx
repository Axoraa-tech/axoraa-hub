"use client";

import React from "react";
import { ArrowRight, BellRing, CheckCircle2 } from "lucide-react";
import type { AlertTone, HubAlert } from "@/lib/alerts";
import { daysBetween, formatDateIST } from "@/lib/format";

/** Dot colours on the ink card. */
const TONE_DOT: Record<AlertTone, string> = {
  negative: "bg-coral",
  warning: "bg-amber",
  accent: "bg-lime",
  positive: "bg-good",
  neutral: "bg-white/60",
};

const TONE_WORD: Record<AlertTone, string> = {
  negative: "Urgent",
  warning: "Due soon",
  accent: "For you",
  positive: "Good news",
  neutral: "Note",
};

/** 'today', 'yesterday', '3 days ago', 'tomorrow', 'in 4 days', or a date further out. */
export function dayPhrase(dateKey: string | undefined, todayKey: string): string {
  if (!dateKey || !todayKey) return "";
  const diff = daysBetween(dateKey, todayKey);
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff > 1 && diff < 7) return `${diff} days ago`;
  if (diff === -1) return "tomorrow";
  if (diff < -1 && diff > -7) return `in ${-diff} days`;
  return formatDateIST(dateKey, { year: dateKey.slice(0, 4) !== todayKey.slice(0, 4) });
}

/**
 * The ink "Needs attention" card from the original Command Center, fed by deriveAlerts.
 * At most `max` rows; each row opens its record (or view). 'Show all' goes to Today.
 */
export function AttentionList({
  alerts,
  todayKey,
  onSelect,
  onShowAll,
  max = 8,
  className = "",
}: {
  alerts: HubAlert[];
  todayKey: string;
  onSelect: (a: HubAlert) => void;
  onShowAll?: () => void;
  max?: number;
  className?: string;
}) {
  const shown = alerts.slice(0, max);
  const urgent = alerts.filter((a) => a.tone === "negative").length;
  const count = alerts.length;

  return (
    <section aria-labelledby="attention-title" className={`card-ink flex min-w-0 flex-col p-5 sm:p-6 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px]">
          <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-lime text-on-lime">
            <BellRing className="h-3.5 w-3.5" />
          </span>
          Needs attention
        </div>
        {urgent > 0 && (
          <span className="rounded-full bg-coral/20 px-2.5 py-0.5 text-[12px] font-medium tabular-nums text-coral">{urgent} urgent</span>
        )}
      </div>

      <h3 id="attention-title" className="mt-5 text-[24px] font-medium leading-[1.12] tracking-[-0.03em] sm:text-[26px]">
        {count === 0 ? "Everything is on track" : count === 1 ? "1 thing needs your attention" : `${count} things need your attention`}
      </h3>

      {count === 0 ? (
        <p className="mt-4 flex flex-1 items-start gap-2 text-[13.5px] text-white/60">
          <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-lime" />
          No overdue follow-ups, open blockers, reviews or invoices due.
        </p>
      ) : (
        <ul className="-mx-2 mt-4 flex-1 space-y-0.5">
          {shown.map((a) => {
            const when = dayPhrase(a.date, todayKey);
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onSelect(a)}
                  className="group flex min-h-11 w-full items-start gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-white/[0.06] focus-visible:bg-white/[0.06]"
                >
                  <span aria-hidden className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${TONE_DOT[a.tone]}`} />
                  <span className="sr-only">{TONE_WORD[a.tone]}: </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] leading-snug text-white/85 group-hover:text-white">{a.title}</span>
                    {(a.detail || when) && (
                      <span className="mt-0.5 block truncate text-[12px] text-white/45">
                        {[when && when[0].toUpperCase() + when.slice(1), a.detail].filter(Boolean).join(". ")}
                      </span>
                    )}
                  </span>
                  <ArrowRight
                    aria-hidden
                    className="mt-1 h-3.5 w-3.5 shrink-0 -translate-x-1 text-white/70 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {count > 0 && (
          <button type="button" onClick={() => onSelect(alerts[0])} className="btn btn-lime">
            Review now
          </button>
        )}
        {onShowAll && (
          <button type="button" onClick={onShowAll} className="btn btn-plain text-white/70 hover:bg-white/10 hover:text-white">
            {count > max ? `Show all ${count}` : "Open Today"}
            <ArrowRight aria-hidden className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </section>
  );
}
