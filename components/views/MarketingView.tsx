"use client";

import React, { useMemo } from "react";
import { ArrowRight, ArrowUpRight, CalendarClock, CalendarDays, Handshake, MapPin, Plus, Target, TrendingUp, UsersRound } from "lucide-react";
import { activityHeatmap, delta, funnel, inRange, marketingRollup, type Granularity, type Range } from "@/lib/analytics";
import { dayKeyOf, formatDateIST, formatInr, formatInrFull, pct, todayKeyIST } from "@/lib/format";
import { useHub } from "@/lib/hub/context";
import { can } from "@/lib/hub/permissions";
import { MARKETING_NAMES, personByName } from "@/lib/people";
import { useNow } from "@/lib/prefs";
import { usePeriod } from "@/lib/usePeriod";
import type { MarketingDeal, MarketingInteraction } from "@/lib/types";
import { ColumnChart, FunnelChart, Heatmap, Sparkline, TickGauge } from "@/components/charts/Charts";
import { Avatar, CardHeader, Delta, EmptyState, PeriodPicker, SectionHeader } from "@/components/ui/primitives";
import { DelayedSkeleton } from "@/components/ui/Skeleton";
import { StatusDot, dueText, toneForDue, type Tone } from "@/components/ui/Status";

const CHIP = { negative: "chip-coral", warning: "chip-amber", positive: "chip-good", accent: "chip-lime", neutral: "" } as const;
const INTEREST_TONE: Record<string, Tone> = { Hot: "negative", Warm: "warning", Cold: "neutral" };
const isOpen = (d: MarketingDeal) => d.leadStatus !== "Closed Won" && d.leadStatus !== "Closed Lost";

/** The day a deal was won: conversionDate, else its last contact, else the day it was added. */
function wonDay(d: MarketingDeal): string | undefined {
  return dayKeyOf(d.conversionDate) ?? dayKeyOf(d.lastInteractionDate) ?? dayKeyOf(d.dateAdded) ?? undefined;
}

function rollup(deals: MarketingDeal[], interactions: MarketingInteraction[], range: Range) {
  const base = marketingRollup(deals, interactions, range);
  const won = deals.filter((d) => d.leadStatus === "Closed Won" && inRange(wonDay(d), range));
  const added = base.newLeads.reduce((s, d) => s + (Number(d.estimatedDealValue) || 0), 0);
  return { ...base, wonInPeriod: won, wonInPeriodValue: won.reduce((s, d) => s + (Number(d.estimatedDealValue) || 0), 0), addedValue: added };
}

/** 'last week', 'Oct', 'last quarter', 'FY26': what the previous period is called in comparisons. */
function baselineName(g: Granularity, prev: Range): string {
  if (g === "week") return "last week";
  if (g === "month") return prev.label.split(" ")[0]?.slice(0, 3) || "last month";
  if (g === "quarter") return "last quarter";
  return prev.label;
}

/**
 * Pipeline. Team mode (view 'mkt'): the whole sales team. Personal mode (view 'today', below
 * TodayView): the signed-in rep's own week, 26-week visit heatmap and recent visits.
 */
export function MarketingView() {
  const { data, view, viewer, navigate, openOverlay } = useHub();
  const personal = view === "today";
  const { deals, interactions } = data;
  const now = useNow();
  const todayKey = now ? todayKeyIST(now) : "";

  const dates = useMemo(() => [...interactions.map((i) => i.date), ...deals.map((d) => d.dateAdded)], [deals, interactions]);
  const period = usePeriod(dates, personal ? "week" : "month");
  const { range, prev } = period;
  const cur = useMemo(() => rollup(deals, interactions, range), [deals, interactions, range]);
  const before = useMemo(() => rollup(deals, interactions, prev), [deals, interactions, prev]);
  const steps = useMemo(() => funnel(deals), [deals]);
  const wonAll = deals.filter((d) => d.leadStatus === "Closed Won").length;
  const lost = deals.filter((d) => d.leadStatus === "Closed Lost").length;
  const onHold = deals.filter((d) => d.leadStatus === "On Hold").length;
  const openCount = deals.filter(isOpen).length;
  const winRate = pct(wonAll, deals.length);
  const vs = baselineName(range.granularity, prev);
  const perBucket = range.granularity === "year" ? "month" : range.granularity === "quarter" ? "week" : "day";

  const followUps = useMemo(
    () =>
      deals
        .filter(isOpen)
        .sort((a, b) => (a.nextFollowUpDate || "9").localeCompare(b.nextFollowUpDate || "9"))
        .slice(0, 8),
    [deals]
  );

  const prevTouches = useMemo(() => {
    const series = prev.buckets.map(() => 0);
    for (const t of before.touches) {
      const i = prev.buckets.findIndex((b) => inRange(t.date, b));
      if (i >= 0) series[i]++;
    }
    return series;
  }, [prev, before.touches]);

  const reps = useMemo(() => {
    if (personal) return [];
    return MARKETING_NAMES.map((name) => {
      const rd = deals.filter((d) => d.marketingPerson === name);
      const touches = cur.touches.filter((t) => t.marketingPerson === name);
      const won = rd.filter((d) => d.leadStatus === "Closed Won").length;
      return {
        name,
        title: personByName(name)?.title ?? "",
        leads: rd.length,
        visits: touches.length,
        wonValue: cur.wonInPeriod.filter((d) => d.marketingPerson === name).reduce((s, d) => s + (Number(d.estimatedDealValue) || 0), 0),
        winRate: pct(won, rd.length),
        overdue: rd.filter((d) => isOpen(d) && d.dueStatus === "Overdue").length,
        series: range.buckets.map((b) => touches.filter((t) => inRange(t.date, b)).length),
      };
    });
  }, [personal, deals, cur, range]);
  const unassigned = personal ? 0 : deals.filter((d) => !d.marketingPerson && isOpen(d)).length;

  const heat = useMemo(() => (personal && todayKey ? activityHeatmap(interactions.map((i) => i.date), 26, todayKey) : []), [personal, interactions, todayKey]);
  const heatTotal = heat.reduce((s, c) => s + c.value, 0);
  const heatDays = heat.filter((c) => c.value > 0).length;
  const recent = useMemo(() => (personal ? [...interactions].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 5) : []), [personal, interactions]);

  if (!data.ready) return <DelayedSkeleton label="Loading the pipeline" />;

  const canLog = can(viewer, "visit.edit");
  const canAdd = can(viewer, "deal.edit");
  const logVisit = canLog ? (
    <button type="button" className="btn btn-ghost" onClick={() => openOverlay({ kind: "visit" })}>
      <MapPin aria-hidden className="size-4" /> Log visit
    </button>
  ) : null;
  const picker = <PeriodPicker granularity={period.granularity} onGranularity={period.setGranularity} range={range} onShift={period.shift} onToday={period.reset} />;

  return (
    <div className="space-y-3 sm:space-y-4">
      {personal ? (
        <div className="space-y-3 pt-2">
          <SectionHeader title="Your week" description="Your pipeline, visits and follow-ups, compared with the period before." actions={logVisit} />
          {picker}
        </div>
      ) : (
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          {picker}
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 text-[12.5px] text-ink-3 lg:flex">
              <span aria-hidden className="size-2 rounded-full bg-good" />
              Compared with {vs}
            </span>
            {logVisit}
          </div>
        </div>
      )}

      {/* Figures */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <div className="card-ink flex min-h-[168px] animate-rise flex-col justify-between p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-white/55">Open pipeline</span>
            <button
              type="button"
              onClick={() => navigate("mkt_deals")}
              aria-label="Open the deal tracker"
              className="flex size-9 items-center justify-center rounded-full bg-white/10 text-lime transition-colors hover:bg-white/15"
            >
              <TrendingUp aria-hidden className="size-4" />
            </button>
          </div>
          <div className="mt-4">
            <div className="num truncate text-[44px] sm:text-[52px]" title={formatInrFull(cur.pipeline)}>
              {formatInr(cur.pipeline)}
            </div>
            <div className="mt-2 text-[12.5px] text-white/55">
              Weighted <span className="text-lime">{formatInr(cur.weighted)}</span>, {openCount} open {openCount === 1 ? "deal" : "deals"}
            </div>
          </div>
        </div>
        <Kpi
          label="Won"
          icon={<Handshake />}
          value={formatInr(cur.wonInPeriodValue)}
          d={delta(cur.wonInPeriodValue, before.wonInPeriodValue)}
          vs={vs}
          foot={`${cur.wonInPeriod.length} ${cur.wonInPeriod.length === 1 ? "deal" : "deals"} closed in ${range.label}`}
          onOpen={() => navigate("mkt_deals", { stage: "Closed Won" })}
          openLabel="Open won deals"
          delay={60}
        />
        <Kpi
          label="Visits"
          icon={<MapPin />}
          value={cur.touches.length}
          d={delta(cur.touches.length, before.touches.length)}
          vs={vs}
          foot={`${cur.visits} on-site, ${cur.touches.length - cur.visits} calls and video`}
          onOpen={() => navigate("mkt_visits")}
          openLabel="Open the visit log"
          delay={120}
        />
        <Kpi
          label="New leads"
          icon={<Target />}
          value={cur.newLeads.length}
          d={delta(cur.newLeads.length, before.newLeads.length)}
          vs={vs}
          foot={`${formatInr(cur.addedValue)} added, ${cur.followUpsDue} follow-ups due now`}
          onOpen={() => navigate("mkt_deals", { due: cur.followUpsDue ? "Overdue" : null })}
          openLabel="Open the deal tracker"
          delay={180}
        />
      </div>

      {/* Funnel and win rate */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-12">
        <section className="card min-w-0 animate-rise p-5 sm:p-6 xl:col-span-7">
          <CardHeader
            icon={<TrendingUp />}
            title="Sales funnel"
            subtitle={`${deals.length} ${deals.length === 1 ? "lead" : "leads"}, ${winRate}% overall win rate`}
            action={
              <button type="button" className="icon-btn" aria-label="Open the deal tracker" onClick={() => navigate("mkt_deals")}>
                <ArrowUpRight aria-hidden className="size-4" />
              </button>
            }
          />
          <div className="mt-6">
            <FunnelChart steps={steps} ariaLabel="Deals reaching each stage" emptyLabel="No deals in the pipeline yet. Add a lead to start the funnel." />
          </div>
          <div className="mt-6 grid grid-cols-3 border-t border-line pt-4">
            {[
              { k: "Lead to meeting", a: steps[2].count, b: steps[0].count },
              { k: "Meeting to proposal", a: steps[4].count, b: steps[2].count },
              { k: "Proposal to won", a: steps[5].count, b: steps[4].count },
            ].map((c, i) => (
              <div key={c.k} className={`min-w-0 ${i ? "border-l border-line pl-3 sm:pl-4" : ""}`}>
                <div className="truncate text-[12px] text-ink-3">{c.k}</div>
                <div className="mt-1 text-[18px] font-medium tabular-nums">{pct(c.a, c.b)}%</div>
              </div>
            ))}
          </div>
          {(lost > 0 || onHold > 0) && (
            <p className="mt-4 text-[12.5px] text-ink-3">
              Not in the funnel: {lost} lost and {onHold} on hold.
            </p>
          )}
        </section>

        <section className="card-lime flex min-w-0 animate-rise flex-col p-5 sm:p-6 xl:col-span-5" style={{ animationDelay: "80ms" }}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[17px] font-medium tracking-[-0.02em]">Win rate</h3>
              <p className="mt-1 text-[12.5px] text-ink/60">Closed won out of all leads</p>
            </div>
            <span className="chip chip-ink">{wonAll} won</span>
          </div>
          <div className="relative mx-auto mt-4 w-full max-w-[300px]">
            <TickGauge value={winRate} ariaLabel={`Win rate ${winRate}%`} />
            <div className="absolute inset-x-0 bottom-1 text-center">
              <div className="num text-[52px]">
                {winRate}
                <span className="ml-0.5 align-top text-[24px]">%</span>
              </div>
            </div>
          </div>
          <div className="mt-auto space-y-2 pt-5">
            {personal
              ? [
                  { k: "Won", v: wonAll },
                  { k: "In negotiation", v: deals.filter((d) => d.leadStatus === "Negotiation").length },
                  { k: "Lost", v: lost },
                ].map((r) => (
                  <div key={r.k} className="flex h-11 items-center justify-between rounded-full bg-white/85 px-4 text-[13px] text-ink">
                    <span className="text-ink-2">{r.k}</span>
                    <span className="font-medium tabular-nums">{r.v}</span>
                  </div>
                ))
              : reps.map((r) => (
                  <div key={r.name} className="flex h-11 items-center gap-3 rounded-full bg-white/85 pl-1.5 pr-4 text-[13px] text-ink">
                    <Avatar name={r.name} size={30} />
                    <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                    <span className="tabular-nums text-ink-2">{r.leads} leads</span>
                    <span className="w-10 text-right font-medium tabular-nums">{r.winRate}%</span>
                  </div>
                ))}
          </div>
        </section>
      </div>

      {/* Field activity and follow-ups */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-12">
        <section className="card min-w-0 p-5 sm:p-6 xl:col-span-7">
          <CardHeader
            icon={<MapPin />}
            title="Field activity"
            subtitle={`${range.label}, visits and calls per ${perBucket}`}
            action={
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate("mkt_visits")}>
                Visit log <ArrowUpRight aria-hidden className="size-3.5" />
              </button>
            }
          />
          <div className="mt-7">
            <ColumnChart
              ariaLabel={`Visits and calls per ${perBucket}, ${range.label}, compared with ${vs}`}
              data={range.buckets.map((b, i) => ({ label: b.label, title: b.title, value: cur.touchSeries[i], key: b.key }))}
              compare={prevTouches}
              format={(v) => `${v}`}
              seriesLabel={range.label}
              compareLabel={vs.charAt(0).toUpperCase() + vs.slice(1)}
              emptyLabel="No visits or calls in this period yet."
              height={200}
            />
          </div>
        </section>

        <section className="card min-w-0 p-5 sm:p-6 xl:col-span-5">
          <CardHeader
            icon={<CalendarClock />}
            title="Follow-ups due"
            subtitle="Open deals, soonest first"
            action={
              <button type="button" className="icon-btn" aria-label="Open overdue follow-ups" onClick={() => navigate("mkt_deals", { due: "Overdue" })}>
                <ArrowUpRight aria-hidden className="size-4" />
              </button>
            }
          />
          {followUps.length === 0 ? (
            <EmptyState
              className="py-8!"
              icon={<CalendarClock />}
              title="No open follow-ups"
              action={
                canAdd ? (
                  <button type="button" className="btn btn-ink btn-sm" onClick={() => openOverlay({ kind: "deal", dealId: null })}>
                    <Plus aria-hidden /> Add deal
                  </button>
                ) : undefined
              }
            />
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {followUps.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => openOverlay({ kind: "deal", dealId: d.id })}
                    className="-mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-[14px] px-2 py-3 text-left transition-colors hover:bg-surface-2"
                  >
                    <div className="w-11 shrink-0 text-center">
                      <div className="text-[18px] font-medium leading-none tabular-nums">{d.nextFollowUpDate ? Number(d.nextFollowUpDate.slice(8, 10)) : "–"}</div>
                      <div className="mt-1 text-[11px] text-ink-3">{d.nextFollowUpDate ? formatDateIST(d.nextFollowUpDate).split(" ")[1] : "No date"}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium">{d.companyName}</div>
                      <div className="truncate text-[12px] text-ink-3">{d.followUpAction || "No next step written"}</div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {todayKey && <span className={`chip ${CHIP[toneForDue(d.dueStatus)]}`}>{dueText(d, todayKey)}</span>}
                      {!personal && <span className="text-[12px] text-ink-3">{d.marketingPerson || "Unassigned"}</span>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Team: reps */}
      {!personal && (
        <section className="card min-w-0 p-5 sm:p-6">
          <CardHeader icon={<UsersRound />} title="Reps" subtitle={`Leads and win rate to date, visits and won value in ${range.label}`} />
          <div className="-mx-2 mt-5 hidden md:block">
            <table className="table-clean">
              <caption className="sr-only">Reps</caption>
              <thead>
                <tr>
                  <th scope="col">Rep</th>
                  <th scope="col" className="text-right">
                    Leads
                  </th>
                  <th scope="col" className="text-right">
                    Visits
                  </th>
                  <th scope="col" className="text-right">
                    Won value
                  </th>
                  <th scope="col" className="w-[22%]">
                    Win rate
                  </th>
                  <th scope="col">Overdue</th>
                  <th scope="col">Visits trend</th>
                  <th scope="col">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {reps.map((r) => (
                  <tr key={r.name}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar name={r.name} size={34} />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{r.name}</div>
                          <div className="truncate text-[12px] text-ink-3">{r.title}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right tabular-nums">{r.leads}</td>
                    <td className="text-right tabular-nums">{r.visits}</td>
                    <td className="text-right font-medium tabular-nums">{formatInr(r.wonValue)}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                          <div className="h-full origin-left animate-grow-x rounded-full bg-ink dark:bg-lime" style={{ width: `${Math.max(r.winRate, r.winRate ? 4 : 0)}%` }} />
                        </div>
                        <span className="w-9 text-right text-[13px] tabular-nums">{r.winRate}%</span>
                      </div>
                    </td>
                    <td>{r.overdue ? <span className="chip chip-coral">{r.overdue} overdue</span> : <span className="text-[13px] text-ink-3">None</span>}</td>
                    <td>
                      <Sparkline values={r.series} width={96} height={28} ariaLabel={`${r.name}, visits per ${perBucket} in ${range.label}`} />
                    </td>
                    <td className="text-right">
                      <button type="button" className="icon-btn icon-btn-sm" aria-label={`Open ${r.name}'s deals`} onClick={() => navigate("mkt_deals", { owner: r.name })}>
                        <ArrowUpRight aria-hidden className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-5 space-y-2 md:hidden">
            {reps.map((r) => (
              <li key={r.name}>
                <button type="button" onClick={() => navigate("mkt_deals", { owner: r.name })} className="w-full rounded-[18px] bg-surface-2 px-4 py-3.5 text-left">
                  <span className="flex items-center gap-3">
                    <Avatar name={r.name} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.name}</span>
                      <span className="block text-[12px] text-ink-3">
                        {r.leads} leads, {r.visits} visits{r.overdue ? `, ${r.overdue} overdue` : ""}
                      </span>
                    </span>
                    <span className="num text-[24px]">
                      {r.winRate}
                      <span className="ml-0.5 text-[12px] tracking-normal text-ink-3">%</span>
                    </span>
                  </span>
                  <span className="mt-3 block h-2.5 overflow-hidden rounded-full bg-surface">
                    <span className="block h-full rounded-full bg-ink dark:bg-lime" style={{ width: `${r.winRate}%` }} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {unassigned > 0 && (
            <div className="mt-4 flex flex-col gap-3 rounded-[18px] bg-amber-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] text-ink">
                {unassigned} open {unassigned === 1 ? "lead has" : "leads have"} no owner yet, usually new Meta leads.
              </p>
              <button type="button" className="btn btn-ink btn-sm self-start sm:self-auto" onClick={() => navigate("mkt_deals", { owner: "unassigned" })}>
                Assign them <ArrowRight aria-hidden />
              </button>
            </div>
          )}
        </section>
      )}

      {/* Personal: 26-week heatmap and recent visits */}
      {personal && (
        <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-12">
          <section className="card min-w-0 p-5 sm:p-6 xl:col-span-7">
            <CardHeader icon={<CalendarDays />} title="Your visits" subtitle="Last 26 weeks, Monday to Sunday" />
            <div className="mt-6 overflow-x-auto">
              <Heatmap ariaLabel="Your visits and calls per day over the last 26 weeks" cells={heat} unit=" visits" emptyLabel="No visits logged yet." />
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2">
              {[
                { k: "Visits", v: heatTotal },
                { k: "Active days", v: heatDays },
                { k: "Per week", v: Math.round((heatTotal / 26) * 10) / 10 },
              ].map((s) => (
                <div key={s.k} className="card-inset min-w-0 px-3 py-3 sm:px-4">
                  <div className="truncate text-[12px] text-ink-3">{s.k}</div>
                  <div className="num mt-1 text-[22px] sm:text-[26px]">{s.v}</div>
                </div>
              ))}
            </div>
          </section>
          <section className="card min-w-0 p-5 sm:p-6 xl:col-span-5">
            <CardHeader
              icon={<MapPin />}
              title="Recent visits"
              subtitle="Your last five"
              action={
                <button type="button" className="icon-btn" aria-label="Open your visit log" onClick={() => navigate("mkt_visits")}>
                  <ArrowUpRight aria-hidden className="size-4" />
                </button>
              }
            />
            {recent.length === 0 ? (
              <EmptyState
                className="py-8!"
                icon={<MapPin />}
                title="No visits logged yet"
                action={
                  canLog ? (
                    <button type="button" className="btn btn-ink btn-sm" onClick={() => openOverlay({ kind: "visit" })}>
                      <Plus aria-hidden /> Log a visit
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {recent.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => openOverlay({ kind: "visit", visitId: v.id })}
                      className="-mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-[14px] px-2 py-3 text-left transition-colors hover:bg-surface-2"
                    >
                      <div className="w-11 shrink-0 text-center">
                        <div className="text-[18px] font-medium leading-none tabular-nums">{v.date ? Number(v.date.slice(8, 10)) : "–"}</div>
                        <div className="mt-1 text-[11px] text-ink-3">{v.date ? formatDateIST(v.date).split(" ")[1] : ""}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-medium">{v.companyName || "No company"}</div>
                        <div className="truncate text-[12px] text-ink-3">{v.interactionOutcome || v.interactionType}</div>
                      </div>
                      {v.interestLevel && <StatusDot tone={INTEREST_TONE[v.interestLevel] ?? "neutral"} label={v.interestLevel} />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  foot,
  icon,
  d,
  vs,
  onOpen,
  openLabel,
  delay = 0,
}: {
  label: string;
  value: React.ReactNode;
  foot: string;
  icon: React.ReactNode;
  d: number | null;
  vs: string;
  onOpen: () => void;
  openLabel: string;
  delay?: number;
}) {
  return (
    <div className="card flex min-h-[168px] min-w-0 animate-rise flex-col justify-between p-5 sm:p-6" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-ink-3">{label}</span>
        <button type="button" onClick={onOpen} aria-label={openLabel} className="icon-btn icon-btn-sm [&>svg]:size-4">
          {icon}
        </button>
      </div>
      <div className="mt-4">
        <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
          <span className="num text-[40px] sm:text-[44px]">{value}</span>
          <span className="mb-2">
            <Delta value={d} baseline={vs} />
          </span>
        </div>
        <div className="mt-2 truncate text-[12.5px] text-ink-3">{foot}</div>
      </div>
    </div>
  );
}
