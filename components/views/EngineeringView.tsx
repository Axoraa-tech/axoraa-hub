"use client";

import React, { useMemo } from "react";
import { AlertOctagon, ArrowUpRight, Boxes, CheckCircle2, Clock3, GitBranch, Layers, Timer } from "lucide-react";
import type { DailyWorkLogEntry } from "@/lib/types";
import { delta, engineeringRollup } from "@/lib/analytics";
import { usePeriod } from "@/lib/usePeriod";
import { formatDay, formatNumber, pct } from "@/lib/format";
import { CardHeader, Delta, EmptyState, PeriodPicker, StatusPill, Avatar } from "@/components/ui/primitives";
import { ColumnChart, RankedBars, SegmentMeter, SplitBar } from "@/components/charts/Charts";

export function EngineeringView({
  logs,
  personal,
  onOpenLog,
  onOpenLogTable,
  onResolve,
}: {
  logs: DailyWorkLogEntry[];
  personal?: string; // when set, this is that person's own dashboard
  onOpenLog: (log: DailyWorkLogEntry) => void;
  onOpenLogTable: () => void;
  onResolve?: (log: DailyWorkLogEntry) => void;
}) {
  const dates = useMemo(() => logs.map((l) => l.date), [logs]);
  const period = usePeriod(dates, "week");
  const { range, prev } = period;
  const cur = useMemo(() => engineeringRollup(logs, range), [logs, range]);
  const before = useMemo(() => engineeringRollup(logs, prev), [logs, prev]);

  const blockers = logs.filter((l) => l.isBlocked === "Yes" || l.workStatus === "Blocked");
  const recent = [...cur.entries].sort((a, b) => (b.date + b.lastUpdated).localeCompare(a.date + a.lastUpdated)).slice(0, 6);
  const target = range.granularity === "week" ? 40 : range.granularity === "month" ? 160 : 1800;
  const hoursTarget = personal ? target : target * Math.max(1, cur.people.length);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <PeriodPicker granularity={period.granularity} onGranularity={period.setGranularity} range={range} onShift={period.shift} onToday={period.reset} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3 sm:gap-4">
        {/* Hours vs capacity */}
        <section className="card-ink p-5 sm:p-6 xl:col-span-4 flex flex-col justify-between min-h-[250px] animate-rise">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-full bg-white/10 text-lime flex items-center justify-center">
                <Timer className="w-[18px] h-[18px]" />
              </span>
              <span className="text-[15px]">Hours logged</span>
            </div>
            <Delta value={delta(cur.hours, before.hours)} dark />
          </div>
          <div className="mt-6">
            <div className="flex items-end gap-2">
              <span className="num text-[64px]">{formatNumber(cur.hours, 1)}</span>
              <span className="text-white/45 text-[14px] mb-2">/ {formatNumber(hoursTarget)} h</span>
              <span className="chip chip-lime mb-3 ml-1">{pct(cur.hours, hoursTarget)}%</span>
            </div>
            <div className="mt-5">
              <SegmentMeter value={cur.hours} total={hoursTarget} slots={9} dark />
            </div>
          </div>
        </section>

        {/* Completion */}
        <section className="card p-5 sm:p-6 xl:col-span-4 flex flex-col justify-between min-h-[250px] animate-rise" style={{ animationDelay: "60ms" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center">
                <CheckCircle2 className="w-[18px] h-[18px]" />
              </span>
              <span className="text-[15px]">Completed</span>
            </div>
            <Delta value={delta(cur.completed, before.completed)} />
          </div>
          <div className="mt-6">
            <div className="flex items-end gap-2">
              <span className="num text-[64px]">{cur.completed}</span>
              <span className="text-ink-3 text-[14px] mb-2">/ {cur.count} {cur.count === 1 ? "entry" : "entries"}</span>
            </div>
            <div className="mt-5">
              <SplitBar
                height={14}
                parts={[
                  { key: "c", value: cur.completed, className: "bg-ink", label: "Completed" },
                  { key: "p", value: cur.inProgress, className: "bg-lime", label: "In progress" },
                  { key: "b", value: cur.blocked, className: "bg-coral", label: "Blocked" },
                ]}
              />
              <div className="flex items-center gap-4 mt-3 text-[12px] text-ink-3">
                <Dot className="bg-ink" label={`${cur.completed} done`} />
                <Dot className="bg-lime" label={`${cur.inProgress} in progress`} />
                <Dot className="bg-coral" label={`${cur.blocked} blocked`} />
              </div>
            </div>
          </div>
        </section>

        {/* Quick facts */}
        <section className="grid grid-cols-2 gap-3 sm:gap-4 md:col-span-2 xl:col-span-4">
          {[
            { k: "Awaiting review", v: cur.review, icon: <GitBranch /> },
            { k: "Shipped to prod", v: cur.shipped, icon: <Boxes /> },
            { k: "Open blockers", v: blockers.length, icon: <AlertOctagon />, alert: blockers.length > 0 },
            { k: personal ? "Active days" : "Contributors", v: personal ? cur.hoursSeries.filter((h) => h > 0).length : cur.people.length, icon: <Layers /> },
          ].map((s, i) => (
            <div
              key={s.k}
              className={`${s.alert ? "bg-coral text-white rounded-[var(--radius-card)]" : "card"} p-4 sm:p-5 flex flex-col justify-between min-h-[117px] animate-rise`}
              style={{ animationDelay: `${120 + i * 40}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[12.5px] ${s.alert ? "text-white/80" : "text-ink-3"}`}>{s.k}</span>
                <span className={`[&>svg]:w-4 [&>svg]:h-4 ${s.alert ? "text-white" : "text-ink-2"}`}>{s.icon}</span>
              </div>
              <span className="num text-[36px]">{s.v}</span>
            </div>
          ))}
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-4">
        <section className="card p-5 sm:p-6 xl:col-span-8">
          <CardHeader icon={<Clock3 />} title="Daily effort" subtitle={`${range.label} · hours per ${range.granularity === "year" ? "month" : "day"}`} />
          <div className="mt-7">
            {cur.count === 0 ? (
              <EmptyState icon={<Clock3 />} title="Nothing logged in this period" body="Switch period with the arrows, or log today's work." />
            ) : (
              <ColumnChart
                data={range.buckets.map((b, i) => ({ label: b.label, title: b.title, value: cur.hoursSeries[i], detail: `${cur.entrySeries[i]} entries` }))}
                format={(v) => `${formatNumber(v, 1)}h`}
              />
            )}
          </div>
        </section>

        <section className="card p-5 sm:p-6 xl:col-span-4">
          <CardHeader title="Where time went" subtitle="Hours by work type" />
          <div className="mt-6">
            {cur.byType.length ? (
              <RankedBars items={cur.byType.slice(0, 6).map(([label, value]) => ({ label, value }))} format={(v) => `${formatNumber(v, 1)}h`} />
            ) : (
              <p className="text-[13px] text-ink-3">No data for this period.</p>
            )}
          </div>
          {cur.byRepo.length > 0 && (
            <div className="mt-6 pt-5 border-t border-line flex flex-wrap gap-2">
              {cur.byRepo.map(([repo, n]) => (
                <span key={repo} className="chip font-mono text-[11px]">
                  {repo} <span className="text-ink-3">{n}</span>
                </span>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-4">
        <section className="card p-5 sm:p-6 xl:col-span-7">
          <CardHeader
            title={personal ? "My recent entries" : "Latest entries"}
            subtitle={range.label}
            action={
              <button className="btn btn-ghost btn-sm" onClick={onOpenLogTable}>
                Full log <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            }
          />
          <ul className="mt-4 divide-y divide-line">
            {recent.length === 0 && <li className="py-6 text-[13px] text-ink-3">No entries in this period.</li>}
            {recent.map((l) => (
              <li key={l.id}>
                <button onClick={() => onOpenLog(l)} className="w-full text-left py-3.5 flex items-start gap-3 group">
                  {!personal && <Avatar name={l.developerName} size={34} />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-[14px] truncate">{l.module}</span>
                      {l.githubPr && <span className="font-mono text-[11px] text-ink-3 shrink-0">{l.githubPr}</span>}
                    </div>
                    <p className="text-[12.5px] text-ink-3 truncate mt-0.5">{l.taskDescription}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusPill status={l.isBlocked === "Yes" ? "Blocked" : l.workStatus} />
                    <span className="text-[11.5px] text-ink-3 tabular-nums">
                      {formatDay(l.date)} · {l.hours}h
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5 sm:p-6 xl:col-span-5">
          <CardHeader
            title="Blockers"
            subtitle={blockers.length ? `${blockers.length} need unblocking` : "Nothing blocked"}
            icon={<AlertOctagon />}
          />
          <ul className="mt-4 space-y-2.5">
            {blockers.length === 0 && (
              <EmptyState icon={<CheckCircle2 />} title="All clear" body='Set "Blocked? = Yes" on an entry to escalate it here.' />
            )}
            {blockers.map((b) => (
              <li key={b.id} className="card-inset p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium truncate">{b.module}</div>
                    <div className="text-[12.5px] text-coral mt-1 line-clamp-2">{b.blockerDetails || "Unspecified dependency"}</div>
                    <div className="text-[11.5px] text-ink-3 mt-1.5">
                      {b.developerName} · {formatDay(b.date)} · {b.priority}
                    </div>
                  </div>
                  {onResolve && (
                    <button onClick={() => onResolve(b)} className="btn btn-ink btn-sm shrink-0">
                      Resolve
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Dot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${className}`} />
      {label}
    </span>
  );
}
