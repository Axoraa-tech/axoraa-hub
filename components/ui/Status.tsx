import React from "react";
import type { LeadStageStatus, MarketingDeal } from "@/lib/types";

export type Tone = "positive" | "warning" | "negative" | "neutral" | "accent";

const CHIP: Record<Tone, string> = {
  positive: "chip-good",
  warning: "chip-amber",
  negative: "chip-coral",
  accent: "chip-lime",
  neutral: "",
};

/** Status as a chip with a small dot: green done, lime in progress, amber waiting, coral stuck. */
export function StatusDot({ tone, label, className = "" }: { tone: Tone; label: React.ReactNode; className?: string }) {
  return (
    <span className={`chip ${CHIP[tone]} ${className}`}>
      <span aria-hidden className={`dot dot-${tone}`} />
      <span>{label}</span>
    </span>
  );
}

/** A small pill label in the same tones (no dot). */
export function Badge({ tone = "neutral", children, className = "" }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={`badge ${tone === "neutral" ? "" : `badge-${tone}`} ${className}`}>{children}</span>;
}

const STAGE_TONE: Record<LeadStageStatus, Tone> = {
  "New Lead": "neutral",
  Contacted: "neutral",
  "Meeting Scheduled": "accent",
  "Demo Completed": "accent",
  "Proposal Sent": "accent",
  Negotiation: "warning",
  "Closed Won": "positive",
  "Closed Lost": "negative",
  "On Hold": "neutral",
};

export function toneForStage(stage: LeadStageStatus | string): Tone {
  return STAGE_TONE[stage as LeadStageStatus] ?? "neutral";
}

export function toneForInvoice(status: string): Tone {
  if (status === "Fully Paid") return "positive";
  if (status === "Overdue") return "negative";
  if (status === "Pending") return "warning";
  return "neutral";
}

export function toneForWorkStatus(status: string): Tone {
  if (status === "Completed") return "positive";
  if (status === "Blocked") return "negative";
  if (status === "In Progress") return "accent";
  return "neutral";
}

export function toneForDue(due: string): Tone {
  if (due === "Overdue") return "negative";
  if (due === "Today") return "warning";
  if (due === "Completed") return "positive";
  return "neutral";
}

export function toneForContent(status: string): Tone {
  if (status === "published") return "positive";
  if (status === "scheduled") return "accent";
  if (status === "in_review") return "warning";
  return "neutral";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayNumber(key: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(key || "");
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000;
}

/** '3 days overdue', 'Due today', 'Due 28 Nov'. Closed deals read 'Closed'. */
export function dueText(deal: Pick<MarketingDeal, "nextFollowUpDate" | "leadStatus">, todayKey: string): string {
  if (deal.leadStatus === "Closed Won" || deal.leadStatus === "Closed Lost") return "Closed";
  const due = dayNumber(deal.nextFollowUpDate);
  const today = dayNumber(todayKey);
  if (due === null || today === null) return "No follow-up set";
  const diff = Math.round(due - today);
  if (diff < 0) return `${-diff} ${diff === -1 ? "day" : "days"} overdue`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  const [y, mo, d] = deal.nextFollowUpDate.slice(0, 10).split("-").map(Number);
  const sameYear = todayKey.slice(0, 4) === String(y);
  return `Due ${d} ${MONTHS[mo - 1]}${sameYear ? "" : ` ${y}`}`;
}
