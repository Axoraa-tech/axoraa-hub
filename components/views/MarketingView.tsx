"use client";

import React, { useMemo } from "react";
import { ArrowUpRight, CalendarClock, Handshake, MapPin, Target, TrendingUp } from "lucide-react";
import type { MarketingDeal, MarketingInteraction } from "@/lib/types";
import { delta, funnel, marketingRollup } from "@/lib/analytics";
import { usePeriod } from "@/lib/usePeriod";
import { formatDay, formatInr, pct } from "@/lib/format";
import { Avatar, CardHeader, Delta, EmptyState, PeriodPicker, StatusPill } from "@/components/ui/primitives";
import { ColumnChart, FunnelChart, TickGauge } from "@/components/charts/Charts";

export function MarketingView({
  deals,
  interactions,
  personal,
  onNewVisit,
  onOpenDeal,
  onOpenDeals,
  onOpenVisits,
}: {
  deals: MarketingDeal[];
  interactions: MarketingInteraction[];
  personal?: string;
  onNewVisit: () => void;
  onOpenDeal: (d: MarketingDeal) => void;
  onOpenDeals: () => void;
  onOpenVisits: () => void;
}) {
  const dates = useMemo(() => [...interactions.map((i) => i.date), ...deals.map((d) => d.dateAdded)], [deals, interactions]);
  const period = usePeriod(dates, "month");
  const { range, prev } = period;
  const cur = useMemo(() => marketingRollup(deals, interactions, range), [deals, interactions, range]);
  const before = useMemo(() => marketingRollup(deals, interactions, prev), [deals, interactions, prev]);
  const steps = useMemo(() => funnel(deals), [deals]);
  const winRate = pct(cur.wonCount, deals.length);

  const followUps = deals
    .filter((d) => d.leadStatus !== "Closed Won" && d.leadStatus !== "Closed Lost")
    .sort((a, b) => (a.nextFollowUpDate || "9").localeCompare(b.nextFollowUpDate || "9"))
    .slice(0, 5);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <PeriodPicker granularity={period.granularity} onGranularity={period.setGranularity} range={range} onShift={period.shift} onToday={period.reset} />
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={onNewVisit}>
            <MapPin className="w-4 h-4" /> Log visit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <div className="card-ink p-5 sm:p-6 min-h-[168px] flex flex-col justify-between animate-rise">
          <span className="text-[13px] text-white/55">Open pipeline</span>
          <div>
            <div className="num text-[44px] sm:text-[52px]">{formatInr(cur.pipeline)}</div>
            <div className="text-[12.5px] text-white/55 mt-2">
              Weighted <span className="text-lime">{formatInr(cur.weighted)}</span>
            </div>
          </div>
        </div>
        <Kpi label="Won revenue" value={formatInr(cur.wonValue)} foot={`${cur.wonCount} deal${cur.wonCount === 1 ? "" : "s"} closed`} icon={<Handshake />} />
        <Kpi label="Touchpoints" value={cur.touches.length} foot={`${cur.visits} on-site visits`} icon={<MapPin />} d={delta(cur.touches.length, before.touches.length)} />
        <Kpi label="New leads" value={cur.newLeads.length} foot={`${cur.followUpsDue} follow-ups due now`} icon={<Target />} d={delta(cur.newLeads.length, before.newLeads.length)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-4">
        <section className="card p-5 sm:p-6 xl:col-span-7">
          <CardHeader
            icon={<TrendingUp />}
            title="Sales funnel"
            subtitle={`${deals.length} leads · ${winRate}% overall win rate`}
            action={
              <button className="icon-btn" aria-label="Open deal tracker" onClick={onOpenDeals}>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            }
          />
          <div className="mt-6">
            <FunnelChart steps={steps} />
          </div>
          <div className="mt-6 grid grid-cols-3 border-t border-line pt-4">
            {[
              { k: "Lead → meeting", a: steps[2].count, b: steps[0].count },
              { k: "Meeting → proposal", a: steps[4].count, b: steps[2].count },
              { k: "Proposal → won", a: steps[5].count, b: steps[4].count },
            ].map((c, i) => (
              <div key={c.k} className={i ? "pl-4 border-l border-line" : ""}>
                <div className="text-[12px] text-ink-3">{c.k}</div>
                <div className="text-[18px] font-medium tabular-nums mt-1">{pct(c.a, c.b)}%</div>
              </div>
            ))}
          </div>
        </section>

        <section className="card-lime p-5 sm:p-6 xl:col-span-5 flex flex-col">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[17px] font-medium tracking-[-0.02em]">Win rate</h3>
              <p className="text-[12.5px] text-ink/60 mt-1">Closed won ÷ all leads</p>
            </div>
            <span className="chip bg-ink text-white">{cur.wonCount} won</span>
          </div>
          <div className="relative mx-auto w-full max-w-[300px] mt-4">
            <TickGauge value={winRate} />
            <div className="absolute inset-x-0 bottom-1 text-center">
              <div className="num text-[52px]">
                {winRate}
                <span className="text-[24px] align-top ml-0.5">%</span>
              </div>
            </div>
          </div>
          {!personal && cur.reps.length > 0 && (
            <div className="mt-auto pt-5 space-y-2">
              {cur.reps.map((r) => (
                <div key={r.name} className="flex items-center gap-3 rounded-full bg-white/85 pl-1.5 pr-4 h-11 text-[13px]">
                  <Avatar name={r.name} size={30} />
                  <span className="flex-1 font-medium">{r.name}</span>
                  <span className="text-ink-2 tabular-nums">{r.leads} leads</span>
                  <span className="font-medium tabular-nums w-10 text-right">{r.winRate}%</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-4">
        <section className="card p-5 sm:p-6 xl:col-span-7">
          <CardHeader
            icon={<MapPin />}
            title="Field activity"
            subtitle={`${range.label} · touchpoints per ${range.granularity === "year" ? "month" : "day"}`}
            action={
              <button className="btn btn-ghost btn-sm" onClick={onOpenVisits}>
                Visit log <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            }
          />
          <div className="mt-7">
            {cur.touches.length === 0 ? (
              <EmptyState icon={<MapPin />} title="No touchpoints in this period" />
            ) : (
              <ColumnChart data={range.buckets.map((b, i) => ({ label: b.label, title: b.title, value: cur.touchSeries[i] }))} height={200} />
            )}
          </div>
        </section>

        <section className="card p-5 sm:p-6 xl:col-span-5">
          <CardHeader icon={<CalendarClock />} title="Next follow-ups" subtitle="Open leads, soonest first" />
          <ul className="mt-4 divide-y divide-line">
            {followUps.length === 0 && <li className="py-6 text-[13px] text-ink-3">No open leads.</li>}
            {followUps.map((d) => (
              <li key={d.id}>
                <button onClick={() => onOpenDeal(d)} className="w-full text-left py-3.5 flex items-center gap-3">
                  <div className="w-12 text-center shrink-0">
                    <div className="text-[18px] font-medium leading-none tabular-nums">{formatDay(d.nextFollowUpDate, { day: "numeric" })}</div>
                    <div className="text-[11px] text-ink-3 mt-1">{formatDay(d.nextFollowUpDate, { month: "short" })}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium truncate">{d.companyName}</div>
                    <div className="text-[12px] text-ink-3 truncate">{d.followUpAction}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusPill status={d.dueStatus === "Overdue" ? "Overdue" : d.leadStatus} />
                    {!personal && <span className="text-[11.5px] text-ink-3">{d.marketingPerson}</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, foot, icon, d }: { label: string; value: React.ReactNode; foot: string; icon: React.ReactNode; d?: number | null }) {
  return (
    <div className="card p-5 sm:p-6 min-h-[168px] flex flex-col justify-between animate-rise">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-ink-3">{label}</span>
        <span className="w-9 h-9 rounded-full bg-surface-2 flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4">{icon}</span>
      </div>
      <div>
        <div className="flex items-end gap-2">
          <span className="num text-[40px] sm:text-[48px]">{value}</span>
          {d !== undefined && (
            <span className="mb-2">
              <Delta value={d} />
            </span>
          )}
        </div>
        <div className="text-[12.5px] text-ink-3 mt-2 truncate">{foot}</div>
      </div>
    </div>
  );
}
