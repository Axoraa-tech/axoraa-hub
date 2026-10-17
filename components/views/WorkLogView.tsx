"use client";

import React, { useMemo, useState } from "react";
import { Download, Pencil, Search, Trash2 } from "lucide-react";
import type { DailyWorkLogEntry } from "@/lib/types";
import { inRange } from "@/lib/analytics";
import { usePeriod } from "@/lib/usePeriod";
import { downloadCsv, WORK_LOG_COLUMNS } from "@/lib/export";
import { formatDay, formatNumber } from "@/lib/format";
import { Avatar, EmptyState, PeriodPicker, Segmented, StatusPill } from "@/components/ui/primitives";

export function WorkLogView({
  logs,
  personal,
  blockedOnly = false,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  logs: DailyWorkLogEntry[];
  personal?: string;
  blockedOnly?: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (l: DailyWorkLogEntry) => void;
  onDelete: (l: DailyWorkLogEntry) => void;
}) {
  const dates = useMemo(() => logs.map((l) => l.date), [logs]);
  const period = usePeriod(dates, "month");
  const [scope, setScope] = useState<"period" | "all">("period");
  const [q, setQ] = useState("");
  const [person, setPerson] = useState("All");
  const [status, setStatus] = useState<"All" | "In Progress" | "Completed" | "Blocked">(blockedOnly ? "Blocked" : "All");

  const people = useMemo(() => ["All", ...new Set(logs.map((l) => l.developerName))], [logs]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return logs
      .filter((l) => scope === "all" || inRange(l.date, period.range))
      .filter((l) => person === "All" || l.developerName === person)
      .filter((l) =>
        status === "All" ? true : status === "Blocked" ? l.isBlocked === "Yes" || l.workStatus === "Blocked" : l.workStatus === status
      )
      .filter(
        (l) =>
          !needle ||
          [l.module, l.taskDescription, l.developerName, l.repository, l.githubPr, l.notes, l.workType].some((v) =>
            String(v || "").toLowerCase().includes(needle)
          )
      )
      .sort((a, b) => (b.date + b.lastUpdated).localeCompare(a.date + a.lastUpdated));
  }, [logs, scope, period.range, person, status, q]);

  const hours = rows.reduce((s, l) => s + (Number(l.hours) || 0), 0);

  const exportRows = () => {
    const tag = scope === "all" ? "all" : period.range.label.replace(/[^\w]+/g, "-");
    downloadCsv(`axoraa-work-log${personal ? `-${personal.toLowerCase()}` : ""}-${tag}`, rows, WORK_LOG_COLUMNS);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { value: "period", label: "By period" },
              { value: "all", label: "All time" },
            ]}
          />
          {scope === "period" && (
            <PeriodPicker granularity={period.granularity} onGranularity={period.setGranularity} range={period.range} onShift={period.shift} onToday={period.reset} />
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={exportRows} disabled={!rows.length}>
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      <section className="card p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search module, task, PR, repo…" className="field pl-11 rounded-full" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!personal && (
              <select value={person} onChange={(e) => setPerson(e.target.value)} className="field w-auto rounded-full h-10 pr-8" aria-label="Filter by person">
                {people.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            )}
            <Segmented
              size="sm"
              value={status}
              onChange={setStatus}
              options={[
                { value: "All", label: "All" },
                { value: "In Progress", label: "Active" },
                { value: "Completed", label: "Done" },
                { value: "Blocked", label: "Blocked" },
              ]}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 text-[12.5px] text-ink-3">
          <span>
            <span className="text-ink font-medium tabular-nums">{rows.length}</span> entries
          </span>
          <span>
            <span className="text-ink font-medium tabular-nums">{formatNumber(hours, 1)}</span> hours
          </span>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={<Search />} title="No entries match" body="Try another period, or clear the filters." />
        ) : (
          <div className="mt-4 -mx-4 sm:-mx-6 overflow-x-auto">
            <table className="table-clean min-w-[860px]">
              <thead>
                <tr>
                  <th className="pl-4 sm:pl-6">Date</th>
                  {!personal && <th>Person</th>}
                  <th>Work</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th className="text-right">Hours</th>
                  <th>Release</th>
                  <th className="pr-4 sm:pr-6" />
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id} className="group">
                    <td className="pl-4 sm:pl-6 whitespace-nowrap tabular-nums text-ink-2">{formatDay(l.date, { day: "numeric", month: "short", year: "2-digit" })}</td>
                    {!personal && (
                      <td className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Avatar name={l.developerName} size={26} />
                          {l.developerName}
                        </div>
                      </td>
                    )}
                    <td className="max-w-[420px]">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{l.module}</span>
                        {l.githubPr && <span className="font-mono text-[11px] text-ink-3 shrink-0">{l.githubPr}</span>}
                      </div>
                      <div className="text-[12px] text-ink-3 truncate mt-0.5">
                        <span className="text-ink-2">{l.workType}</span> · {l.taskDescription}
                      </div>
                      {l.isBlocked === "Yes" && l.blockerDetails && <div className="text-[12px] text-coral truncate mt-0.5">⛔ {l.blockerDetails}</div>}
                    </td>
                    <td>
                      <StatusPill status={l.isBlocked === "Yes" ? "Blocked" : l.workStatus} />
                    </td>
                    <td>
                      <span className={`chip ${l.priority === "Critical" || l.priority === "High" ? "chip-coral" : ""}`}>{l.priority}</span>
                    </td>
                    <td className="text-right tabular-nums font-medium">{l.hours}</td>
                    <td className="whitespace-nowrap text-ink-2">{l.deployment}</td>
                    <td className="pr-4 sm:pr-6">
                      <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        {canEdit && (
                          <button onClick={() => onEdit(l)} className="w-8 h-8 rounded-full hover:bg-surface flex items-center justify-center" aria-label="Edit entry">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => onDelete(l)} className="w-8 h-8 rounded-full hover:bg-coral-soft hover:text-coral flex items-center justify-center" aria-label="Delete entry">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
