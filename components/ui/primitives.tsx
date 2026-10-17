"use client";

import React, { useEffect } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import { initials } from "@/lib/format";
import type { Granularity, Range } from "@/lib/analytics";

/* ------------------------------------------------------------------ Card header */

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
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <span className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center shrink-0 text-ink [&>svg]:w-[18px] [&>svg]:h-[18px]">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-[17px] font-medium tracking-[-0.02em] leading-tight truncate">{title}</h3>
          {subtitle && <p className="text-[12.5px] text-ink-3 mt-1 truncate">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Segmented */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  dark = false,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  size?: "sm" | "md";
  dark?: boolean;
}) {
  return (
    <div
      role="tablist"
      className={`inline-flex items-center p-1 rounded-full ${dark ? "bg-white/10" : "bg-surface-2"} ${
        size === "sm" ? "text-[12px]" : "text-[13px]"
      }`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`${size === "sm" ? "h-7 px-3" : "h-8 px-4"} rounded-full font-medium transition-all whitespace-nowrap ${
              active
                ? dark
                  ? "bg-lime text-ink"
                  : "bg-ink text-white shadow-sm"
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

export function PeriodPicker({
  granularity,
  onGranularity,
  range,
  onShift,
  onToday,
}: {
  granularity: Granularity;
  onGranularity: (g: Granularity) => void;
  range: Range;
  onShift: (dir: -1 | 1) => void;
  onToday?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented
        value={granularity}
        onChange={onGranularity}
        options={[
          { value: "week", label: "Weekly" },
          { value: "month", label: "Monthly" },
          { value: "year", label: "Yearly" },
        ]}
      />
      <div className="inline-flex items-center h-10 rounded-full bg-surface pl-1 pr-1 shadow-[inset_0_0_0_1px_var(--color-line)]">
        <button aria-label="Previous period" onClick={() => onShift(-1)} className="w-8 h-8 rounded-full hover:bg-surface-2 flex items-center justify-center">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button onClick={onToday} className="px-2 text-[13px] font-medium tabular-nums min-w-[150px] text-center" title="Jump to latest activity">
          {range.label}
        </button>
        <button aria-label="Next period" onClick={() => onShift(1)} className="w-8 h-8 rounded-full hover:bg-surface-2 flex items-center justify-center">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Avatar */

const TINTS = ["#d4ff32", "#0e0e0f", "#e5e5df", "#f1ffc2", "#3f3f39", "#efefea"];
const INK_ON = ["#0e0e0f", "#ffffff", "#0e0e0f", "#0e0e0f", "#d4ff32", "#0e0e0f"];

export function Avatar({ name, size = 32, ring = false }: { name: string; size?: number; ring?: boolean }) {
  const idx = [...name].reduce((s, c) => s + c.charCodeAt(0), 0) % TINTS.length;
  return (
    <span
      title={name}
      className={`inline-flex items-center justify-center rounded-full font-medium shrink-0 select-none ${ring ? "ring-2 ring-surface" : ""}`}
      style={{ width: size, height: size, background: TINTS[idx], color: INK_ON[idx], fontSize: Math.max(10, size * 0.36) }}
    >
      {initials(name)}
    </span>
  );
}

/* ------------------------------------------------------------------ Delta */

export function Delta({ value, invert = false, dark = false }: { value: number | null; invert?: boolean; dark?: boolean }) {
  if (value === null) return <span className={`text-[12px] ${dark ? "text-white/50" : "text-ink-3"}`}>new</span>;
  if (value === 0) return <span className={`text-[12px] ${dark ? "text-white/50" : "text-ink-3"}`}>±0%</span>;
  const up = value > 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[12px] font-medium ${
        good ? (dark ? "text-lime" : "text-good") : "text-coral"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {Math.abs(value)}%
    </span>
  );
}

/* ------------------------------------------------------------------ Stat tile */

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
  const toneClass =
    tone === "ink" ? "card-ink" : tone === "lime" ? "card-lime" : tone === "inset" ? "card-inset" : "card";
  const sub = tone === "ink" ? "text-white/55" : tone === "lime" ? "text-ink/60" : "text-ink-3";
  return (
    <div className={`${toneClass} p-5 flex flex-col justify-between min-h-[152px] ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[13px] ${sub}`}>{label}</span>
        {icon && (
          <span
            className={`w-8 h-8 rounded-full flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4 ${
              tone === "ink" ? "bg-white/10 text-lime" : tone === "lime" ? "bg-ink/10" : "bg-surface-2"
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

/* ------------------------------------------------------------------ Modal */

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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-ink/35 backdrop-blur-[3px] animate-[rise_.2s_ease-out_both]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${width} bg-surface rounded-t-[28px] sm:rounded-[28px] shadow-[var(--shadow-float)] flex flex-col max-h-[92vh] animate-rise`}
      >
        <div className="flex items-start justify-between gap-4 px-6 sm:px-7 pt-6 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <span className="w-11 h-11 rounded-full bg-lime flex items-center justify-center shrink-0 [&>svg]:w-5 [&>svg]:h-5">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h2 className="text-[22px] font-medium tracking-[-0.03em] leading-tight">{title}</h2>
              {subtitle && <p className="text-[13px] text-ink-3 mt-1">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="icon-btn shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 sm:px-7 pb-6 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-6 sm:px-7 py-4 border-t border-line flex items-center justify-end gap-2 bg-surface rounded-b-[28px]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Form field wrapper */

export function Field({ label, children, hint, className = "" }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="eyebrow block mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[11.5px] text-ink-3 mt-1">{hint}</span>}
    </label>
  );
}

/* ------------------------------------------------------------------ Empty state */

export function EmptyState({ title, body, icon, action }: { title: string; body?: string; icon?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="py-12 flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-full hatch mb-4 flex items-center justify-center text-ink-2 [&>svg]:w-5 [&>svg]:h-5">{icon}</div>
      <h4 className="text-[15px] font-medium">{title}</h4>
      {body && <p className="text-[13px] text-ink-3 mt-1.5 max-w-sm">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Status pill */

const STATUS_STYLE: Record<string, string> = {
  Completed: "chip-good",
  "Fully Paid": "chip-good",
  Won: "chip-good",
  "Closed Won": "chip-good",
  "In Progress": "chip-lime",
  Development: "chip-lime",
  Testing: "chip-lime",
  "Client Review": "chip-amber",
  Pending: "chip-amber",
  Negotiation: "chip-amber",
  "Proposal Sent": "chip-amber",
  Blocked: "chip-coral",
  Overdue: "chip-coral",
  "On Hold": "chip-coral",
  "Closed Lost": "chip-coral",
};

export function StatusPill({ status }: { status: string }) {
  const cls = STATUS_STYLE[status] ?? "";
  const dot =
    cls === "chip-good" ? "bg-good" : cls === "chip-lime" ? "bg-ink" : cls === "chip-amber" ? "bg-amber" : cls === "chip-coral" ? "bg-coral" : "bg-ink-3";
  return (
    <span className={`chip ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}
