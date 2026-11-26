"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle2, CircleCheck, Download, Link2, Lock, Pencil, RefreshCw, Search, ShieldCheck, Trash2, Unlock, X } from "lucide-react";
import type { DailyWorkLogEntry } from "@/lib/types";
import { inRange } from "@/lib/analytics";
import { usePeriod } from "@/lib/usePeriod";
import { downloadCsv, WORK_LOG_COLUMNS } from "@/lib/export";
import { formatDateIST, formatNumber } from "@/lib/format";
import { useHub } from "@/lib/hub/context";
import { can } from "@/lib/hub/permissions";
import { Avatar, EmptyState, PeriodPicker, Segmented } from "@/components/ui/primitives";
import { DataTable, DensityToggle, type TableColumn } from "@/components/ui/DataTable";
import { Select } from "@/components/ui/form";
import { StatusDot, toneForWorkStatus } from "@/components/ui/Status";
import { useConfirm, useToast } from "@/components/ui/feedback";
import type { MenuItem } from "@/components/ui/Menu";
import { isOpenBlocker, useResolveBlocker } from "@/components/engineering/BlockerList";

type StatusFilter = "all" | "In Progress" | "Completed" | "Blocked";
const ALL = "all";

const statusOf = (l: DailyWorkLogEntry) => (isOpenBlocker(l) ? "Blocked" : l.workStatus);
const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());

/**
 * Daily work log ('eng_log'), and the Blockers list ('eng_blockers' or ?filter=blocked) as the same
 * table limited to open blockers.
 */
export function WorkLogView() {
  const { data, viewer, view, params, setParams, openOverlay, registerSearch } = useHub();
  const confirm = useConfirm();
  const toast = useToast();
  const resolve = useResolveBlocker();
  const blockedMode = view === "eng_blockers" || params.get("filter") === "blocked";
  const logs = data.workLogs;

  const dates = useMemo(() => logs.map((l) => l.date), [logs]);
  const period = usePeriod(dates, "month");
  const [scope, setScope] = useState<"period" | "all">(blockedMode ? "all" : "period");

  // Search lives in ?q= so links (a repository on the dashboard, the command bar) can open it filtered.
  const paramQ = params.get("q") ?? "";
  const [q, setQ] = useState(paramQ);
  const [seenParamQ, setSeenParamQ] = useState(paramQ);
  if (paramQ !== seenParamQ) {
    setSeenParamQ(paramQ);
    setQ(paramQ);
  }
  const changeQ = (v: string) => {
    setQ(v);
    setParams({ q: v.trim() ? v : null });
  };

  const [person, setPerson] = useState(ALL);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [project, setProject] = useState(ALL);

  const people = useMemo(() => [...new Set(logs.map((l) => l.developerName).filter(Boolean))].sort(), [logs]);
  const projects = useMemo(() => [...new Set(logs.map((l) => l.project).filter(Boolean))].sort(), [logs]);
  const showPersonFilter = viewer.privileged && people.length > 1;
  const showPerson = viewer.privileged && !viewer.person;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return logs
      .filter((l) => (blockedMode ? isOpenBlocker(l) : true))
      .filter((l) => scope === "all" || inRange(l.date, period.range))
      .filter((l) => person === ALL || l.developerName === person)
      .filter((l) => project === ALL || l.project === project)
      .filter((l) => blockedMode || status === "all" || statusOf(l) === status)
      .filter(
        (l) =>
          !needle ||
          [l.module, l.taskDescription, l.developerName, l.project, l.repository, l.githubPr, l.notes, l.workType, l.blockerDetails].some((v) =>
            String(v ?? "").toLowerCase().includes(needle)
          )
      )
      .sort((a, b) => (b.date + (b.updatedAt ?? b.lastUpdated ?? "")).localeCompare(a.date + (a.updatedAt ?? a.lastUpdated ?? "")));
  }, [logs, blockedMode, scope, period.range, person, project, status, q]);

  const hours = rows.reduce((s, l) => s + (Number(l.hours) || 0), 0);
  const filtered = !!q.trim() || person !== ALL || project !== ALL || (!blockedMode && status !== "all");
  const clearFilters = () => {
    changeQ("");
    setPerson(ALL);
    setProject(ALL);
    setStatus("all");
  };

  const exportRows = () => {
    const tag = scope === "all" ? "all-time" : period.range.label.replace(/[^\w]+/g, "-");
    const who = viewer.person ? `-${viewer.person.id}` : person !== ALL ? `-${person.toLowerCase()}` : "";
    downloadCsv(`axoraa-${blockedMode ? "blockers" : "work-log"}${who}-${tag}`, rows, WORK_LOG_COLUMNS);
  };

  const markCompleted = async (l: DailyWorkLogEntry) => {
    const before = { workStatus: l.workStatus, isBlocked: l.isBlocked };
    await data.updateWorkLogStatus(l.id, { workStatus: "Completed", isBlocked: "No" });
    toast({ message: "Marked as completed", tone: "positive", action: { label: "Undo", onClick: () => void data.updateWorkLogStatus(l.id, before) } });
  };

  const remove = async (l: DailyWorkLogEntry) => {
    const ok = await confirm({
      title: "Delete this entry?",
      body: `${l.module || l.project || "This entry"}, logged by ${l.developerName} for ${formatDateIST(l.date, { weekday: true, year: true })}. This can't be undone.`,
      confirmLabel: "Delete entry",
      tone: "danger",
    });
    if (!ok) return;
    const res = await data.deleteWorkLog(l.id);
    if (!res.ok) {
      toast({ message: res.error || "Couldn't delete the entry.", tone: "negative" });
      return;
    }
    toast({ message: "Entry deleted" });
  };

  const actions = (l: DailyWorkLogEntry): MenuItem[] => {
    const edit = can(viewer, "worklog.edit", { data, record: l });
    const del = can(viewer, "worklog.delete", { data, record: l });
    const items: MenuItem[] = [
      { label: edit ? "Edit" : "View", icon: edit ? <Pencil /> : <Lock />, onSelect: () => openOverlay({ kind: "worklog", entry: l }) },
    ];
    if (edit && l.workStatus !== "Completed") items.push({ label: "Mark completed", icon: <CircleCheck />, onSelect: () => void markCompleted(l) });
    if (edit && isOpenBlocker(l)) items.push({ label: "Resolve blocker", icon: <Unlock />, onSelect: () => void resolve(l) });
    if (del) items.push({ label: "Delete", icon: <Trash2 />, tone: "danger", separatorBefore: true, onSelect: () => void remove(l) });
    return items;
  };

  const columns: TableColumn<DailyWorkLogEntry>[] = [
    {
      id: "date",
      header: "Date",
      cell: (l) => <span className="whitespace-nowrap tabular-nums text-ink-2">{formatDateIST(l.date, { weekday: true })}</span>,
      sortValue: (l) => l.date,
      width: 112,
    },
    ...(showPerson
      ? [
          {
            id: "person",
            header: "Person",
            cell: (l: DailyWorkLogEntry) => (
              <span className="flex items-center gap-2 whitespace-nowrap">
                <Avatar name={l.developerName} size={24} />
                {l.developerName}
              </span>
            ),
            sortValue: (l: DailyWorkLogEntry) => l.developerName,
          } satisfies TableColumn<DailyWorkLogEntry>,
        ]
      : []),
    {
      id: "project",
      header: "Project",
      cell: (l) => (
        <span className="block min-w-0">
          <span className="block truncate">{l.project || "–"}</span>
          {l.repository && <span className="block truncate font-mono text-[11.5px] text-ink-3">{l.repository}</span>}
        </span>
      ),
      sortValue: (l) => l.project,
      hideBelow: "lg",
      width: 170,
    },
    {
      id: "work",
      header: "Module and task",
      cell: (l) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium text-ink" title={l.module}>
            {l.module || "Untitled"}
          </span>
          <span className="block truncate text-[12px] text-ink-3" title={l.taskDescription}>
            {l.taskDescription}
          </span>
          {isOpenBlocker(l) && l.blockerDetails && (
            <span className="block truncate text-[12px] text-negative" title={l.blockerDetails}>
              Blocked: {l.blockerDetails}
            </span>
          )}
        </span>
      ),
      truncate: true,
    },
    { id: "type", header: "Type", cell: (l) => <span className="whitespace-nowrap text-ink-2">{l.workType}</span>, sortValue: (l) => l.workType, hideBelow: "lg" },
    {
      id: "status",
      header: "Status",
      cell: (l) => <StatusDot tone={toneForWorkStatus(statusOf(l))} label={statusOf(l)} />,
      sortValue: (l) => statusOf(l),
    },
    {
      id: "priority",
      header: "Priority",
      cell: (l) => <span className={`chip ${l.priority === "Critical" || l.priority === "High" ? "chip-coral" : ""}`}>{l.priority}</span>,
      sortValue: (l) => ["Critical", "High", "Medium", "Low"].indexOf(l.priority),
      hideBelow: "lg",
    },
    { id: "hours", header: "Hours", align: "right", cell: (l) => <span className="font-medium">{formatNumber(Number(l.hours) || 0, 2)}</span>, sortValue: (l) => Number(l.hours) || 0, width: 72 },
    {
      id: "review",
      header: "Review",
      cell: (l) =>
        l.reviewRequired === "Yes" ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-ink-2">
            <ShieldCheck aria-hidden className="size-3.5 text-ink-3" />
            {l.reviewer && l.reviewer !== "-" ? (l.reviewer === "all" ? "Anyone" : l.reviewer) : "Needed"}
          </span>
        ) : null,
      hideBelow: "lg",
    },
    {
      id: "pr",
      header: <span className="sr-only">Pull request</span>,
      cell: (l) =>
        l.githubPr ? (
          isUrl(l.githubPr) ? (
            <a
              href={l.githubPr}
              target="_blank"
              rel="noopener noreferrer"
              className="icon-btn icon-btn-sm"
              aria-label={`Open the pull request for ${l.module || "this entry"}`}
              onClick={(e) => e.stopPropagation()}
            >
              <Link2 aria-hidden />
            </a>
          ) : (
            <span className="font-mono text-[12px] text-ink-3">{l.githubPr}</span>
          )
        ) : null,
      width: 56,
      align: "center",
    },
  ];

  const flashKey = data.lastSaved?.entity === "workLogs" ? `${data.lastSaved.id}:${data.lastSaved.at}` : undefined;
  const sheetNote = data.source === "sheet" && !viewer.privileged;
  const syncError = data.source === "sheet" && data.syncState.error;

  return (
    <div className="space-y-4 lg:space-y-5">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Time range"
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
        <div className="flex flex-wrap items-center gap-2">
          <DensityToggle />
          <button type="button" className="btn btn-ghost" onClick={exportRows} disabled={!rows.length}>
            <Download aria-hidden className="size-4" /> Export CSV
          </button>
        </div>
      </div>

      <section className="card p-4 sm:p-5" aria-label="Filters">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full lg:max-w-md">
            <span className="sr-only">Search work log</span>
            <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input
              ref={registerSearch}
              type="search"
              aria-label="Search work log"
              value={q}
              onChange={(e) => changeQ(e.target.value)}
              placeholder="Search module, task, PR or repository"
              className="field rounded-full pl-11"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {showPersonFilter && (
              <Select fieldSize="sm" aria-label="Filter by person" value={person} onChange={(e) => setPerson(e.target.value)} className="w-[150px] [&>select]:rounded-full">
                <option value={ALL}>Everyone</option>
                {people.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            )}
            {projects.length > 1 && (
              <Select fieldSize="sm" aria-label="Filter by project" value={project} onChange={(e) => setProject(e.target.value)} className="w-[170px] [&>select]:rounded-full">
                <option value={ALL}>All projects</option>
                {projects.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            )}
            {!blockedMode && (
              <Segmented<StatusFilter>
                size="sm"
                label="Filter by status"
                value={status}
                onChange={setStatus}
                options={[
                  { value: "all", label: "All" },
                  { value: "In Progress", label: "Active" },
                  { value: "Completed", label: "Done" },
                  { value: "Blocked", label: "Blocked" },
                ]}
              />
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[12.5px] text-ink-3">
          <span>
            <span className="font-medium tabular-nums text-ink">{rows.length}</span> {blockedMode ? (rows.length === 1 ? "open blocker" : "open blockers") : rows.length === 1 ? "entry" : "entries"}
          </span>
          <span>
            <span className="font-medium tabular-nums text-ink">{formatNumber(hours, 1)}</span> hours
          </span>
          {filtered && (
            <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">
              <X aria-hidden className="size-3.5" /> Clear filters
            </button>
          )}
        </div>
      </section>

      {syncError && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-inset)] bg-coral-soft p-4 sm:flex-row sm:items-center">
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-coral text-white">
            <RefreshCw className="h-4 w-4" />
          </span>
          <p className="min-w-0 flex-1 text-[13.5px] text-ink">
            {data.syncState.message || "Couldn't reach Google Sheets."} Showing what&apos;s saved on this device.
          </p>
          <button type="button" className="btn btn-ink btn-sm self-start sm:self-auto" disabled={data.syncState.busy} onClick={() => void data.pullFromSheet()}>
            Try again
          </button>
        </div>
      )}

      {sheetNote && (
        <p className="flex items-center gap-2 px-1 text-[12.5px] text-ink-3">
          <Lock aria-hidden className="size-3.5" />
          Entries saved to Google Sheets can only be changed by the administrator.
        </p>
      )}

      <DataTable
        caption={blockedMode ? "Open blockers" : "Work log"}
        rows={rows}
        columns={columns}
        rowKey={(l) => l.id}
        rowLabel={(l) => `${l.module || "entry"}, ${formatDateIST(l.date)}`}
        onRowClick={(l) => openOverlay({ kind: "worklog", entry: l })}
        rowActions={actions}
        flashKey={flashKey}
        mobileCard={(l) => (
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[14px] font-medium text-ink">{l.module || l.project || "Untitled"}</span>
              <span className="shrink-0 text-[14px] font-medium tabular-nums text-ink">{formatNumber(Number(l.hours) || 0, 2)} h</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
              <StatusDot tone={toneForWorkStatus(statusOf(l))} label={statusOf(l)} />
              <span className="tabular-nums">{formatDateIST(l.date, { weekday: true })}</span>
              {showPerson && <span>{l.developerName}</span>}
            </div>
            {isOpenBlocker(l) && l.blockerDetails && <p className="mt-1.5 line-clamp-2 text-[12.5px] text-negative">{l.blockerDetails}</p>}
          </div>
        )}
        empty={
          blockedMode && !filtered && scope === "all" ? (
            <EmptyState icon={<CheckCircle2 />} title="No open blockers." body="Anything logged as Blocked shows up here until it is resolved." />
          ) : logs.length === 0 ? (
            <EmptyState
              icon={<Pencil />}
              title="No work logged yet"
              body="Each entry records what was done, how long it took and anything in the way."
              action={
                can(viewer, "worklog.edit", { data }) ? (
                  <button type="button" className="btn btn-ink btn-sm" onClick={() => openOverlay({ kind: "worklog", entry: null })}>
                    Log work
                  </button>
                ) : undefined
              }
            />
          ) : (
            <EmptyState
              icon={<Search />}
              title={filtered ? (blockedMode ? "No open blockers match these filters" : "No entries match these filters") : "No entries in this period"}
              body={filtered ? "Try another period, or clear the filters." : "Nothing in this period. Look at another one, or show all time."}
              action={
                filtered ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
                    Clear filters
                  </button>
                ) : (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setScope("all")}>
                    Show all time
                  </button>
                )
              }
            />
          )
        }
      />
    </div>
  );
}
