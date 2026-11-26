"use client";

import React, { useState } from "react";
import { ChevronsLeftRight, MessageCircle, Phone } from "lucide-react";
import { STAGE_ORDER } from "@/lib/analytics";
import { formatInr, formatInrFull, todayKeyIST } from "@/lib/format";
import { useHub } from "@/lib/hub/context";
import { can } from "@/lib/hub/permissions";
import { useNow } from "@/lib/prefs";
import type { LeadStageStatus, MarketingDeal } from "@/lib/types";
import { Field, Select } from "@/components/ui/form";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { Avatar } from "@/components/ui/primitives";
import { dueText, toneForDue } from "@/components/ui/Status";
import { SourceIcon } from "./SourceIcon";
import { STAGE_SHORT, telHref, useDealMover, whatsappHref } from "./dealActions";

const CHIP = { negative: "chip-coral", warning: "chip-amber", positive: "chip-good", accent: "chip-lime", neutral: "" } as const;
const START_COLLAPSED: LeadStageStatus[] = ["Closed Lost", "On Hold"];

/**
 * One column per stage. Drag a card to another column, or use its menu (keyboard and touch).
 * Closed Lost and On Hold start collapsed. Below md it becomes a stage picker plus a list.
 */
export function DealBoard({ deals }: { deals: MarketingDeal[] }) {
  const { data, viewer, openOverlay } = useHub();
  const move = useDealMover();
  const now = useNow();
  const todayKey = now ? todayKeyIST(now) : "";

  const [collapsed, setCollapsed] = useState<Set<LeadStageStatus>>(() => new Set(START_COLLAPSED));
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<LeadStageStatus | null>(null);
  const [mobileStage, setMobileStage] = useState<LeadStageStatus>(() => STAGE_ORDER.find((s) => deals.some((d) => d.leadStatus === s)) ?? "New Lead");

  const flash = data.lastSaved?.entity === "deals" ? `${data.lastSaved.id}:${data.lastSaved.at}` : "";
  const byStage = (s: LeadStageStatus) => deals.filter((d) => d.leadStatus === s);

  const toggle = (s: LeadStageStatus) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  const drop = (s: LeadStageStatus, id: string | null) => {
    const d = deals.find((x) => x.id === id);
    setDragId(null);
    setOver(null);
    if (d && d.leadStatus !== s) void move(d, s);
  };

  const dropProps = (s: LeadStageStatus) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!dragId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (over !== s) setOver(s);
    },
    onDragLeave: (e: React.DragEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((o) => (o === s ? null : o));
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      drop(s, dragId ?? e.dataTransfer.getData("text/plain"));
    },
  });

  const card = (d: MarketingDeal, opts: { phoneActions?: boolean } = {}) => (
    <DealCard
      key={flash.startsWith(`${d.id}:`) ? `${d.id}~${flash}` : d.id}
      deal={d}
      todayKey={todayKey}
      flash={flash.startsWith(`${d.id}:`)}
      editable={can(viewer, "deal.edit", { record: d })}
      dragging={dragId === d.id}
      phoneActions={opts.phoneActions}
      onOpen={() => openOverlay({ kind: "deal", dealId: d.id })}
      onMove={(s) => void move(d, s)}
      onDragStart={() => setDragId(d.id)}
      onDragEnd={() => {
        setDragId(null);
        setOver(null);
      }}
    />
  );

  return (
    <>
      {/* Tablet and desktop: the board, scrolling sideways inside itself */}
      <div className="no-scrollbar -mx-1 hidden gap-3 overflow-x-auto px-1 pb-2 md:flex" role="list" aria-label="Deals by stage">
        {STAGE_ORDER.map((s) => {
          const list = byStage(s);
          const total = list.reduce((n, d) => n + (Number(d.estimatedDealValue) || 0), 0);
          const weighted = list.reduce((n, d) => n + (Number(d.weightedValue) || 0), 0);
          const isOver = over === s;
          if (collapsed.has(s)) {
            return (
              <div key={s} role="listitem" {...dropProps(s)} className={`shrink-0 rounded-[22px] bg-surface-2 transition-shadow ${isOver ? "drop-target" : ""}`}>
                <button
                  type="button"
                  onClick={() => toggle(s)}
                  aria-label={`Show ${s}, ${list.length} ${list.length === 1 ? "deal" : "deals"}`}
                  aria-expanded={false}
                  className="flex h-full min-h-[280px] w-14 flex-col items-center gap-3 rounded-[22px] py-4 transition-colors hover:bg-surface-3"
                >
                  <span className="chip chip-outline">{list.length}</span>
                  <span className="text-[13px] font-medium text-ink-2 [writing-mode:vertical-rl]">{s}</span>
                  <ChevronsLeftRight aria-hidden className="mt-auto size-4 text-ink-3" />
                </button>
              </div>
            );
          }
          return (
            <section
              key={s}
              role="listitem"
              aria-label={`${s}, ${list.length} ${list.length === 1 ? "deal" : "deals"}`}
              {...dropProps(s)}
              className={`flex w-[272px] shrink-0 flex-col rounded-[22px] bg-surface-2 p-3 transition-shadow ${isOver ? "drop-target" : ""}`}
            >
              <header className="px-2 pb-3 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <h3 className="truncate text-[14px] font-medium text-ink">{s}</h3>
                    <span className="chip chip-outline">{list.length}</span>
                  </div>
                  {START_COLLAPSED.includes(s) && (
                    <button type="button" className="icon-btn icon-btn-sm icon-btn-plain" aria-label={`Collapse ${s}`} aria-expanded onClick={() => toggle(s)}>
                      <ChevronsLeftRight aria-hidden />
                    </button>
                  )}
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2 text-[12px] tabular-nums text-ink-3">
                  <span className="font-medium text-ink-2" title={formatInrFull(total)}>
                    {formatInr(total)}
                  </span>
                  <span>Weighted {formatInr(weighted)}</span>
                </div>
              </header>
              <ul className="flex-1 space-y-2">
                {list.length === 0 && <li className="dashed-slot rounded-[18px] px-4 py-6 text-center text-[13px] text-ink-3">{dragId ? "Drop here" : "No deals"}</li>}
                {list.map((d) => card(d))}
              </ul>
            </section>
          );
        })}
      </div>

      {/* Phones: pick a stage, see its deals */}
      <div className="space-y-3 md:hidden">
        <Field label="Stage" htmlFor="board-mobile-stage">
          <Select id="board-mobile-stage" value={mobileStage} onChange={(e) => setMobileStage(e.target.value as LeadStageStatus)}>
            {STAGE_ORDER.map((s) => (
              <option key={s} value={s}>
                {s} ({byStage(s).length})
              </option>
            ))}
          </Select>
        </Field>
        {(() => {
          const list = byStage(mobileStage);
          const total = list.reduce((n, d) => n + (Number(d.estimatedDealValue) || 0), 0);
          return (
            <>
              <p className="px-1 text-[12.5px] text-ink-3">
                {list.length} {list.length === 1 ? "deal" : "deals"}, {formatInr(total)} in all
              </p>
              <ul className="space-y-2">
                {list.length === 0 && <li className="dashed-slot rounded-[18px] px-4 py-6 text-center text-[13px] text-ink-3">No deals in {mobileStage}</li>}
                {list.map((d) => card(d, { phoneActions: true }))}
              </ul>
            </>
          );
        })()}
      </div>
    </>
  );
}

function DealCard({
  deal,
  todayKey,
  flash,
  editable,
  dragging,
  phoneActions,
  onOpen,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  deal: MarketingDeal;
  todayKey: string;
  flash: boolean;
  editable: boolean;
  dragging: boolean;
  phoneActions?: boolean;
  onOpen: () => void;
  onMove: (s: LeadStageStatus) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const items: MenuItem[] = [{ label: "Open deal", onSelect: onOpen }];
  if (editable) {
    STAGE_ORDER.filter((s) => s !== deal.leadStatus).forEach((s, i) => items.push({ label: `Move to ${s}`, onSelect: () => onMove(s), separatorBefore: i === 0 }));
  }
  const due = todayKey ? dueText(deal, todayKey) : "";
  const tel = phoneActions ? telHref(deal.phoneNumber) : null;
  const wa = phoneActions ? whatsappHref(deal.phoneNumber) : null;

  return (
    <li
      draggable={editable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", deal.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`card-interactive rounded-[18px] bg-surface p-4 shadow-card ${editable ? "cursor-grab active:cursor-grabbing" : ""} ${dragging ? "opacity-50" : ""} ${
        flash ? "animate-flash" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-[14px] font-medium text-ink">{deal.companyName || "Unnamed deal"}</span>
          <span className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-ink-3">
            <SourceIcon source={deal.leadSource} className="size-3.5" />
            <span className="truncate">{[deal.contactPerson, deal.city].filter(Boolean).join(", ") || STAGE_SHORT[deal.leadStatus]}</span>
          </span>
        </button>
        <Menu label={`Move ${deal.companyName || "deal"} to stage…`} items={items} triggerClassName="icon-btn icon-btn-sm icon-btn-plain -mr-1 -mt-1" />
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <span className="num truncate text-[22px]" title={formatInrFull(deal.estimatedDealValue)}>
          {formatInr(deal.estimatedDealValue)}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {due && <span className={`chip ${CHIP[toneForDue(deal.dueStatus)]}`}>{due}</span>}
          {deal.marketingPerson ? <Avatar name={deal.marketingPerson} size={26} /> : <span className="chip chip-outline">Unassigned</span>}
        </span>
      </div>
      {(tel || wa) && (
        <div className="mt-3 flex gap-2 border-t border-line pt-3">
          {tel && (
            <a href={tel} className="btn btn-ghost btn-sm min-h-11 flex-1" aria-label={`Call ${deal.contactPerson || deal.companyName}`}>
              <Phone aria-hidden /> Call
            </a>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm min-h-11 flex-1" aria-label={`WhatsApp ${deal.contactPerson || deal.companyName}`}>
              <MessageCircle aria-hidden /> WhatsApp
            </a>
          )}
        </div>
      )}
    </li>
  );
}
