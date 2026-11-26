"use client";

import React, { useMemo } from "react";
import { ArrowUpRight, History, MapPin, PenLine } from "lucide-react";
import { visitLinksDeal } from "@/lib/analytics";
import { formatDateIST, formatDateTimeIST, parseInstant } from "@/lib/format";
import { useHub } from "@/lib/hub/context";
import type { AgentKey } from "@/lib/agents/types";
import type { MarketingDeal, MarketingInteraction } from "@/lib/types";
import { EmptyState } from "@/components/ui/primitives";
import { StatusDot, type Tone } from "@/components/ui/Status";

const DRAFT_NOUN: Partial<Record<AgentKey, string>> = {
  follow_up: "Follow-up",
  proposal_outline: "Proposal outline",
  visit_notes: "Visit notes",
  prospect_brief: "Prospect brief",
  pipeline_review: "Pipeline review",
};

const INTEREST_TONE: Record<MarketingInteraction["interestLevel"], Tone> = { Hot: "negative", Warm: "warning", Cold: "neutral" };

type Item =
  | { kind: "visit"; at: number; id: string; visit: MarketingInteraction }
  | { kind: "activity"; at: number; id: string; actor: string; summary: string; when: string }
  | { kind: "draft"; at: number; id: string; text: string; draftId: string };

/** Visits linked to the deal, its activity and the assistant drafts about it, newest first. */
export function DealTimeline({ deal }: { deal: MarketingDeal }) {
  const { data, openOverlay } = useHub();

  const items = useMemo(() => {
    const out: Item[] = [];
    for (const v of data.interactions) {
      if (!visitLinksDeal(v, deal)) continue;
      out.push({ kind: "visit", at: parseInstant(v.date) ?? 0, id: `v:${v.id}`, visit: v });
    }
    for (const a of data.activity) {
      if (a.entity !== "deals" || a.entityId !== deal.id) continue;
      out.push({ kind: "activity", at: parseInstant(a.at) ?? 0, id: `a:${a.id}`, actor: a.actorName, summary: a.summary, when: formatDateTimeIST(a.at) });
    }
    for (const d of data.drafts) {
      if (d.ref?.type !== "deal" || d.ref.id !== deal.id) continue;
      const noun = DRAFT_NOUN[d.agentKey] ?? "Draft";
      out.push({
        kind: "draft",
        at: parseInstant(d.createdAt) ?? 0,
        id: `d:${d.id}`,
        draftId: d.id,
        text: `${noun} drafted by ${d.createdByName || "the assistant"}, ${formatDateIST(d.createdAt)}`,
      });
    }
    return out.sort((a, b) => b.at - a.at);
  }, [data.interactions, data.activity, data.drafts, deal]);

  if (!items.length) {
    return (
      <EmptyState
        icon={<History />}
        title="Nothing on the timeline yet"
        body="Visits you log for this deal, changes and assistant drafts show up here."
        action={
          <button type="button" className="btn btn-ink btn-sm" onClick={() => openOverlay({ kind: "visit", dealId: deal.id })}>
            <MapPin aria-hidden /> Log a visit
          </button>
        }
      />
    );
  }

  return (
    <ol className="relative space-y-3 pt-1" aria-label={`Timeline for ${deal.companyName}`}>
      <span aria-hidden className="absolute bottom-3 left-[17px] top-3 w-px bg-line" />
      {items.map((it) => (
        <li key={it.id} className="relative flex gap-3 animate-rise">
          <span
            aria-hidden
            className={`relative z-[1] flex size-9 shrink-0 items-center justify-center rounded-full [&>svg]:size-4 ${
              it.kind === "visit" ? "bg-lime text-on-lime" : it.kind === "draft" ? "bg-ink text-lime dark:bg-surface-3" : "bg-surface-2 text-ink-2"
            }`}
          >
            {it.kind === "visit" ? <MapPin /> : it.kind === "draft" ? <PenLine /> : <History />}
          </span>
          <div className="min-w-0 flex-1 pb-1">
            {it.kind === "visit" && <VisitEntry v={it.visit} onOpen={() => openOverlay({ kind: "visit", visitId: it.visit.id })} />}
            {it.kind === "activity" && (
              <div className="pt-1.5">
                <p className="text-[13.5px] text-ink">{it.summary}</p>
                <p className="mt-0.5 text-[12px] text-ink-3">
                  {it.actor}, {it.when}
                </p>
              </div>
            )}
            {it.kind === "draft" && (
              <button
                type="button"
                onClick={() => openOverlay({ kind: "draft", draftId: it.draftId })}
                className="group flex w-full items-center justify-between gap-2 rounded-[14px] px-0 pt-1.5 text-left"
              >
                <span className="text-[13.5px] text-ink underline-offset-2 group-hover:underline">{it.text}</span>
                <ArrowUpRight aria-hidden className="size-3.5 shrink-0 text-ink-3" />
              </button>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function VisitEntry({ v, onOpen }: { v: MarketingInteraction; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="card-inset card-interactive block w-full p-4 text-left">
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13.5px] font-medium text-ink">
          {formatDateIST(v.date, { weekday: true })}, {v.interactionType || "Visit"}
        </span>
        <StatusDot tone={INTEREST_TONE[v.interestLevel] ?? "neutral"} label={v.interestLevel || "No interest set"} />
      </span>
      <span className="mt-1 block text-[12px] text-ink-3">
        {[v.meetingMode, v.interactionOutcome, v.personsMet ? `met ${v.personsMet}` : ""].filter(Boolean).join(", ")}
      </span>
      {v.discussionFeedback && <span className="mt-2 line-clamp-3 block text-[13px] text-ink-2">{v.discussionFeedback}</span>}
      {v.nextSteps && (
        <span className="mt-2 block text-[12.5px] text-ink-2">
          <span className="text-ink-3">Next: </span>
          {v.nextSteps}
        </span>
      )}
    </button>
  );
}
