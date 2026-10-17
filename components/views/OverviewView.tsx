"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeIndianRupee,
  CheckCircle2,
  Clock3,
  FileDown,
  GitPullRequestArrow,
  Sparkles,
  Timer,
  Users,
} from "lucide-react";
import type { HubData } from "@/lib/useHubData";
import { delta, engineeringRollup, funnel, marketingRollup } from "@/lib/analytics";
import { compress, usePeriod } from "@/lib/usePeriod";
import { formatInr, formatNumber, pct } from "@/lib/format";
import { CardHeader, Delta, PeriodPicker, Segmented, Avatar, EmptyState } from "@/components/ui/primitives";
import { ColumnChart, DotMatrix, FunnelChart, Sparkline, SplitBar, TickGauge } from "@/components/charts/Charts";
import { ACCOUNT_BY_NAME } from "@/lib/people";

export function OverviewView({ data, onNavigate }: { data: HubData; onNavigate: (id: string) => void }) {
  const dates = useMemo(
    () => [...data.workLogs.map((l) => l.date), ...data.interactions.map((i) => i.date), ...data.deals.map((d) => d.dateAdded)],
    [data.workLogs, data.interactions, data.deals]
  );
  const period = usePeriod(dates, "week");
  const { range, prev } = period;
  const [metric, setMetric] = useState<"hours" | "entries">("hours");

  const eng = useMemo(() => engineeringRollup(data.workLogs, range), [data.workLogs, range]);
  const engPrev = useMemo(() => engineeringRollup(data.workLogs, prev), [data.workLogs, prev]);
  const mkt = useMemo(() => marketingRollup(data.deals, data.interactions, range), [data.deals, data.interactions, range]);
  const mktPrev = useMemo(() => marketingRollup(data.deals, data.interactions, prev), [data.deals, data.interactions, prev]);
  const steps = useMemo(() => funnel(data.deals), [data.deals]);

  const invoiced = data.payments.reduce((s, p) => s + p.invoicedAmount, 0);
  const received = data.payments.reduce((s, p) => s + p.receivedAmount, 0);
  const overdue = data.payments.reduce((s, p) => s + p.overdueAmount, 0);
  const pending = data.payments.reduce((s, p) => s + p.pendingAmount, 0);
  const collectionRate = pct(received, invoiced);
  const overdueInvoices = data.payments.filter((p) => p.status === "Overdue");
  const openBlockers = data.workLogs.filter((l) => l.isBlocked === "Yes" || l.workStatus === "Blocked");
  const pendingReviews = data.workLogs.filter((l) => l.reviewRequired === "Yes" && l.workStatus !== "Completed");

  const columns = range.buckets.map((b, i) => ({
    label: b.label,
    title: b.title,
    value: metric === "hours" ? eng.hoursSeries[i] : eng.entrySeries[i],
    detail: metric === "hours" ? `${eng.entrySeries[i]} entries` : `${formatNumber(eng.hoursSeries[i], 1)} hrs`,
  }));
  const touchDots = compress(range.buckets.map((b, i) => ({ label: b.label, title: b.title, value: mkt.touchSeries[i] })), 12);
  const activeDays = eng.hoursSeries.filter((h) => h > 0).length;

  const attention = [
    { tone: "bg-coral", text: `${openBlockers.length} work item${openBlockers.length === 1 ? "" : "s"} blocked`, go: "eng_blockers", show: openBlockers.length > 0 },
    { tone: "bg-amber", text: `${overdueInvoices.length} invoice${overdueInvoices.length === 1 ? "" : "s"} overdue · ${formatInr(overdue)}`, go: "billing", show: overdueInvoices.length > 0 },
    { tone: "bg-lime", text: `${mkt.followUpsDue} follow-up${mkt.followUpsDue === 1 ? "" : "s"} due now`, go: "mkt_deals", show: mkt.followUpsDue > 0 },
    { tone: "bg-white", text: `${pendingReviews.length} PR${pendingReviews.length === 1 ? "" : "s"} awaiting review`, go: "eng_log", show: pendingReviews.length > 0 },
  ].filter((a) => a.show);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Period bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <PeriodPicker
          granularity={period.granularity}
          onGranularity={period.setGranularity}
          range={range}
          onShift={period.shift}
          onToday={period.reset}
        />
        <div className="flex items-center gap-2 text-[12.5px] text-ink-3">
          <span className="w-2 h-2 rounded-full bg-good animate-pulse" />
          Compared with previous {range.granularity}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <div className="card-ink p-5 sm:p-6 flex flex-col justify-between min-h-[176px] animate-rise">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-white/55">Hours logged</span>
            <span className="w-9 h-9 rounded-full bg-white/10 text-lime flex items-center justify-center">
              <Timer className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="flex items-end gap-2">
              <span className="num text-[48px] sm:text-[56px]">{formatNumber(eng.hours, 1)}</span>
              <span className="text-white/50 text-[14px] mb-1.5">hrs</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[12.5px] text-white/55">
              <Delta value={delta(eng.hours, engPrev.hours)} dark /> · {eng.people.length} contributors · {activeDays} active days
            </div>
          </div>
        </div>

        <KpiCard
          label="Tasks completed"
          icon={<CheckCircle2 />}
          value={eng.completed}
          suffix={`/ ${eng.count}`}
          deltaValue={delta(eng.completed, engPrev.completed)}
          foot={`${pct(eng.completed, eng.count)}% completion rate`}
          delay={60}
        />
        <KpiCard
          label="Open pipeline"
          icon={<GitPullRequestArrow />}
          value={formatInr(mkt.pipeline)}
          deltaValue={delta(mkt.newLeads.length, mktPrev.newLeads.length)}
          foot={`Weighted ${formatInr(mkt.weighted)} · ${mkt.newLeads.length} new leads`}
          delay={120}
        />
        <KpiCard
          label="Collected"
          icon={<BadgeIndianRupee />}
          value={formatInr(received)}
          deltaValue={null}
          deltaLabel={`${collectionRate}% of invoiced`}
          foot={`${formatInr(pending)} pending · ${formatInr(overdue)} overdue`}
          delay={180}
        />
      </div>

      {/* Output chart + collections gauge */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-4">
        <section className="card p-5 sm:p-6 xl:col-span-8 animate-rise">
          <CardHeader
            icon={<Clock3 />}
            title="Team output"
            subtitle={`${range.label} · ${metric === "hours" ? "hours logged per day" : "entries logged per day"}`}
            action={
              <Segmented
                size="sm"
                value={metric}
                onChange={setMetric}
                options={[
                  { value: "hours", label: "Hours" },
                  { value: "entries", label: "Entries" },
                ]}
              />
            }
          />
          <div className="mt-7">
            {eng.count === 0 ? (
              <EmptyState icon={<Clock3 />} title="No work logged in this period" body="Use the arrows above to move to another week or month." />
            ) : (
              <ColumnChart
                data={columns}
                format={(v) => (metric === "hours" ? `${formatNumber(v, 1)}h` : formatNumber(v))}
                height={240}
              />
            )}
          </div>
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { k: "Entries", v: eng.count },
              { k: "In progress", v: eng.inProgress },
              { k: "Awaiting review", v: eng.review },
              { k: "Shipped to prod", v: eng.shipped },
            ].map((s) => (
              <div key={s.k} className="card-inset px-4 py-3">
                <div className="text-[12px] text-ink-3">{s.k}</div>
                <div className="num text-[26px] mt-1">{s.v}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="card-lime p-5 sm:p-6 xl:col-span-4 flex flex-col animate-rise" style={{ animationDelay: "80ms" }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[17px] font-medium tracking-[-0.02em]">Collections</h3>
              <p className="text-[12.5px] text-ink/60 mt-1">All invoices to date</p>
            </div>
            <button onClick={() => onNavigate("billing")} className="w-10 h-10 rounded-full bg-ink/10 hover:bg-ink/15 flex items-center justify-center" aria-label="Open invoices">
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
          <div className="relative mt-4 mx-auto w-full max-w-[300px]">
            <TickGauge value={collectionRate} />
            <div className="absolute inset-x-0 bottom-1 text-center">
              <div className="num text-[52px]">
                {collectionRate}
                <span className="text-[24px] align-top ml-0.5">%</span>
              </div>
              <div className="text-[12px] text-ink/60 -mt-0.5">collected</div>
            </div>
          </div>
          <div className="mt-auto pt-5 space-y-2">
            {[
              { k: "Invoiced", v: invoiced },
              { k: "Received", v: received },
              { k: "Overdue", v: overdue },
            ].map((r) => (
              <div key={r.k} className="flex items-center justify-between rounded-full bg-white/85 px-4 h-10 text-[13px]">
                <span className="text-ink-2">{r.k}</span>
                <span className="font-medium tabular-nums">{formatInr(r.v)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Leaderboard + attention */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-4">
        <section className="card p-5 sm:p-6 xl:col-span-8">
          <CardHeader
            icon={<Users />}
            title="Who did what"
            subtitle={`Per-person output · ${range.label}`}
            action={
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate("people")}>
                All people <ArrowRight className="w-3.5 h-3.5" />
              </button>
            }
          />
          {eng.people.length === 0 ? (
            <EmptyState icon={<Users />} title="Nobody logged work in this period" />
          ) : (
            <div className="mt-5 -mx-2 overflow-x-auto">
              <table className="table-clean min-w-[640px]">
                <thead>
                  <tr>
                    <th>Person</th>
                    <th className="text-right">Entries</th>
                    <th className="text-right">Hours</th>
                    <th className="w-[26%]">Status split</th>
                    <th>Trend</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {eng.people.map((p) => {
                    const acc = ACCOUNT_BY_NAME[p.name];
                    return (
                      <tr key={p.name}>
                        <td>
                          <div className="flex items-center gap-3">
                            <Avatar name={p.name} size={34} />
                            <div>
                              <div className="font-medium">{p.name}</div>
                              <div className="text-[12px] text-ink-3">{p.blocked ? `${p.blocked} blocked` : `${p.review} in review`}</div>
                            </div>
                          </div>
                        </td>
                        <td className="text-right tabular-nums">{p.entries}</td>
                        <td className="text-right tabular-nums font-medium">{formatNumber(p.hours, 1)}</td>
                        <td>
                          <SplitBar
                            parts={[
                              { key: "c", value: p.completed, className: "bg-ink", label: "Completed" },
                              { key: "p", value: p.inProgress, className: "bg-lime", label: "In progress" },
                              { key: "b", value: p.blocked, className: "bg-coral", label: "Blocked" },
                            ]}
                          />
                        </td>
                        <td>
                          <Sparkline values={p.series} width={96} height={28} />
                        </td>
                        <td className="text-right">
                          {acc ? (
                            <Link href={`/u/${acc}`} className="icon-btn w-8 h-8 inline-flex" aria-label={`Open ${p.name}'s dashboard`}>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex items-center gap-4 px-2 pt-4 text-[12px] text-ink-3">
                <Legend className="bg-ink" label="Completed" />
                <Legend className="bg-lime" label="In progress" />
                <Legend className="bg-coral" label="Blocked" />
              </div>
            </div>
          )}
        </section>

        <section className="card-ink p-5 sm:p-6 xl:col-span-4 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[13px]">
              <span className="w-7 h-7 rounded-full bg-lime text-ink flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              Hub signals
            </div>
            <span className="text-[12px] text-white/45">live</span>
          </div>
          <h3 className="mt-5 text-[26px] leading-[1.1] font-medium tracking-[-0.03em]">
            {attention.length ? `${attention.length} thing${attention.length === 1 ? "" : "s"} need your attention` : "Everything is on track"}
          </h3>
          <ul className="mt-5 space-y-3 flex-1">
            {attention.length === 0 && <li className="text-[13.5px] text-white/60">No blockers, overdue invoices or due follow-ups.</li>}
            {attention.map((a) => (
              <li key={a.text}>
                <button onClick={() => onNavigate(a.go)} className="w-full flex items-center gap-3 text-left text-[13.5px] text-white/80 hover:text-white group">
                  <span className={`w-2 h-2 rounded-full ${a.tone} shrink-0`} />
                  <span className="flex-1">{a.text}</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </button>
              </li>
            ))}
          </ul>
          <button onClick={() => onNavigate(attention[0]?.go ?? "eng_log")} className="btn btn-lime mt-6 self-start">
            {attention.length ? "Review now" : "Open work log"}
          </button>
        </section>
      </div>

      {/* Marketing + delivery */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-12 gap-3 sm:gap-4">
        <section className="card p-5 sm:p-6 xl:col-span-5">
          <CardHeader
            title="Sales funnel"
            subtitle={`${data.deals.length} leads · ${mkt.wonCount} won · ${formatInr(mkt.wonValue)} closed`}
            action={
              <button className="icon-btn" aria-label="Open deals" onClick={() => onNavigate("mkt_deals")}>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            }
          />
          <div className="mt-6">
            <FunnelChart steps={steps} />
          </div>
        </section>

        <section className="card p-5 sm:p-6 xl:col-span-3 flex flex-col">
          <CardHeader title="Field activity" subtitle={`${mkt.touches.length} touchpoints · ${mkt.visits} on-site`} />
          <div className="flex items-baseline gap-2 mt-5">
            <span className="num text-[44px]">{mkt.touches.length}</span>
            <Delta value={delta(mkt.touches.length, mktPrev.touches.length)} />
          </div>
          <div className="mt-auto pt-6">
            <DotMatrix data={touchDots} unit=" touchpoints" />
          </div>
        </section>

        <section className="card p-5 sm:p-6 lg:col-span-2 xl:col-span-4">
          <CardHeader
            title="Delivery"
            subtitle={`${data.projects.length} projects`}
            action={
              <button className="icon-btn" aria-label="Open clients" onClick={() => onNavigate("clients")}>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            }
          />
          <ul className="mt-5 space-y-4">
            {data.projects.map((p) => (
              <li key={p.id}>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="truncate pr-3">
                    <span className="font-medium">{p.projectName}</span>
                    <span className="text-ink-3"> · {p.projectManager}</span>
                  </span>
                  <span className="tabular-nums text-ink-2">{p.completionPercentage}%</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full origin-left animate-grow-x ${
                      p.status === "Completed" ? "bg-ink" : p.status === "On Hold" ? "bg-coral" : "bg-lime"
                    }`}
                    style={{ width: `${p.completionPercentage}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Export strip */}
      <section className="card p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-full bg-lime flex items-center justify-center">
            <FileDown className="w-5 h-5" />
          </span>
          <div>
            <div className="text-[16px] font-medium tracking-[-0.02em]">Export this period</div>
            <div className="text-[12.5px] text-ink-3">Work logs, deals, visits, invoices — as CSV for Excel or Sheets</div>
          </div>
        </div>
        <button className="btn btn-ink" onClick={() => onNavigate("exports")}>
          Open export center <ArrowRight className="w-4 h-4" />
        </button>
      </section>

    </div>
  );
}

function KpiCard({
  label,
  icon,
  value,
  suffix,
  deltaValue,
  deltaLabel,
  foot,
  delay = 0,
}: {
  label: string;
  icon: React.ReactNode;
  value: React.ReactNode;
  suffix?: string;
  deltaValue: number | null;
  deltaLabel?: string;
  foot: string;
  delay?: number;
}) {
  return (
    <div className="card p-5 sm:p-6 flex flex-col justify-between min-h-[176px] animate-rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-ink-3">{label}</span>
        <span className="w-9 h-9 rounded-full bg-surface-2 flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4">{icon}</span>
      </div>
      <div>
        <div className="flex items-end gap-2 flex-wrap">
          <span className="num text-[40px] sm:text-[48px]">{value}</span>
          {suffix && <span className="text-ink-3 text-[14px] mb-1.5">{suffix}</span>}
          {deltaLabel ? <span className="chip chip-lime mb-2">{deltaLabel}</span> : <span className="mb-2"><Delta value={deltaValue} /></span>}
        </div>
        <div className="mt-2 text-[12.5px] text-ink-3 truncate">{foot}</div>
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}
