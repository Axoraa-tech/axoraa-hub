"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeIndianRupee,
  Briefcase,
  CheckCircle2,
  Clock3,
  FileDown,
  GitPullRequestArrow,
  Plus,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { useHub } from "@/lib/hub/context";
import { useNow } from "@/lib/prefs";
import { deriveAlerts, type HubAlert } from "@/lib/alerts";
import {
  engineeringRollup,
  funnel,
  FUNNEL_STAGES,
  getRange,
  inRange,
  marketingRollup,
  type Range,
} from "@/lib/analytics";
import { compress, usePeriod } from "@/lib/usePeriod";
import { formatInr, formatNumber, pct, todayKeyIST } from "@/lib/format";
import type { MarketingDeal, PaymentBillingRecord } from "@/lib/types";
import { CardHeader, EmptyState, PeriodPicker, Segmented } from "@/components/ui/primitives";
import { DelayedSkeleton } from "@/components/ui/Skeleton";
import { ColumnChart, DotMatrix, FunnelChart, StackedBars, TickGauge } from "@/components/charts/Charts";
import { AttentionList } from "@/components/overview/AttentionList";
import { buildTeamRows, MEMBERS, TeamTable } from "@/components/overview/TeamTable";
import { UnsyncedNotice } from "@/components/overview/LocalUploadNotice";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Tone = "positive" | "negative" | "neutral";

/** The period a comparison is made against, named the way people say it: 'Oct', 'Q2 FY27', 'FY26'. */
function baselineLabel(prev: Range): string {
  if (prev.granularity === "month") return MONTHS[prev.start.getMonth()];
  if (prev.granularity === "week") return `week of ${prev.start.getDate()} ${MONTHS[prev.start.getMonth()]}`;
  return prev.label;
}

/** 'this month', 'this week', 'in Q3 FY27'. */
function periodPhrase(range: Range, isCurrent: boolean): string {
  if (isCurrent) return range.granularity === "year" ? "this financial year" : `this ${range.granularity}`;
  return `in ${range.label}`;
}

function bucketUnit(range: Range): string {
  if (range.granularity === "quarter") return "week";
  if (range.granularity === "year") return "month";
  return "day";
}

/** '+12 h vs Oct', '−₹2.1 L vs Oct', 'Same as Oct'. */
function compareText(cur: number, prev: number, fmt: (n: number) => string, baseline: string, invert = false): { text: string; tone: Tone } {
  const d = Math.round((cur - prev) * 100) / 100;
  if (d === 0) return { text: `Same as ${baseline}`, tone: "neutral" };
  const up = d > 0;
  const good = invert ? !up : up;
  return { text: `${up ? "+" : "−"}${fmt(Math.abs(d))} vs ${baseline}`, tone: good ? "positive" : "negative" };
}

const TONE_TEXT: Record<Tone, string> = { positive: "text-positive", negative: "text-negative", neutral: "text-ink-3" };
const TONE_TEXT_INK: Record<Tone, string> = { positive: "text-lime", negative: "text-coral", neutral: "text-white/55" };

/** Money received inside the range: dated receipts, or the stored received figure for invoices without receipts. */
function collectedIn(payments: PaymentBillingRecord[], range: Range): number {
  let sum = 0;
  for (const p of payments) {
    const receipts = Array.isArray(p.payments) ? p.payments : [];
    if (receipts.length) {
      for (const r of receipts) if (inRange(r.date, range)) sum += Number(r.amount) || 0;
    } else if ((Number(p.receivedAmount) || 0) > 0 && inRange(p.issueDate || p.dueDate, range)) {
      sum += Number(p.receivedAmount) || 0;
    }
  }
  return sum;
}

function weightedAdded(deals: MarketingDeal[], range: Range): number {
  return deals.filter((d) => inRange(d.dateAdded, range)).reduce((s, d) => s + (Number(d.weightedValue) || 0), 0);
}

const ENGINEERING_HEADCOUNT = MEMBERS.filter((p) => p.category !== "marketing").length;

export function OverviewView() {
  const { data, all, viewer, features, navigate, openOverlay } = useHub();
  const now = useNow();
  const todayKey = useMemo(() => (now ? todayKeyIST(now) : ""), [now]);

  const dates = useMemo(
    () => [...data.workLogs.map((l) => l.date), ...data.interactions.map((i) => i.date), ...data.deals.map((d) => d.dateAdded)],
    [data.workLogs, data.interactions, data.deals]
  );
  const period = usePeriod(dates, "month");
  const { range, prev } = period;
  const [metric, setMetric] = useState<"hours" | "entries">("hours");

  const eng = useMemo(() => engineeringRollup(data.workLogs, range), [data.workLogs, range]);
  const engPrev = useMemo(() => engineeringRollup(data.workLogs, prev), [data.workLogs, prev]);
  const mkt = useMemo(() => marketingRollup(data.deals, data.interactions, range), [data.deals, data.interactions, range]);
  const mktPrev = useMemo(() => marketingRollup(data.deals, data.interactions, prev), [data.deals, data.interactions, prev]);
  const team = useMemo(() => buildTeamRows(data, range), [data, range]);

  const steps = useMemo(() => funnel(data.deals), [data.deals]);
  const stepValues = useMemo(
    () =>
      FUNNEL_STAGES.map((f) => ({
        label: f.label,
        value: (f.stages.length ? data.deals.filter((d) => f.stages.includes(d.leadStatus)) : data.deals).reduce(
          (s, d) => s + (Number(d.estimatedDealValue) || 0),
          0
        ),
      })),
    [data.deals]
  );

  const alerts = useMemo<HubAlert[]>(
    () => (todayKey ? deriveAlerts(all, viewer, { todayKey, features }) : []),
    [all, viewer, todayKey, features]
  );

  const money = useMemo(() => {
    const invoiced = data.payments.reduce((s, p) => s + (Number(p.invoicedAmount) || 0), 0);
    const received = data.payments.reduce((s, p) => s + (Number(p.receivedAmount) || 0), 0);
    const overdueList = data.payments.filter((p) => (Number(p.overdueAmount) || 0) > 0);
    const overdue = overdueList.reduce((s, p) => s + (Number(p.overdueAmount) || 0), 0);
    return {
      invoiced,
      received,
      overdue,
      overdueCount: overdueList.length,
      rate: pct(received, invoiced),
      collected: collectedIn(data.payments, range),
      collectedPrev: collectedIn(data.payments, prev),
    };
  }, [data.payments, range, prev]);

  // Collections by month across the financial year that holds the selected period.
  const fy = useMemo(() => getRange("year", range.start), [range.start]);
  const fyBars = useMemo(
    () =>
      fy.buckets.map((b) => {
        let paid = 0;
        let due = 0;
        let overdue = 0;
        for (const p of data.payments) {
          if (!inRange(p.issueDate || p.dueDate, b)) continue;
          const od = Number(p.overdueAmount) || 0;
          paid += Number(p.receivedAmount) || 0;
          overdue += od;
          due += Math.max(0, (Number(p.pendingAmount) || 0) - od);
        }
        return {
          label: b.label,
          title: b.title,
          parts: [
            { key: "paid" as const, value: paid },
            { key: "due" as const, value: due },
            { key: "overdue" as const, value: overdue },
          ],
        };
      }),
    [fy, data.payments]
  );

  if (!data.ready) return <DelayedSkeleton label="Loading the Command Center" />;

  const baseline = baselineLabel(prev);
  const isCurrent = !!todayKey && inRange(todayKey, range);
  const unit = bucketUnit(range);
  const weeklyTarget = Number(data.settings?.weeklyHoursTarget) || 0;
  const targetPerBucket =
    weeklyTarget > 0
      ? Math.round(
          (unit === "day" ? (weeklyTarget * ENGINEERING_HEADCOUNT) / 6 : unit === "week" ? weeklyTarget * ENGINEERING_HEADCOUNT : (weeklyTarget * ENGINEERING_HEADCOUNT * 52) / 12) * 10
        ) / 10
      : undefined;

  const columns = range.buckets.map((b, i) => ({
    key: b.key,
    label: b.label,
    title: b.title,
    value: metric === "hours" ? eng.hoursSeries[i] : eng.entrySeries[i],
    detail: metric === "hours" ? `${eng.entrySeries[i]} entries` : `${formatNumber(eng.hoursSeries[i], 1)} h`,
  }));
  const compareSeries = range.buckets.map((_, i) => (metric === "hours" ? engPrev.hoursSeries[i] : engPrev.entrySeries[i]) ?? 0);
  const touchDots = compress(
    range.buckets.map((b, i) => ({ label: b.label, title: b.title, value: mkt.touchSeries[i] })),
    12
  );
  const activeBuckets = eng.hoursSeries.filter((h) => h > 0).length;

  const hoursCmp = compareText(eng.hours, engPrev.hours, (n) => `${formatNumber(n, 1)} h`, baseline);
  const tasksCmp = compareText(eng.completed, engPrev.completed, (n) => formatNumber(n), baseline);
  const addedCur = weightedAdded(data.deals, range);
  const addedPrev = weightedAdded(data.deals, prev);
  const collectedCmp = compareText(money.collected, money.collectedPrev, formatInr, baseline);
  const touchesCmp = compareText(mkt.touches.length, mktPrev.touches.length, (n) => formatNumber(n), baseline);

  const openAlert = (a: HubAlert) => {
    if (a.overlay) openOverlay(a.overlay);
    else navigate(a.view);
  };
  const logWork = () => openOverlay({ kind: "worklog", entry: null });

  return (
    <div className="space-y-4 lg:space-y-5">
      <UnsyncedNotice />

      {/* Period bar */}
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        {/* The four period pills are wider than a 375px phone; they scroll here instead of the page. */}
        <div className="-mx-1 min-w-0 max-w-full overflow-x-auto px-1 py-0.5 no-scrollbar">
          <PeriodPicker
            granularity={period.granularity}
            onGranularity={period.setGranularity}
            range={range}
            onShift={period.shift}
            onToday={period.reset}
          />
        </div>
        <p className="flex items-center gap-2 px-1 text-[12.5px] text-ink-3">
          <span aria-hidden className="h-2 w-2 rounded-full bg-good" />
          Compared with {baseline}
        </p>
      </div>

      {/* KPI bento: ink hero plus four figures */}
      <section aria-label="Summary for the period" className="grid grid-cols-2 gap-4 lg:gap-5 xl:grid-cols-5">
        <div className="card-ink col-span-2 flex min-h-[156px] animate-rise flex-col justify-between p-5 sm:min-h-[176px] sm:p-6 xl:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-white/55">Hours logged</span>
            <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lime">
              <Timer className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-4">
            <div className="flex items-end gap-2">
              <span className="num text-[48px] sm:text-[56px] xl:text-[44px] 2xl:text-[52px]">{formatNumber(eng.hours, 1)}</span>
              <span className="mb-1.5 text-[14px] text-white/50">hrs</span>
            </div>
            <div className="mt-2 text-[12.5px]">
              <span className={`font-medium tabular-nums ${TONE_TEXT_INK[hoursCmp.tone]}`}>{hoursCmp.text}</span>
              <span className="block truncate text-white/55">
                {eng.people.length} {eng.people.length === 1 ? "contributor" : "contributors"} · {activeBuckets} active {unit}
                {activeBuckets === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>

        <Kpi
          label="Tasks completed"
          icon={<CheckCircle2 aria-hidden />}
          value={formatNumber(eng.completed)}
          suffix={`/ ${eng.count}`}
          compare={tasksCmp}
          foot={`${pct(eng.completed, eng.count)}% completion rate`}
          delay={60}
          onOpen={() => navigate("eng_log")}
          openLabel="Open the work log"
        />
        <Kpi
          label="Weighted pipeline"
          icon={<GitPullRequestArrow aria-hidden />}
          value={formatInr(mkt.weighted)}
          compare={{
            text: `${formatInr(addedCur)} added, ${formatInr(addedPrev)} in ${baseline}`,
            tone: addedCur === addedPrev ? "neutral" : addedCur > addedPrev ? "positive" : "negative",
          }}
          foot={`${formatInr(mkt.pipeline)} open at full value`}
          delay={120}
          onOpen={() => navigate("mkt")}
          openLabel="Open the pipeline"
        />
        <Kpi
          label="Collected"
          icon={<BadgeIndianRupee aria-hidden />}
          value={formatInr(money.collected)}
          compare={collectedCmp}
          foot={`Received ${periodPhrase(range, isCurrent)}`}
          delay={180}
          onOpen={() => navigate("billing")}
          openLabel="Open invoices"
        />
        <Kpi
          label="Overdue"
          icon={<TriangleAlert aria-hidden />}
          value={formatInr(money.overdue)}
          valueClass={money.overdue > 0 ? "text-negative" : ""}
          compare={
            money.overdueCount
              ? { text: `${money.overdueCount} ${money.overdueCount === 1 ? "invoice" : "invoices"} past due`, tone: "negative" }
              : { text: "Nothing past due", tone: "positive" }
          }
          foot="All invoices to date"
          delay={240}
          onOpen={() => navigate("billing")}
          openLabel="Open invoices"
        />
      </section>

      {/* Team output + needs attention */}
      <div className="grid grid-cols-1 gap-4 lg:gap-5 xl:grid-cols-12">
        <section className="card min-w-0 animate-rise p-5 sm:p-6 xl:col-span-8">
          <CardHeader
            icon={<Clock3 />}
            title="Team output"
            subtitle={`${range.label} · ${metric === "hours" ? "hours" : "entries"} per ${unit}, vs ${baseline}`}
            action={
              <Segmented
                size="sm"
                label="Measure"
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
            {eng.count === 0 && engPrev.count === 0 ? (
              <EmptyState
                icon={<Clock3 />}
                title={`No work logged ${periodPhrase(range, isCurrent)}`}
                body="Entries from the daily work log show up here."
                action={
                  <button type="button" className="btn btn-ink btn-sm" onClick={logWork}>
                    <Plus aria-hidden className="h-3.5 w-3.5" /> Log work
                  </button>
                }
              />
            ) : (
              <ColumnChart
                ariaLabel={`Team ${metric} per ${unit}, ${range.label}, compared with ${baseline}`}
                data={columns}
                compare={compareSeries}
                target={metric === "hours" ? targetPerBucket : undefined}
                format={(v) => (metric === "hours" ? `${formatNumber(v, 1)}h` : formatNumber(v))}
                height={240}
                seriesLabel={range.label}
                compareLabel={baseline[0].toUpperCase() + baseline.slice(1)}
                targetLabel={`Team target per ${unit}`}
              />
            )}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { k: "Entries", v: eng.count },
              { k: "In progress", v: eng.inProgress },
              { k: "Awaiting review", v: eng.review },
              { k: "Shipped to prod", v: eng.shipped },
            ].map((s) => (
              <div key={s.k} className="card-inset px-4 py-3">
                <div className="text-[12px] text-ink-3">{s.k}</div>
                <div className="num mt-1 text-[26px]">{s.v}</div>
              </div>
            ))}
          </div>
        </section>

        <AttentionList
          className="animate-rise xl:col-span-4"
          alerts={alerts}
          todayKey={todayKey}
          onSelect={openAlert}
          onShowAll={() => navigate("today")}
        />
      </div>

      {/* Who did what */}
      <TeamTable
        rows={team}
        now={now}
        subtitle={`${range.label}, per person`}
        onShowAll={() => navigate("people")}
        onLogWork={logWork}
      />

      {/* Pipeline, field activity, delivery */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5 xl:grid-cols-12">
        <section className="card min-w-0 p-5 sm:p-6 xl:col-span-5">
          <CardHeader
            title="Pipeline by stage"
            subtitle={`${data.deals.length} ${data.deals.length === 1 ? "lead" : "leads"} · ${mkt.wonCount} won · ${formatInr(mkt.wonValue)} closed`}
            action={
              <button type="button" className="icon-btn" aria-label="Open the deal tracker" onClick={() => navigate("mkt_deals")}>
                <ArrowUpRight aria-hidden className="h-4 w-4" />
              </button>
            }
          />
          {data.deals.length === 0 ? (
            <EmptyState
              icon={<Briefcase />}
              title="No deals yet"
              body="Leads and deals from the deal tracker show up here by stage."
              action={
                <button type="button" className="btn btn-ink btn-sm" onClick={() => openOverlay({ kind: "deal", dealId: null })}>
                  <Plus aria-hidden className="h-3.5 w-3.5" /> Add deal
                </button>
              }
            />
          ) : (
            <>
              <div className="mt-6">
                <FunnelChart steps={steps} ariaLabel="Deals reaching each stage" />
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {stepValues.map((s, i) => (
                  <div key={s.label} className={`min-w-0 px-3 py-2.5 ${i === stepValues.length - 1 ? "rounded-[16px] bg-lime-soft" : "card-inset rounded-[16px]!"}`}>
                    <dt className="truncate text-[11.5px] text-ink-3">{s.label}</dt>
                    <dd className="mt-0.5 truncate text-[15px] font-medium tabular-nums text-ink">{formatInr(s.value)}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </section>

        <section className="card flex min-w-0 flex-col p-5 sm:p-6 xl:col-span-3">
          <CardHeader
            title="Field activity"
            subtitle={`${mkt.touches.length} touchpoints · ${mkt.visits} on-site`}
            action={
              <button type="button" className="icon-btn" aria-label="Open the visit log" onClick={() => navigate("mkt_visits")}>
                <ArrowUpRight aria-hidden className="h-4 w-4" />
              </button>
            }
          />
          <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="num text-[44px]">{mkt.touches.length}</span>
            <span className={`text-[12px] font-medium tabular-nums ${TONE_TEXT[touchesCmp.tone]}`}>{touchesCmp.text}</span>
          </div>
          <div className="mt-auto pt-6">
            <DotMatrix data={touchDots} unit=" touchpoints" ariaLabel={`Visits and calls per ${range.buckets.length > 12 ? "week" : unit}, ${range.label}`} />
          </div>
        </section>

        <section className="card min-w-0 p-5 sm:p-6 lg:col-span-2 xl:col-span-4">
          <CardHeader
            title="Delivery"
            subtitle={`${data.projects.length} ${data.projects.length === 1 ? "project" : "projects"}`}
            action={
              <button type="button" className="icon-btn" aria-label="Open clients and delivery" onClick={() => navigate("clients")}>
                <ArrowUpRight aria-hidden className="h-4 w-4" />
              </button>
            }
          />
          {data.projects.length === 0 ? (
            <p className="mt-6 text-[13px] text-ink-3">No projects yet. Projects added under Clients &amp; delivery show their progress here.</p>
          ) : (
            <ul className="mt-5 space-y-4">
              {data.projects.slice(0, 7).map((p) => {
                const pctDone = Math.max(0, Math.min(100, Number(p.completionPercentage) || 0));
                return (
                  <li key={p.id}>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="truncate pr-3">
                        <span className="font-medium">{p.projectName}</span>
                        {p.projectManager && <span className="text-ink-3"> · {p.projectManager}</span>}
                      </span>
                      <span className="tabular-nums text-ink-2">{pctDone}%</span>
                    </div>
                    <div
                      className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"
                      role="progressbar"
                      aria-label={`${p.projectName}, ${p.status}`}
                      aria-valuenow={pctDone}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className={`h-full origin-left animate-grow-x rounded-full ${p.status === "Completed" ? "bg-ink" : p.status === "On Hold" ? "bg-coral" : "bg-lime"}`}
                        style={{ width: `${pctDone}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Collections by month + collections gauge */}
      <div className="grid grid-cols-1 gap-4 lg:gap-5 xl:grid-cols-12">
        <section className="card min-w-0 p-5 sm:p-6 xl:col-span-8">
          <CardHeader
            icon={<BadgeIndianRupee />}
            title="Collections by month"
            subtitle={`${fy.label}, paid, due and overdue by invoice month`}
            action={
              <button type="button" className="icon-btn" aria-label="Open invoices" onClick={() => navigate("billing")}>
                <ArrowUpRight aria-hidden className="h-4 w-4" />
              </button>
            }
          />
          <div className="mt-6">
            <StackedBars
              data={fyBars}
              ariaLabel={`Collections by month, ${fy.label}`}
              format={(v) => formatInr(v)}
              height={220}
              emptyLabel={`No invoices dated in ${fy.label} yet.`}
            />
          </div>
        </section>

        <section className="card-lime flex min-w-0 animate-rise flex-col p-5 sm:p-6 xl:col-span-4" style={{ animationDelay: "80ms" }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[17px] font-medium tracking-[-0.02em]">Collections</h3>
              <p className="mt-1 text-[12.5px] text-on-lime/60">All invoices to date</p>
            </div>
            <button
              type="button"
              onClick={() => navigate("billing")}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-on-lime/10 transition-colors hover:bg-on-lime/15"
              aria-label="Open invoices"
            >
              <ArrowUpRight aria-hidden className="h-4 w-4" />
            </button>
          </div>
          <div className="relative mx-auto mt-4 w-full max-w-[300px]">
            <TickGauge value={money.rate} ariaLabel={`${money.rate}% of invoiced value collected`} />
            <div className="absolute inset-x-0 bottom-1 text-center">
              <div className="num text-[52px]">
                {money.rate}
                <span className="ml-0.5 align-top text-[24px]">%</span>
              </div>
              <div className="-mt-0.5 text-[12px] text-on-lime/60">collected</div>
            </div>
          </div>
          <div className="mt-auto space-y-2 pt-5">
            {[
              { k: "Invoiced", v: money.invoiced },
              { k: "Received", v: money.received },
              { k: "Overdue", v: money.overdue },
            ].map((r) => (
              <div key={r.k} className="flex h-10 items-center justify-between rounded-full bg-white/85 px-4 text-[13px] text-on-lime">
                <span className="text-on-lime/70">{r.k}</span>
                <span className="font-medium tabular-nums">{formatInr(r.v)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Export strip */}
      <section className="card flex flex-col justify-between gap-4 p-5 sm:p-6 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lime text-on-lime">
            <FileDown className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="text-[16px] font-medium tracking-[-0.02em]">Export this period</div>
            <div className="text-[12.5px] text-ink-3">Work logs, deals, visits and invoices as CSV for Excel or Sheets</div>
          </div>
        </div>
        <button type="button" className="btn btn-ink self-start md:self-auto" onClick={() => navigate("exports")}>
          Open export center <ArrowRight aria-hidden className="h-4 w-4" />
        </button>
      </section>
    </div>
  );
}

function Kpi({
  label,
  icon,
  value,
  valueClass = "",
  suffix,
  compare,
  foot,
  delay = 0,
  onOpen,
  openLabel,
}: {
  label: string;
  icon: React.ReactNode;
  value: React.ReactNode;
  valueClass?: string;
  suffix?: string;
  compare: { text: string; tone: Tone };
  foot: string;
  delay?: number;
  onOpen: () => void;
  openLabel: string;
}) {
  return (
    <div
      className="card flex min-h-[156px] min-w-0 animate-rise flex-col justify-between p-5 sm:min-h-[176px] sm:p-6"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] text-ink-3">{label}</span>
        <button type="button" onClick={onOpen} aria-label={openLabel} title={openLabel} className="icon-btn icon-btn-sm shrink-0 [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </button>
      </div>
      <div className="mt-4 min-w-0">
        <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
          <span className={`num truncate text-[30px] sm:text-[40px] xl:text-[32px] 2xl:text-[40px] ${valueClass}`}>{value}</span>
          {suffix && <span className="mb-1 text-[14px] text-ink-3">{suffix}</span>}
        </div>
        <div className={`mt-2 truncate text-[12px] font-medium tabular-nums ${TONE_TEXT[compare.tone]}`} title={compare.text}>
          {compare.text}
        </div>
        <div className="mt-0.5 truncate text-[12px] text-ink-3" title={foot}>
          {foot}
        </div>
      </div>
    </div>
  );
}
