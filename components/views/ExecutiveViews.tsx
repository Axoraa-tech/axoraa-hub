"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Download, FileSpreadsheet, Printer, ReceiptIndianRupee } from "lucide-react";
import type { HubData } from "@/lib/useHubData";
import { formatDay, formatInr, formatNumber, pct } from "@/lib/format";
import { engineeringRollup, inRange, marketingRollup } from "@/lib/analytics";
import { usePeriod } from "@/lib/usePeriod";
import { PEOPLE } from "@/lib/people";
import {
  CLIENT_COLUMNS,
  DEAL_COLUMNS,
  downloadCsv,
  INTERACTION_COLUMNS,
  PAYMENT_COLUMNS,
  PROJECT_COLUMNS,
  WORK_LOG_COLUMNS,
} from "@/lib/export";
import { Avatar, CardHeader, PeriodPicker, Segmented, StatusPill } from "@/components/ui/primitives";
import { SegmentMeter, Sparkline, SplitBar } from "@/components/charts/Charts";

/* ============================================================ Clients & delivery */

export function ClientsView({ data }: { data: HubData }) {
  const totalValue = data.clients.reduce((s, c) => s + c.dealValue, 0);
  const won = data.clients.filter((c) => c.dealStatus === "Won");
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {data.founderMatrix.map((f, i) => (
          <section key={f.founder} className={`${i === 0 ? "card-ink" : "card"} p-5 sm:p-6 animate-rise`} style={{ animationDelay: `${i * 50}ms` }}>
            <div className="flex items-center gap-3">
              <Avatar name={f.founder} size={40} />
              <div>
                <div className="text-[15px] font-medium">{f.founder}</div>
                <div className={`text-[12px] ${i === 0 ? "text-white/50" : "text-ink-3"}`}>{f.role}</div>
              </div>
            </div>
            <div className="num text-[40px] mt-6">{formatInr(f.totalDealValue)}</div>
            <div className={`text-[12.5px] mt-1 ${i === 0 ? "text-white/50" : "text-ink-3"}`}>
              {f.clientsBrought} clients originated
            </div>
            <div className={`mt-5 pt-4 grid grid-cols-3 gap-2 border-t ${i === 0 ? "border-white/10" : "border-line"}`}>
              {[
                { k: "Active", v: f.projectsLed.active },
                { k: "Done", v: f.projectsLed.completed },
                { k: "Pending", v: formatInr(f.pendingCollection) },
              ].map((s) => (
                <div key={s.k}>
                  <div className={`text-[11.5px] ${i === 0 ? "text-white/45" : "text-ink-3"}`}>{s.k}</div>
                  <div className="text-[14px] font-medium mt-0.5 tabular-nums">{s.v}</div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="card p-4 sm:p-6">
        <CardHeader
          title="Client portfolio"
          subtitle={`${data.clients.length} accounts · ${won.length} won · ${formatInr(totalValue)} total deal value`}
          action={
            <button className="btn btn-ghost btn-sm" onClick={() => downloadCsv("axoraa-clients", data.clients, CLIENT_COLUMNS)}>
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          }
        />
        <div className="mt-5 -mx-4 sm:-mx-6 overflow-x-auto">
          <table className="table-clean min-w-[900px]">
            <thead>
              <tr>
                <th className="pl-4 sm:pl-6">Client</th>
                <th>Owner</th>
                <th className="text-right">Deal value</th>
                <th>Deal</th>
                <th className="w-[22%]">Delivery</th>
                <th className="pr-4 sm:pr-6">Scope</th>
              </tr>
            </thead>
            <tbody>
              {data.clients.map((c) => {
                const p = data.projects.find((x) => x.clientId === c.clientId);
                return (
                  <tr key={c.id}>
                    <td className="pl-4 sm:pl-6">
                      <div className="font-medium">{c.companyName}</div>
                      <div className="text-[12px] text-ink-3">
                        <span className="font-mono">{c.clientId}</span> · {c.industry}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Avatar name={c.salesOwner} size={26} />
                        {c.salesOwner}
                      </div>
                    </td>
                    <td className="text-right tabular-nums font-medium">{formatInr(c.dealValue)}</td>
                    <td>
                      <StatusPill status={c.dealStatus} />
                    </td>
                    <td>
                      {p ? (
                        <div>
                          <div className="flex justify-between text-[12px] mb-1.5">
                            <span className="text-ink-2">{p.status}</span>
                            <span className="tabular-nums">{p.completionPercentage}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-surface-2">
                            <div
                              className={`h-full rounded-full ${p.status === "Completed" ? "bg-ink" : p.status === "On Hold" ? "bg-coral" : "bg-lime"}`}
                              style={{ width: `${p.completionPercentage}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-[12px] text-ink-3">Pre-delivery</span>
                      )}
                    </td>
                    <td className="pr-4 sm:pr-6 text-ink-2 max-w-[260px] truncate">{c.contractScope}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-4 sm:p-6">
        <CardHeader
          title="Delivery & blockers"
          subtitle={`${data.projects.length} projects`}
          action={
            <button className="btn btn-ghost btn-sm" onClick={() => downloadCsv("axoraa-projects", data.projects, PROJECT_COLUMNS)}>
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          }
        />
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {data.projects.map((p) => (
            <div key={p.id} className="card-inset p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-[11px] text-ink-3">{p.projectId}</div>
                  <div className="text-[15px] font-medium truncate mt-0.5">{p.projectName}</div>
                </div>
                <StatusPill status={p.status} />
              </div>
              <div className="flex items-end gap-2 mt-4">
                <span className="num text-[34px]">{p.completionPercentage}%</span>
                <span className="text-[12px] text-ink-3 mb-1">· due {formatDay(p.targetReleaseDate)}</span>
              </div>
              <div className="mt-3">
                <SegmentMeter value={p.completionPercentage} total={100} slots={10} height={22} />
              </div>
              <div className="mt-4 text-[12.5px] text-ink-2 line-clamp-2">
                {p.blockerDetails && !p.blockerDetails.startsWith("None") ? (
                  <span className="text-coral">
                    {p.blockerDetails} <span className="text-ink-3">· {p.blockerOwner}</span>
                  </span>
                ) : (
                  <span className="text-ink-3">No blockers · PM {p.projectManager}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ============================================================ Billing */

export function BillingView({ data }: { data: HubData }) {
  const invoiced = data.payments.reduce((s, p) => s + p.invoicedAmount, 0);
  const received = data.payments.reduce((s, p) => s + p.receivedAmount, 0);
  const pending = data.payments.reduce((s, p) => s + p.pendingAmount, 0);
  const overdue = data.payments.reduce((s, p) => s + p.overdueAmount, 0);
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {[
          { k: "Invoiced", v: invoiced, cls: "card-ink", sub: `${data.payments.length} invoices` },
          { k: "Received", v: received, cls: "card", sub: `${pct(received, invoiced)}% collected` },
          { k: "Pending", v: pending, cls: "card", sub: "awaiting settlement" },
          { k: "Overdue", v: overdue, cls: overdue ? "card bg-coral! text-white" : "card", sub: `${data.payments.filter((p) => p.status === "Overdue").length} invoice(s)` },
        ].map((s, i) => (
          <div key={s.k} className={`${s.cls} p-5 sm:p-6 min-h-[150px] flex flex-col justify-between animate-rise`} style={{ animationDelay: `${i * 50}ms` }}>
            <span className={`text-[13px] ${s.cls === "card" ? "text-ink-3" : "text-white/60"}`}>{s.k}</span>
            <div>
              <div className="num text-[40px] sm:text-[46px]">{formatInr(s.v)}</div>
              <div className={`text-[12.5px] mt-2 ${s.cls === "card" ? "text-ink-3" : "text-white/60"}`}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <section className="card p-4 sm:p-6">
        <CardHeader
          icon={<ReceiptIndianRupee />}
          title="Invoices & collections"
          subtitle="Milestone billing ledger"
          action={
            <button className="btn btn-ghost btn-sm" onClick={() => downloadCsv("axoraa-invoices", data.payments, PAYMENT_COLUMNS)}>
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          }
        />
        <div className="mt-5 -mx-4 sm:-mx-6 overflow-x-auto">
          <table className="table-clean min-w-[920px]">
            <thead>
              <tr>
                <th className="pl-4 sm:pl-6">Invoice</th>
                <th>Client</th>
                <th className="text-right">Invoiced</th>
                <th className="text-right">Received</th>
                <th className="w-[18%]">Collected</th>
                <th>Due</th>
                <th>Status</th>
                <th className="pr-4 sm:pr-6">Milestone</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.id}>
                  <td className="pl-4 sm:pl-6 font-mono text-[12px]">{p.invoiceId}</td>
                  <td>
                    <div className="font-medium">{p.companyName}</div>
                    <div className="text-[12px] text-ink-3 font-mono">{p.clientId}</div>
                  </td>
                  <td className="text-right tabular-nums">{formatInr(p.invoicedAmount)}</td>
                  <td className="text-right tabular-nums font-medium">{formatInr(p.receivedAmount)}</td>
                  <td>
                    <SplitBar
                      height={8}
                      parts={[
                        { key: "r", value: p.receivedAmount, className: "bg-ink", label: "Received" },
                        { key: "p", value: p.pendingAmount, className: "hatch", label: "Pending" },
                        { key: "o", value: p.overdueAmount, className: "bg-coral", label: "Overdue" },
                      ]}
                    />
                  </td>
                  <td className="tabular-nums whitespace-nowrap text-ink-2">{formatDay(p.dueDate, { day: "numeric", month: "short", year: "2-digit" })}</td>
                  <td>
                    <StatusPill status={p.status} />
                  </td>
                  <td className="pr-4 sm:pr-6 text-ink-2 max-w-[240px] truncate">{p.milestoneDescription}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-4 pt-4 text-[12px] text-ink-3">
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-ink" />Received</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full hatch" />Pending</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-coral" />Overdue</span>
        </div>
      </section>
    </div>
  );
}

/* ============================================================ People */

export function PeopleView({ data }: { data: HubData }) {
  const dates = useMemo(() => [...data.workLogs.map((l) => l.date), ...data.interactions.map((i) => i.date)], [data.workLogs, data.interactions]);
  const period = usePeriod(dates, "month");
  const eng = useMemo(() => engineeringRollup(data.workLogs, period.range), [data.workLogs, period.range]);
  const mkt = useMemo(() => marketingRollup(data.deals, data.interactions, period.range), [data.deals, data.interactions, period.range]);
  const members = PEOPLE.filter((p) => p.role === "member");
  const [filter, setFilter] = useState<"all" | "founder" | "developer" | "marketing">("all");

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <PeriodPicker granularity={period.granularity} onGranularity={period.setGranularity} range={period.range} onShift={period.shift} onToday={period.reset} />
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Everyone" },
            { value: "founder", label: "Founders" },
            { value: "developer", label: "Engineering" },
            { value: "marketing", label: "Marketing" },
          ]}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {members
          .filter((m) => filter === "all" || m.category === filter)
          .map((m, i) => {
            const e = eng.people.find((p) => p.name === m.name);
            const r = mkt.reps.find((p) => p.name === m.name);
            return (
              <section key={m.id} className="card p-5 sm:p-6 flex flex-col animate-rise" style={{ animationDelay: `${i * 35}ms` }}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.name} size={46} />
                    <div>
                      <div className="text-[16px] font-medium">{m.name}</div>
                      <div className="text-[12.5px] text-ink-3">{m.title}</div>
                    </div>
                  </div>
                  <Link href={`/u/${m.id}`} className="icon-btn" aria-label={`Open ${m.name}'s dashboard`}>
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
                {m.category === "marketing" ? (
                  <div className="mt-6 grid grid-cols-3 gap-2">
                    <Mini k="Leads" v={r?.leads ?? 0} />
                    <Mini k="Touchpoints" v={r?.touches ?? 0} />
                    <Mini k="Win rate" v={`${r?.winRate ?? 0}%`} />
                  </div>
                ) : (
                  <>
                    <div className="mt-6 flex items-end justify-between">
                      <div>
                        <div className="num text-[40px]">{formatNumber(e?.hours ?? 0, 1)}<span className="text-[15px] text-ink-3 ml-1">h</span></div>
                        <div className="text-[12px] text-ink-3 mt-1">{e?.entries ?? 0} {(e?.entries ?? 0) === 1 ? "entry" : "entries"} · {e?.completed ?? 0} done</div>
                      </div>
                      <Sparkline values={e?.series ?? [0, 0]} width={110} height={40} />
                    </div>
                    <div className="mt-4">
                      <SplitBar
                        parts={[
                          { key: "c", value: e?.completed ?? 0, className: "bg-ink", label: "Completed" },
                          { key: "p", value: e?.inProgress ?? 0, className: "bg-lime", label: "In progress" },
                          { key: "b", value: e?.blocked ?? 0, className: "bg-coral", label: "Blocked" },
                        ]}
                      />
                    </div>
                  </>
                )}
              </section>
            );
          })}
      </div>
    </div>
  );
}

function Mini({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="card-inset px-3 py-3">
      <div className="text-[11.5px] text-ink-3">{k}</div>
      <div className="text-[20px] font-medium tabular-nums mt-0.5">{v}</div>
    </div>
  );
}

/* ============================================================ Export center */

export function ExportsView({ data }: { data: HubData }) {
  const dates = useMemo(
    () => [...data.workLogs.map((l) => l.date), ...data.interactions.map((i) => i.date), ...data.deals.map((d) => d.dateAdded)],
    [data.workLogs, data.interactions, data.deals]
  );
  const period = usePeriod(dates, "month");
  const [scope, setScope] = useState<"period" | "all">("period");
  const r = period.range;
  const tag = scope === "all" ? "all-time" : r.label.replace(/[^\w]+/g, "-");
  const within = <T,>(rows: T[], date: (row: T) => string) => (scope === "all" ? rows : rows.filter((x) => inRange(date(x), r)));

  const logs = within(data.workLogs, (l) => l.date);
  const deals = within(data.deals, (d) => d.dateAdded);
  const touches = within(data.interactions, (i) => i.date);

  const eng = engineeringRollup(data.workLogs, r);
  const summaryRows = eng.people.map((p) => ({
    name: p.name,
    entries: p.entries,
    hours: p.hours,
    completed: p.completed,
    inProgress: p.inProgress,
    blocked: p.blocked,
  }));

  const sets = [
    { title: "Daily work log", sub: "Every engineering entry", count: logs.length, run: () => downloadCsv(`axoraa-work-log-${tag}`, logs, WORK_LOG_COLUMNS), dated: true },
    {
      title: "Team summary",
      sub: "Hours, entries & status per person",
      count: summaryRows.length,
      run: () =>
        downloadCsv(`axoraa-team-summary-${r.label.replace(/[^\w]+/g, "-")}`, summaryRows, [
          { header: "Person", value: (x) => x.name },
          { header: "Entries", value: (x) => x.entries },
          { header: "Hours", value: (x) => x.hours },
          { header: "Completed", value: (x) => x.completed },
          { header: "In progress", value: (x) => x.inProgress },
          { header: "Blocked", value: (x) => x.blocked },
        ]),
      dated: true,
    },
    { title: "Leads & deals", sub: "Pipeline tracker (by date added)", count: deals.length, run: () => downloadCsv(`axoraa-deals-${tag}`, deals, DEAL_COLUMNS), dated: true },
    { title: "Visits & touchpoints", sub: "Field interactions", count: touches.length, run: () => downloadCsv(`axoraa-visits-${tag}`, touches, INTERACTION_COLUMNS), dated: true },
    { title: "Clients", sub: "Portfolio snapshot", count: data.clients.length, run: () => downloadCsv("axoraa-clients", data.clients, CLIENT_COLUMNS), dated: false },
    { title: "Projects", sub: "Delivery snapshot", count: data.projects.length, run: () => downloadCsv("axoraa-projects", data.projects, PROJECT_COLUMNS), dated: false },
    { title: "Invoices", sub: "Billing & collections", count: data.payments.length, run: () => downloadCsv("axoraa-invoices", data.payments, PAYMENT_COLUMNS), dated: false },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { value: "period", label: "Selected period" },
              { value: "all", label: "All time" },
            ]}
          />
          {scope === "period" && (
            <PeriodPicker granularity={period.granularity} onGranularity={period.setGranularity} range={r} onShift={period.shift} onToday={period.reset} />
          )}
        </div>
        <button className="btn btn-ghost" onClick={() => window.print()}>
          <Printer className="w-4 h-4" /> Print / save as PDF
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {sets.map((s, i) => (
          <section key={s.title} className={`${i === 0 ? "card-lime" : "card"} p-5 sm:p-6 flex flex-col min-h-[190px] animate-rise`} style={{ animationDelay: `${i * 40}ms` }}>
            <div className="flex items-start justify-between">
              <span className={`w-11 h-11 rounded-full flex items-center justify-center ${i === 0 ? "bg-ink text-lime" : "bg-surface-2"}`}>
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <span className={`chip ${i === 0 ? "bg-white/70" : ""}`}>{s.dated ? (scope === "all" ? "All time" : r.label) : "Snapshot"}</span>
            </div>
            <div className="mt-5">
              <div className="text-[17px] font-medium tracking-[-0.02em]">{s.title}</div>
              <div className={`text-[12.5px] mt-1 ${i === 0 ? "text-ink/60" : "text-ink-3"}`}>{s.sub}</div>
            </div>
            <div className="mt-auto pt-5 flex items-center justify-between">
              <span className="text-[13px] tabular-nums">
                <span className="num text-[28px] mr-1">{s.count}</span> rows
              </span>
              <button className={`btn btn-sm ${i === 0 ? "btn-ink" : "btn-ghost"}`} onClick={s.run} disabled={!s.count}>
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
