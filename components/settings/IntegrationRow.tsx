"use client";

import React, { useId } from "react";
import { ChevronDown } from "lucide-react";
import { StatusDot, type Tone } from "@/components/ui/Status";

export interface IntegrationRowStatus {
  tone: Tone;
  label: string;
}

/**
 * One integration as a card: round icon, name, a one-line purpose, a status chip, and a
 * 'Set up' / 'Manage' pill that opens the details inline (aria-expanded). Without children the row is
 * informational only and shows `note` instead of a button.
 */
export function IntegrationRow({
  id,
  icon,
  name,
  purpose,
  status,
  note,
  actionLabel,
  open = false,
  onToggle,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  name: string;
  purpose: React.ReactNode;
  status?: IntegrationRowStatus | null;
  note?: React.ReactNode;
  actionLabel?: string;
  open?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
}) {
  const auto = useId();
  const titleId = `${auto}-title`;
  const panelId = `${auto}-panel`;
  const expandable = !!children && !!onToggle;

  return (
    <section id={`integration-${id}`} aria-labelledby={titleId} className="card min-w-0 scroll-mt-24 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink [&>svg]:h-[18px] [&>svg]:w-[18px]"
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h3 id={titleId} className="text-[17px] font-medium leading-tight tracking-[-0.02em] text-ink">
              {name}
            </h3>
            <p className="mt-1 text-[13px] text-ink-3">{purpose}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 pl-[58px] sm:pl-0">
          {status && <StatusDot tone={status.tone} label={status.label} />}
          {!expandable && note && <span className="text-[13px] text-ink-3">{note}</span>}
          {expandable && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={onToggle}
            >
              {actionLabel ?? (open ? "Close" : "Manage")}
              <ChevronDown aria-hidden className={`transition-transform duration-200 ease-brand ${open ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      </div>
      {expandable && open && (
        <div id={panelId} role="region" aria-labelledby={titleId} className="mt-5 animate-rise border-t border-line pt-5">
          {children}
        </div>
      )}
    </section>
  );
}

/** Numbered setup steps, drawn like the original Sheets guide (ink number discs). */
export function SetupSteps({ steps, label }: { steps: React.ReactNode[]; label?: string }) {
  return (
    <ol aria-label={label} className="space-y-2.5 text-[13.5px] text-ink-2">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3">
          <span
            aria-hidden
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-medium text-on-accent"
          >
            {i + 1}
          </span>
          <span className="min-w-0 pt-0.5">{s}</span>
        </li>
      ))}
    </ol>
  );
}

/** Inline mono token, e.g. an environment variable name. */
export function Code({ children }: { children: React.ReactNode }) {
  return <code className="break-all rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[12px] text-ink">{children}</code>;
}

/** A soft inset notice: amber for 'needs setup', coral for errors, plain for information. */
export function Notice({
  tone = "neutral",
  icon,
  children,
  action,
}: {
  tone?: "neutral" | "warning" | "negative" | "positive";
  icon?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const bg = tone === "warning" ? "bg-amber-soft" : tone === "negative" ? "bg-coral-soft" : tone === "positive" ? "bg-good-soft" : "bg-surface-2";
  const disc =
    tone === "warning" ? "bg-amber text-on-lime" : tone === "negative" ? "bg-coral text-white" : tone === "positive" ? "bg-good text-white" : "bg-surface text-ink";
  return (
    <div className={`rounded-inset p-4 ${bg}`} role={tone === "negative" ? "alert" : undefined}>
      <div className="flex items-start gap-3">
        {icon && (
          <span aria-hidden className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full [&>svg]:h-4 [&>svg]:w-4 ${disc}`}>
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1 pt-0.5 text-[13.5px] text-ink">{children}</div>
      </div>
      {action && <div className={`mt-3 flex flex-wrap gap-2 ${icon ? "pl-12" : ""}`}>{action}</div>}
    </div>
  );
}
