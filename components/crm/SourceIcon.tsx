import React from "react";
import { CalendarDays, Circle, Globe, MapPin, Phone, Users, type LucideIcon } from "lucide-react";
import type { LeadSource } from "@/lib/types";
import { ChannelMark, type BrandChannel } from "@/components/ui/ChannelMark";

// Every LeadSource value. Records keyed by the union make the compiler flag a missing source.
const ICONS: Record<LeadSource, { lucide?: LucideIcon; brand?: BrandChannel; short: string }> = {
  "Website / Inbound": { lucide: Globe, short: "Website" },
  "Field Visit / Direct Walk-in": { lucide: MapPin, short: "Field visit" },
  Referral: { lucide: Users, short: "Referral" },
  "LinkedIn / Outreach": { brand: "linkedin", short: "LinkedIn" },
  "Exhibition / Event": { lucide: CalendarDays, short: "Event" },
  "Cold Call": { lucide: Phone, short: "Cold call" },
  "Meta Lead Ad": { brand: "facebook", short: "Meta lead ad" },
};

/** Short label for a lead source ('Field visit', 'LinkedIn'). Unknown sources are returned as they are. */
export function sourceLabel(source: string | null | undefined): string {
  const s = (source ?? "").trim();
  if (!s) return "No source";
  return ICONS[s as LeadSource]?.short ?? s;
}

/**
 * 16px ink-3 mark for a lead source: lucide for generic sources, ChannelMark for LinkedIn and Meta.
 * Labelled by default; pass `decorative` when the label is already written beside it.
 */
export function SourceIcon({ source, decorative = false, className = "" }: { source: string | null | undefined; decorative?: boolean; className?: string }) {
  const entry = ICONS[(source ?? "") as LeadSource];
  const label = sourceLabel(source);
  if (entry?.brand) {
    return <ChannelMark channel={entry.brand} size={16} className={`text-ink-3 ${className}`} title={decorative ? undefined : label} />;
  }
  const Icon = entry?.lucide ?? Circle;
  return (
    <Icon
      className={`size-4 shrink-0 text-ink-3 ${className}`}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : label}
    />
  );
}

/** Icon plus the short label, for table cells and cards. */
export function SourceTag({ source }: { source: string | null | undefined }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 whitespace-nowrap text-ink-2">
      <SourceIcon source={source} decorative />
      <span className="truncate">{sourceLabel(source)}</span>
    </span>
  );
}
