"use client";

import React, { useRef } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { initials } from "@/lib/format";
import type { Granularity, Range } from "@/lib/analytics";
import { Dialog } from "./Dialog";
import { StatusDot, toneForDue, toneForInvoice, toneForStage, toneForWorkStatus, type Tone } from "./Status";

export { Field } from "./form";

/* ------------------------------------------------------------------ Card header */

/** Title, muted subtitle and an optional round icon on the left; actions (round icon buttons) on the right. */
export function CardHeader({
  title,
  subtitle,
  icon,
  action,
  className = "",
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink [&>svg]:h-[18px] [&>svg]:w-[18px]"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-[17px] font-medium leading-tight tracking-[-0.02em]">{title}</h3>
          {subtitle && <p className="mt-1 truncate text-[12.5px] text-ink-3">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/** A heading for a block of cards inside a page. */
export function SectionHeader({
  title,
  description,
  actions,
  id,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  id?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 px-1">
      <div className="min-w-0">
        <h2 id={id} className="text-[20px] font-medium leading-tight tracking-[-0.03em] text-ink">
          {title}
        </h2>
        {description && <p className="mt-1 text-[13px] text-ink-3">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Toolbar({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-center gap-2 ${className}`}>{children}</div>;
}

export function Kbd({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <kbd className={`kbd ${className}`}>{children}</kbd>;
}

/* ------------------------------------------------------------------ Segmented */

/**
 * Pill segmented control (radiogroup). The active pill is ink (lime on dark cards and in dark mode)
 * and slides between segments. Arrow keys, Home and End move and select.
 * Segments share one width so the indicator can be placed with CSS alone.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  dark = false,
  label,
  className = "",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; title?: string }[];
  size?: "sm" | "md";
  /** For use on an ink card: translucent track, lime active pill. */
  dark?: boolean;
  label?: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const found = options.findIndex((o) => o.value === value);
  const index = Math.max(0, found);
  const n = Math.max(1, options.length);
  const pick = (i: number) => {
    const o = options[(i + n) % n];
    if (!o) return;
    onChange(o.value);
    refs.current[(i + n) % n]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`relative inline-grid auto-cols-fr grid-flow-col rounded-full p-1 ${dark ? "bg-white/10" : "bg-surface-2"} ${
        size === "sm" ? "h-9 text-[12px]" : "h-10 text-[13px]"
      } ${className}`}
    >
      {found >= 0 && (
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-y-1 left-1 rounded-full shadow-sm transition-transform duration-300 ease-brand ${
            dark ? "bg-lime" : "bg-accent"
          }`}
          style={{ width: `calc((100% - 8px) / ${n})`, transform: `translateX(${index * 100}%)` }}
        />
      )}
      {options.map((o, i) => {
        const active = i === found;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active || (found === -1 && i === 0) ? 0 : -1}
            title={o.title}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                pick(i + 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                pick(i - 1);
              } else if (e.key === "Home") {
                e.preventDefault();
                pick(0);
              } else if (e.key === "End") {
                e.preventDefault();
                pick(n - 1);
              }
            }}
            className={`relative z-[1] whitespace-nowrap rounded-full font-medium transition-colors duration-200 focus-visible:outline-offset-0 ${
              size === "sm" ? "px-3" : "px-4"
            } ${
              active
                ? dark
                  ? "text-on-lime"
                  : "text-on-accent"
                : dark
                ? "text-white/60 hover:text-white"
                : "text-ink-2 hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Period picker */

const GRANULARITY_OPTIONS = [
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "quarter", label: "Quarterly", title: "Financial-year quarters" },
  { value: "year", label: "Yearly", title: "Financial year, April to March" },
] as { value: Granularity; label: string; title?: string }[];

/** Weekly / Monthly / Quarterly / Yearly pills plus the round-ended date stepper. */
export function PeriodPicker({
  granularity,
  onGranularity,
  range,
  onShift,
  onToday,
  granularities,
}: {
  granularity: Granularity;
  onGranularity: (g: Granularity) => void;
  range: Range;
  onShift: (dir: -1 | 1) => void;
  onToday?: () => void;
  granularities?: Granularity[];
}) {
  const options = granularities ? GRANULARITY_OPTIONS.filter((o) => granularities.includes(o.value)) : GRANULARITY_OPTIONS;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented label="Period length" value={granularity} onChange={onGranularity} options={options} />
      <div className="inline-flex h-10 items-center rounded-full bg-surface px-1 shadow-[inset_0_0_0_1px_var(--color-line)]">
        <button
          type="button"
          aria-label="Previous period"
          onClick={() => onShift(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-surface-2"
        >
          <ChevronLeft aria-hidden className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToday}
          aria-label="Go to current period"
          title={`${range.label}. Go to current period`}
          className="h-8 min-w-[150px] rounded-full px-2 text-center text-[13px] font-medium tabular-nums transition-colors hover:bg-surface-2"
        >
          {range.label}
        </button>
        <button
          type="button"
          aria-label="Next period"
          onClick={() => onShift(1)}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-surface-2"
        >
          <ChevronRight aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Avatar */

const AVATAR_TONE = [
  "bg-avatar-1 text-on-lime",
  "bg-avatar-2 text-white",
  "bg-avatar-3 text-ink",
  "bg-avatar-4 text-ink",
  "bg-avatar-5 text-lime",
  "bg-avatar-6 text-ink",
];

/** Initials in a round tint picked from the name (lime, ink, warm greys). */
export function Avatar({ name, size = 32, ring = false, className = "" }: { name: string; size?: number; ring?: boolean; className?: string }) {
  const safe = name || "?";
  const idx = [...safe].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_TONE.length;
  return (
    <span
      title={name}
      aria-hidden
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-medium leading-none ${AVATAR_TONE[idx]} ${
        ring ? "ring-2 ring-surface" : ""
      } ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) }}
    >
      {initials(safe)}
    </span>
  );
}

/* ------------------------------------------------------------------ Delta */

/** Arrow and percentage, green when the move is good (invert for costs and overdue amounts). Optional 'vs Oct'. */
export function Delta({
  value,
  invert = false,
  baseline,
  dark = false,
}: {
  value: number | null;
  invert?: boolean;
  baseline?: string;
  dark?: boolean;
}) {
  const muted = dark ? "text-white/55" : "text-ink-3";
  const vs = baseline ? <span className={`font-normal ${muted}`}> vs {baseline}</span> : null;
  if (value === null) return <span className={`text-[12px] ${muted}`}>{baseline ? `new, nothing in ${baseline}` : "new"}</span>;
  if (value === 0)
    return (
      <span className={`text-[12px] tabular-nums ${muted}`}>
        ±0%{baseline ? ` vs ${baseline}` : ""}
      </span>
    );
  const up = value > 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[12px] font-medium tabular-nums ${
        good ? (dark ? "text-lime" : "text-positive") : dark ? "text-coral" : "text-negative"
      }`}
    >
      <Icon aria-hidden className="h-3.5 w-3.5" />
      <span className="sr-only">{up ? "up " : "down "}</span>
      {Math.abs(value)}%{vs}
    </span>
  );
}

/* ------------------------------------------------------------------ Stat tile */

/** A bento figure card. One `ink` hero and at most one `lime` tile per screen. */
export function StatTile({
  label,
  value,
  unit,
  foot,
  tone = "light",
  icon,
  className = "",
  children,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  foot?: React.ReactNode;
  tone?: "light" | "ink" | "lime" | "inset";
  icon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  const toneClass = tone === "ink" ? "card-ink" : tone === "lime" ? "card-lime" : tone === "inset" ? "card-inset" : "card";
  const sub = tone === "ink" ? "text-white/55" : tone === "lime" ? "text-on-lime/60" : "text-ink-3";
  return (
    <div className={`${toneClass} flex min-h-[152px] flex-col justify-between p-5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[13px] ${sub}`}>{label}</span>
        {icon && (
          <span
            aria-hidden
            className={`flex h-8 w-8 items-center justify-center rounded-full [&>svg]:h-4 [&>svg]:w-4 ${
              tone === "ink" ? "bg-white/10 text-lime" : tone === "lime" ? "bg-on-lime/10" : tone === "inset" ? "bg-surface" : "bg-surface-2"
            }`}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="mt-4">
        <div className="flex items-baseline gap-1.5">
          <span className="num text-[44px]">{value}</span>
          {unit && <span className={`text-[14px] ${sub}`}>{unit}</span>}
        </div>
        {children}
        {foot && <div className={`mt-2 text-[12.5px] ${sub}`}>{foot}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Modal (built on Dialog) */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  width = "max-w-2xl",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  const size = /max-w-(sm|md)\b/.test(width) ? "sm" : /max-w-(lg|xl)\b/.test(width) ? "md" : "lg";
  return (
    <Dialog open={open} onClose={onClose} title={title} description={subtitle} icon={icon} footer={footer} size={size}>
      {children}
    </Dialog>
  );
}

/* ------------------------------------------------------------------ Empty state */

/** A small hatched round icon, one plain sentence and one pill button. */
export function EmptyState({
  title,
  body,
  icon,
  action,
  className = "",
}: {
  title: React.ReactNode;
  body?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center px-4 py-12 text-center ${className}`}>
      <div aria-hidden className="hatch mb-4 flex h-14 w-14 items-center justify-center rounded-full text-ink-2 [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </div>
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {body && <p className="mt-1.5 max-w-sm text-[13px] text-ink-3">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Status pill */

const STATUS_TONE: Record<string, Tone> = {
  Completed: "positive",
  "Fully Paid": "positive",
  Won: "positive",
  "Closed Won": "positive",
  "In Progress": "accent",
  Development: "accent",
  Testing: "accent",
  "Client Review": "warning",
  Pending: "warning",
  Negotiation: "warning",
  "Proposal Sent": "warning",
  Blocked: "negative",
  Overdue: "negative",
  "On Hold": "negative",
  "Closed Lost": "negative",
};

function toneForAny(status: string): Tone {
  if (STATUS_TONE[status]) return STATUS_TONE[status];
  const candidates = [toneForInvoice(status), toneForWorkStatus(status), toneForStage(status), toneForDue(status)];
  return candidates.find((t) => t !== "neutral") ?? "neutral";
}

/** A status chip with a small dot (green done, lime in progress, amber waiting, coral stuck). */
export function StatusPill({ status }: { status: string }) {
  return <StatusDot tone={toneForAny(status)} label={status} />;
}
