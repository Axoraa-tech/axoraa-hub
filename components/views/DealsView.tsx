"use client";

import React, { useMemo, useState } from "react";
import { Briefcase, Download, FileText, MapPin, MessageCircle, Phone, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { STAGE_ORDER } from "@/lib/analytics";
import { DEAL_COLUMNS, downloadCsv } from "@/lib/export";
import { formatDateIST, formatInr, formatInrFull, relativeTime, todayKeyIST } from "@/lib/format";
import { useHub } from "@/lib/hub/context";
import { can } from "@/lib/hub/permissions";
import { MARKETING_NAMES } from "@/lib/people";
import { PREF, useLocalPref, useNow } from "@/lib/prefs";
import type { MarketingDeal } from "@/lib/types";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Select } from "@/components/ui/form";
import type { MenuItem } from "@/components/ui/Menu";
import { Avatar, EmptyState, Segmented } from "@/components/ui/primitives";
import { DelayedSkeleton, SkeletonRows } from "@/components/ui/Skeleton";
import { StatusDot, dueText, toneForDue, toneForStage } from "@/components/ui/Status";
import { DealBoard } from "@/components/crm/DealBoard";
import { SourceTag } from "@/components/crm/SourceIcon";
import { telHref, whatsappHref } from "@/components/crm/dealActions";

const VIEW_MODES = ["table", "board"] as const;
type ViewMode = (typeof VIEW_MODES)[number];
const DUE_OPTIONS = [
  { value: "Overdue", label: "Overdue" },
  { value: "Today", label: "Due today" },
  { value: "Upcoming", label: "Upcoming" },
] as const;
const CHIP = { negative: "chip-coral", warning: "chip-amber", positive: "chip-good", accent: "chip-lime", neutral: "" } as const;

const lc = (s: string | null | undefined) => (s ?? "").toLowerCase();

/** Deal tracker: every lead and deal, as a sortable table or a stage board. */
export function DealsView() {
  const { data, viewer, params, openOverlay, registerSearch } = useHub();
  const toast = useToast();
  const confirm = useConfirm();
  const now = useNow();
  const todayKey = now ? todayKeyIST(now) : "";

  const [mode, setMode] = useLocalPref<ViewMode>(PREF.dealsView, "table", VIEW_MODES);
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const [stage, setStage] = useState(() => params.get("stage") ?? "all");
  const [owner, setOwner] = useState(() => params.get("owner") ?? "all");
  const [source, setSource] = useState(() => params.get("source") ?? "all");
  const [due, setDue] = useState(() => params.get("due") ?? "all");

  const privileged = viewer.privileged;
  const canAdd = can(viewer, "deal.edit");

  const sources = useMemo(() => [...new Set([...data.settings.leadSources, ...data.deals.map((d) => d.leadSource).filter(Boolean)])], [data.settings.leadSources, data.deals]);
  const owners = useMemo(() => [...new Set([...MARKETING_NAMES, ...data.deals.map((d) => d.marketingPerson).filter(Boolean)])], [data.deals]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.deals.filter((d) => {
      if (q && ![d.companyName, d.contactPerson, d.leadId, d.city].some((s) => lc(s).includes(q))) return false;
      if (stage !== "all" && d.leadStatus !== stage) return false;
      if (privileged && owner !== "all") {
        if (owner === "unassigned" ? !!d.marketingPerson : d.marketingPerson !== owner) return false;
      }
      if (source !== "all" && d.leadSource !== source) return false;
      if (due !== "all" && d.dueStatus !== due) return false;
      return true;
    });
  }, [data.deals, query, stage, owner, source, due, privileged]);

  const filtered = query.trim() !== "" || stage !== "all" || (privileged && owner !== "all") || source !== "all" || due !== "all";
  const clearFilters = () => {
    setQuery("");
    setStage("all");
    setOwner("all");
    setSource("all");
    setDue("all");
  };

  const unsyncedIds = useMemo(() => new Set(data.unsynced.filter((u) => u.entity === "deals").map((u) => u.id)), [data.unsynced]);
  const flashKey = data.lastSaved?.entity === "deals" ? `${data.lastSaved.id}:${data.lastSaved.at}` : undefined;
  const total = rows.reduce((s, d) => s + (Number(d.estimatedDealValue) || 0), 0);
  const weighted = rows.reduce((s, d) => s + (Number(d.weightedValue) || 0), 0);
  const summary = `${rows.length} ${rows.length === 1 ? "deal" : "deals"}, ${formatInrFull(total)} in all, ${formatInr(weighted)} weighted`;

  if (!data.ready) {
    return (
      <DelayedSkeleton label="Loading deals">
        <SkeletonRows />
      </DelayedSkeleton>
    );
  }

  const open = (d: MarketingDeal) => openOverlay({ kind: "deal", dealId: d.id });
  const remove = async (d: MarketingDeal) => {
    const ok = await confirm({ title: `Delete ${d.companyName}?`, body: "The deal is removed for everyone. Visits stay in the visit log.", confirmLabel: "Delete deal", tone: "danger" });
    if (!ok) return;
    const res = await data.deleteDeal(d.id);
    toast(res.ok ? { message: `Deleted ${d.companyName}` } : { message: `Couldn't delete ${d.companyName}: ${res.error}`, tone: "negative" });
  };

  const columns: TableColumn<MarketingDeal>[] = [
    {
      id: "company",
      header: "Company",
      sortValue: (d) => lc(d.companyName),
      cell: (d) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-ink">{d.companyName || "Unnamed deal"}</div>
          <div className="truncate text-[12px] text-ink-3">{[d.contactPerson, d.city].filter(Boolean).join(", ") || "No contact yet"}</div>
        </div>
      ),
    },
    { id: "stage", header: "Stage", sortValue: (d) => STAGE_ORDER.indexOf(d.leadStatus), cell: (d) => <StatusDot tone={toneForStage(d.leadStatus)} label={d.leadStatus} /> },
    { id: "value", header: "Value", align: "right", sortValue: (d) => d.estimatedDealValue, cell: (d) => <span className="font-medium">{formatInrFull(d.estimatedDealValue)}</span> },
    { id: "weighted", header: "Weighted", align: "right", hideBelow: "lg", sortValue: (d) => d.weightedValue, cell: (d) => <span className="text-ink-2">{formatInr(d.weightedValue)}</span> },
    {
      id: "followup",
      header: "Next follow-up",
      sortValue: (d) => d.nextFollowUpDate || null,
      cell: (d) => (
        <div className="flex flex-col items-start gap-1">
          <span className="text-[13px] tabular-nums text-ink-2">{d.nextFollowUpDate ? formatDateIST(d.nextFollowUpDate) : "Not set"}</span>
          {todayKey && d.dueStatus !== "Completed" && d.nextFollowUpDate && <span className={`chip ${CHIP[toneForDue(d.dueStatus)]}`}>{dueText(d, todayKey)}</span>}
        </div>
      ),
    },
    {
      id: "owner",
      header: "Owner",
      hideBelow: "lg",
      sortValue: (d) => lc(d.marketingPerson) || null,
      cell: (d) =>
        d.marketingPerson ? (
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <Avatar name={d.marketingPerson} size={24} />
            {d.marketingPerson}
          </span>
        ) : (
          <span className="text-ink-3">Unassigned</span>
        ),
    },
    { id: "source", header: "Source", hideBelow: "lg", sortValue: (d) => lc(d.leadSource), cell: (d) => <SourceTag source={d.leadSource} /> },
    {
      id: "lastvisit",
      header: "Last visit",
      hideBelow: "md",
      sortValue: (d) => d.lastInteractionDate || null,
      cell: (d) => (d.lastInteractionDate ? <span className="whitespace-nowrap text-ink-2">{relativeTime(d.lastInteractionDate.slice(0, 10), now)}</span> : null),
    },
    { id: "lead", header: "Lead ID", hideBelow: "lg", mono: true, sortValue: (d) => d.leadId, cell: (d) => <span className="text-[12.5px] text-ink-2">{d.leadId}</span> },
  ];

  const rowActions = (d: MarketingDeal): MenuItem[] => {
    const items: MenuItem[] = [
      { label: "Open deal", icon: <Briefcase />, onSelect: () => open(d) },
      { label: "Log visit", icon: <MapPin />, onSelect: () => openOverlay({ kind: "visit", dealId: d.id }) },
      { label: "Quotation", icon: <FileText />, onSelect: () => openOverlay({ kind: "quote_print", dealId: d.id }) },
    ];
    if (can(viewer, "deal.delete", { record: d })) items.push({ label: "Delete deal", icon: <Trash2 />, tone: "danger", separatorBefore: true, onSelect: () => void remove(d) });
    return items;
  };

  const mobileCard = (d: MarketingDeal) => {
    const tel = telHref(d.phoneNumber);
    const wa = whatsappHref(d.phoneNumber);
    const who = d.contactPerson || d.companyName;
    return (
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[14px] font-medium text-ink">{d.companyName || "Unnamed deal"}</span>
          <span className="shrink-0 text-[14px] font-medium tabular-nums text-ink">{formatInr(d.estimatedDealValue)}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-ink-2">
          <StatusDot tone={toneForStage(d.leadStatus)} label={d.leadStatus} />
          {todayKey && d.dueStatus !== "Completed" && <span className={`chip ${CHIP[toneForDue(d.dueStatus)]}`}>{dueText(d, todayKey)}</span>}
        </div>
        {(tel || wa) && (
          <div className="mt-3 flex gap-2">
            {tel && (
              <a href={tel} onClick={(e) => e.stopPropagation()} aria-label={`Call ${who}`} className="icon-btn size-11">
                <Phone aria-hidden className="size-4" />
              </a>
            )}
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                aria-label={`WhatsApp ${who}`}
                className="icon-btn size-11"
              >
                <MessageCircle aria-hidden className="size-4" />
              </a>
            )}
          </div>
        )}
      </div>
    );
  };

  const empty =
    data.deals.length === 0 ? (
      <EmptyState
        icon={<Briefcase />}
        title="No deals yet"
        body={canAdd ? "Add the first lead, or log a visit and it becomes one." : "Deals your team adds show up here."}
        action={
          canAdd ? (
            <button type="button" className="btn btn-ink btn-sm" onClick={() => openOverlay({ kind: "deal", dealId: null })}>
              <Plus aria-hidden /> Add deal
            </button>
          ) : undefined
        }
      />
    ) : (
      <EmptyState
        icon={<Search />}
        title={query.trim() ? `No deals match "${query.trim()}"` : "No deals match these filters"}
        body="Try another stage or owner, or clear the filters."
        action={
          <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
            Clear filters
          </button>
        }
      />
    );

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative w-full sm:w-72">
            <span className="sr-only">Search deals</span>
            <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input
              ref={registerSearch}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Company, contact, lead ID or city"
              className="field pl-10"
            />
          </label>
          <Segmented
            label="Show deals as"
            value={mode}
            onChange={setMode}
            options={[
              { value: "table", label: "Table" },
              { value: "board", label: "Board" },
            ]}
          />
          <button
            type="button"
            className="btn btn-ghost sm:ml-auto"
            disabled={!rows.length}
            onClick={() => {
              downloadCsv(`axoraa-deals-${todayKeyIST()}`, rows, DEAL_COLUMNS);
              toast({ message: `Downloaded ${rows.length} ${rows.length === 1 ? "deal" : "deals"} as CSV` });
            }}
          >
            <Download aria-hidden className="size-4" /> Export CSV
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Select aria-label="Stage" fieldSize="sm" value={stage} onChange={(e) => setStage(e.target.value)} className="sm:w-48">
            <option value="all">All stages</option>
            {STAGE_ORDER.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          {privileged && (
            <Select aria-label="Owner" fieldSize="sm" value={owner} onChange={(e) => setOwner(e.target.value)} className="sm:w-44">
              <option value="all">All owners</option>
              {owners.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value="unassigned">Unassigned</option>
            </Select>
          )}
          <Select aria-label="Source" fieldSize="sm" value={source} onChange={(e) => setSource(e.target.value)} className="sm:w-52">
            <option value="all">All sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select aria-label="Follow-up" fieldSize="sm" value={due} onChange={(e) => setDue(e.target.value)} className="sm:w-44">
            <option value="all">Any follow-up</option>
            {DUE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          {filtered && (
            <button type="button" className="btn btn-plain btn-sm col-span-2 justify-self-start sm:col-span-1" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {unsyncedIds.size > 0 && (
        <div role="alert" className="flex flex-col gap-3 rounded-[22px] bg-coral-soft p-4 sm:flex-row sm:items-center">
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-coral text-white">
            <RefreshCw className="size-4" />
          </span>
          <p className="min-w-0 flex-1 text-[13.5px] text-ink">
            {unsyncedIds.size} {unsyncedIds.size === 1 ? "deal is" : "deals are"} not saved to Google Sheets yet. {unsyncedIds.size === 1 ? "It is" : "They are"} kept on this device.
          </p>
          <button type="button" className="btn btn-ink btn-sm self-start sm:self-auto" onClick={() => void data.retrySync()}>
            Retry
          </button>
        </div>
      )}

      {mode === "board" ? (
        rows.length === 0 ? (
          <div className="card">{empty}</div>
        ) : (
          <section className="card min-w-0 p-3 sm:p-4" aria-label="Deal board">
            <p className="px-2 pb-3 text-[12.5px] text-ink-3">{summary}</p>
            <DealBoard deals={rows} />
          </section>
        )
      ) : (
        <DataTable
          caption="Deals"
          rows={rows}
          columns={columns}
          rowKey={(d) => d.id}
          onRowClick={open}
          flashKey={flashKey}
          rowStatus={(d) => (unsyncedIds.has(d.id) ? "unsynced" : undefined)}
          rowActions={rowActions}
          rowLabel={(d) => d.companyName}
          mobileCard={mobileCard}
          initialSort={{ id: "followup", dir: "asc" }}
          empty={empty}
          footer={summary}
        />
      )}
    </div>
  );
}
