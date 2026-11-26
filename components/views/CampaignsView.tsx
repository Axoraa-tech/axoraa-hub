"use client";

import React, { useMemo, useState } from "react";
import { Megaphone, PenLine, Plus, Search } from "lucide-react";
import { campaignRollup } from "@/lib/analytics";
import { agentRoleOf, agentsFor } from "@/lib/agents/catalog";
import { formatDateIST, formatInr, formatInrFull, fyOf, todayKeyIST } from "@/lib/format";
import { useHub } from "@/lib/hub/context";
import { can } from "@/lib/hub/permissions";
import { useNow } from "@/lib/prefs";
import type { Campaign } from "@/lib/types";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { CardHeader, Avatar, EmptyState, Segmented, Toolbar } from "@/components/ui/primitives";
import { StatusDot, type Tone } from "@/components/ui/Status";
import { SummaryBand } from "@/components/ui/SummaryBand";

type StatusFilter = "all" | Campaign["status"];

export const CAMPAIGN_STATUS_TONE: Record<Campaign["status"], Tone> = { Active: "positive", Planning: "accent", Paused: "warning", Completed: "neutral" };

function dateRange(c: Campaign): string {
  if (!c.startDate) return "";
  return c.endDate ? `${formatDateIST(c.startDate)} to ${formatDateIST(c.endDate, { year: true })}` : `From ${formatDateIST(c.startDate, { year: true })}`;
}

export function CampaignsView() {
  const { data, viewer, navigate, openOverlay, registerSearch } = useHub();
  const now = useNow();
  const todayKey = todayKeyIST(now);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [q, setQ] = useState("");
  const canEdit = can(viewer, "campaign.edit", { data });
  const canPlan = agentsFor(agentRoleOf(viewer.category), data.settings.disabledAgents).some((a) => a.key === "meta_campaign");

  const roll = useMemo(() => new Map(campaignRollup(data.campaigns, data.deals).map((r) => [r.id, r])), [data.campaigns, data.deals]);

  const fy = fyOf(todayKey);
  const fyStart = `${fy.startYear}-04-01`;
  const fyEnd = `${fy.startYear + 1}-03-31`;
  const inFy = data.campaigns.filter((c) => {
    const s = (c.startDate || "").slice(0, 10);
    const e = (c.endDate || c.startDate || "").slice(0, 10);
    return (s >= fyStart && s <= fyEnd) || (e >= fyStart && e <= fyEnd) || (s && s < fyStart && (!c.endDate || e > fyEnd));
  });
  const fySpend = inFy.reduce((s, c) => s + (roll.get(c.id)?.spend ?? 0), 0);
  const fyLeads = inFy.reduce((s, c) => s + (roll.get(c.id)?.leads ?? 0), 0);
  const won = data.campaigns.reduce((s, c) => s + (roll.get(c.id)?.won ?? 0), 0);
  const active = data.campaigns.filter((c) => c.status === "Active").length;
  const planning = data.campaigns.filter((c) => c.status === "Planning").length;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.campaigns
      .filter((c) => (status === "all" ? true : c.status === status))
      .filter((c) => !needle || `${c.name} ${c.platform} ${c.ownerName} ${c.audience}`.toLowerCase().includes(needle))
      .sort((a, b) => String(b.startDate || "").localeCompare(String(a.startDate || "")));
  }, [data.campaigns, status, q]);

  const ranked = data.campaigns
    .map((c) => ({ c, r: roll.get(c.id)! }))
    .filter((x) => x.r && x.r.leads > 0)
    .sort((a, b) => a.r.cpl - b.r.cpl)
    .slice(0, 6);
  const worstCpl = Math.max(1, ...ranked.map((x) => x.r.cpl));

  const columns: TableColumn<Campaign>[] = [
    {
      id: "name",
      header: "Campaign",
      cell: (c) => (
        <span className="min-w-0">
          <span className="block truncate font-medium text-ink">{c.name}</span>
          {c.source === "meta" && <span className="block text-[12px] text-ink-3">Synced from Meta</span>}
        </span>
      ),
      sortValue: (c) => c.name,
    },
    { id: "platform", header: "Platform", cell: (c) => c.platform, sortValue: (c) => c.platform, hideBelow: "lg" },
    { id: "status", header: "Status", cell: (c) => <StatusDot tone={CAMPAIGN_STATUS_TONE[c.status] ?? "neutral"} label={c.status} />, sortValue: (c) => c.status, width: 120 },
    { id: "dates", header: "Dates", cell: (c) => dateRange(c), sortValue: (c) => c.startDate, hideBelow: "lg" },
    { id: "budget", header: "Budget", align: "right", cell: (c) => (c.totalBudget ? formatInr(c.totalBudget) : ""), sortValue: (c) => c.totalBudget },
    {
      id: "spend",
      header: "Spend",
      align: "right",
      cell: (c) => {
        const spend = roll.get(c.id)?.spend ?? 0;
        const pct = c.totalBudget ? Math.min(100, Math.round((spend / c.totalBudget) * 100)) : 0;
        return (
          <span className="inline-flex flex-col items-end gap-1">
            <span title={formatInrFull(spend)}>{formatInr(spend)}</span>
            {c.totalBudget > 0 && (
              <span aria-hidden className="hatch block h-1.5 w-16 overflow-hidden rounded-full">
                <span className={`block h-full rounded-full ${pct >= 100 ? "bg-coral" : "bg-lime"}`} style={{ width: `${pct}%` }} />
              </span>
            )}
          </span>
        );
      },
      sortValue: (c) => roll.get(c.id)?.spend ?? 0,
    },
    { id: "leads", header: "Leads", align: "right", cell: (c) => roll.get(c.id)?.leads ?? 0, sortValue: (c) => roll.get(c.id)?.leads ?? 0 },
    {
      id: "cpl",
      header: "Cost per lead",
      align: "right",
      cell: (c) => {
        const r = roll.get(c.id);
        return r && r.leads ? formatInrFull(r.cpl) : "";
      },
      sortValue: (c) => {
        const r = roll.get(c.id);
        return r && r.leads ? r.cpl : null;
      },
      hideBelow: "md",
    },
    {
      id: "owner",
      header: "Owner",
      cell: (c) => (
        <span className="inline-flex items-center gap-2">
          <Avatar name={c.ownerName} size={24} />
          <span className="hidden xl:inline">{c.ownerName}</span>
        </span>
      ),
      sortValue: (c) => c.ownerName,
      hideBelow: "lg",
    },
  ];

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-5">
      <SummaryBand
        hero
        ariaLabel="Campaign summary"
        items={[
          { label: "Active campaigns", value: active, compare: { text: planning ? `${planning} in planning` : "None in planning" } },
          { label: `Spend (${fy.label})`, value: formatInr(fySpend), compare: { text: `${inFy.length} ${inFy.length === 1 ? "campaign" : "campaigns"} this year` } },
          { label: `Leads (${fy.label})`, value: fyLeads },
          { label: "Cost per lead", value: fyLeads ? formatInr(Math.round(fySpend / fyLeads)) : "–", compare: { text: fyLeads ? formatInrFull(Math.round(fySpend / fyLeads)) : "No leads yet" } },
          { label: "Deals won from campaigns", value: won, onClick: won ? () => navigate("mkt_deals") : undefined },
        ]}
      />

      <Toolbar className="justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <label className="relative block min-w-0 flex-1 basis-[200px] sm:max-w-[300px]">
            <span className="sr-only">Search campaigns</span>
            <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input ref={registerSearch} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search campaigns" className="field pl-10" />
          </label>
          <div className="no-scrollbar max-w-full overflow-x-auto">
            <Segmented<StatusFilter>
              label="Campaign status"
              value={status}
              onChange={setStatus}
              options={[
                { value: "all", label: "All" },
                { value: "Active", label: "Active" },
                { value: "Planning", label: "Planning" },
                { value: "Paused", label: "Paused" },
                { value: "Completed", label: "Done" },
              ]}
            />
          </div>
        </div>
        {canPlan && (
          <button type="button" className="btn btn-lime" onClick={() => navigate("assistant", { agent: "meta_campaign", ref: null, tab: null })}>
            <PenLine aria-hidden /> Plan with assistant
          </button>
        )}
      </Toolbar>

      <DataTable
        caption="Campaigns"
        rows={rows}
        columns={columns}
        rowKey={(c) => c.id}
        onRowClick={(c) => openOverlay({ kind: "campaign", campaignId: c.id })}
        rowLabel={(c) => c.name}
        flashKey={data.lastSaved?.entity === "campaigns" ? `${data.lastSaved.id}:${data.lastSaved.at}` : undefined}
        rowStatus={(c) => (data.unsynced.some((u) => u.entity === "campaigns" && u.id === c.id) ? "unsynced" : undefined)}
        mobileCard={(c) => {
          const r = roll.get(c.id);
          return (
            <>
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 truncate text-[14px] font-medium text-ink">{c.name}</span>
                <StatusDot tone={CAMPAIGN_STATUS_TONE[c.status] ?? "neutral"} label={c.status} />
              </div>
              <p className="mt-1 text-[12.5px] text-ink-3">
                {c.platform}
                {c.startDate ? `, ${dateRange(c)}` : ""}
              </p>
              <dl className="mt-2.5 grid grid-cols-3 gap-2 text-[12px]">
                <div>
                  <dt className="text-ink-3">Spend</dt>
                  <dd className="font-medium tabular-nums text-ink">{formatInr(r?.spend ?? 0)}</dd>
                </div>
                <div>
                  <dt className="text-ink-3">Leads</dt>
                  <dd className="font-medium tabular-nums text-ink">{r?.leads ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-ink-3">Per lead</dt>
                  <dd className="font-medium tabular-nums text-ink">{r && r.leads ? formatInr(r.cpl) : "–"}</dd>
                </div>
              </dl>
            </>
          );
        }}
        empty={
          q || status !== "all" ? (
            <EmptyState icon={<Search />} title="No campaigns match" body="Try another status or clear the search." />
          ) : (
            <EmptyState
              icon={<Megaphone />}
              title="No campaigns yet"
              body="Track budget, spend and leads for each campaign, or let the assistant draft a Meta plan."
              action={
                canEdit ? (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => openOverlay({ kind: "campaign" })}>
                    <Plus aria-hidden /> Add campaign
                  </button>
                ) : undefined
              }
            />
          )
        }
      />

      {ranked.length > 1 && (
        <section className="card min-w-0 p-5 sm:p-6">
          <CardHeader icon={<Megaphone />} title="Cost per lead" subtitle="Cheapest first, campaigns with at least one lead" />
          <ul className="mt-5 space-y-3.5">
            {ranked.map(({ c, r }, i) => (
              <li key={c.id}>
                <button type="button" className="group w-full text-left" onClick={() => openOverlay({ kind: "campaign", campaignId: c.id })}>
                  <span className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="min-w-0 truncate text-ink group-hover:underline">{c.name}</span>
                    <span className="shrink-0 tabular-nums text-ink-2">
                      {formatInrFull(r.cpl)}
                      <span className="text-ink-3">, {r.leads} leads</span>
                    </span>
                  </span>
                  <span aria-hidden className="hatch mt-1.5 block h-3 overflow-hidden rounded-full">
                    <span
                      className={`block h-full rounded-full animate-grow-x ${i === 0 ? "bg-lime" : "bg-ink-3/60"}`}
                      style={{ width: `${Math.max(6, Math.round((r.cpl / worstCpl) * 100))}%`, transformOrigin: "left" }}
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
