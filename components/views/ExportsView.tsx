"use client";

import React, { useMemo, useRef, useState } from "react";
import { DatabaseBackup, Download, FileSpreadsheet, FileUp, HardDrive, Printer, RotateCcw, ShieldAlert, Trash2 } from "lucide-react";
import { useHub } from "@/lib/hub/context";
import { can } from "@/lib/hub/permissions";
import type { EntityKey } from "@/lib/data/entities";
import type { HubBackup } from "@/lib/types";
import { COMPANY_EMAIL } from "@/lib/company";
import { engineeringRollup, inRange, invoiceTds } from "@/lib/analytics";
import { usePeriod } from "@/lib/usePeriod";
import { dayKeyOf, formatDateIST, formatDateTimeIST, formatInrFull, formatNumber, nowISO, parseInstant, toDayKey, todayKeyIST } from "@/lib/format";
import {
  ACTIVITY_COLUMNS,
  CAMPAIGN_COLUMNS,
  CLIENT_COLUMNS,
  DEAL_COLUMNS,
  DRAFT_COLUMNS,
  INTERACTION_COLUMNS,
  PAYMENT_COLUMNS,
  POST_COLUMNS,
  PROJECT_COLUMNS,
  REPOSITORY_COLUMNS,
  ROSTER_COLUMNS,
  WORK_LOG_COLUMNS,
  downloadCsv,
  downloadJson,
  type Column,
} from "@/lib/export";
import { Dialog } from "@/components/ui/Dialog";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { CardHeader, PeriodPicker, Segmented } from "@/components/ui/primitives";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { PrintArea, printNow } from "@/components/print/PrintArea";

/* ------------------------------------------------------------------ datasets */

interface Dataset {
  key: EntityKey;
  title: string;
  sub: string;
  slug: string;
  /** Rows in the chosen scope. */
  count: number;
  total: number;
  /** Snapshot datasets have no natural date and are always exported whole. */
  dated: boolean;
  lastUpdated: string | null;
  run: () => void;
}

const ENTITY_LABEL: Record<EntityKey, string> = {
  workLogs: "Work log",
  deals: "Deals",
  interactions: "Visits",
  clients: "Clients",
  projects: "Projects",
  payments: "Invoices",
  posts: "Content",
  campaigns: "Campaigns",
  drafts: "Assistant drafts",
  activity: "Activity",
  roster: "Roster",
  repositories: "Repositories",
  settings: "Settings",
};

type Scope = "period" | "all";
type RangeLike = { start: Date; end: Date };

/** Newest updatedAt / createdAt / own date among the rows, as an ISO string or day key. */
function newest<T>(rows: T[], extra?: (r: T) => string | undefined): string | null {
  let best: string | null = null;
  let bestMs = -Infinity;
  for (const r of rows) {
    const rec = r as { updatedAt?: string; createdAt?: string };
    for (const v of [rec.updatedAt, rec.createdAt, extra?.(r)]) {
      const ms = parseInstant(v);
      if (ms !== null && ms > bestMs) {
        bestMs = ms;
        best = v!;
      }
    }
  }
  return best;
}

function makeDataset<T>(o: {
  key: EntityKey;
  title: string;
  sub: string;
  slug: string;
  rows: T[];
  columns: Column<T>[];
  date?: (r: T) => string | undefined;
  scope: Scope;
  range: RangeLike;
  tag: string;
}): Dataset {
  const dated = !!o.date;
  const inScope = o.scope === "all" || !o.date ? o.rows : o.rows.filter((r) => inRange(dayKeyOf(o.date!(r)) ?? undefined, o.range));
  return {
    key: o.key,
    title: o.title,
    sub: o.sub,
    slug: o.slug,
    count: inScope.length,
    total: o.rows.length,
    dated,
    lastUpdated: newest(o.rows, o.date),
    run: () => downloadCsv(`axoraa-${o.slug}-${dated ? o.tag : "snapshot"}`, inScope, o.columns),
  };
}

/* ------------------------------------------------------------------ backup parsing */

type Parsed = { ok: true; backup: HubBackup; name: string; counts: { key: EntityKey; count: number }[] } | { ok: false; name: string; error: string };

function parseBackup(text: string, name: string): Parsed {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, name, error: "This file isn't valid JSON, so it can't be a hub backup." };
  }
  const b = raw as Partial<HubBackup> | null;
  if (!b || typeof b !== "object" || b.format !== "axoraa-hub-backup") return { ok: false, name, error: "This isn't an Axoraa Hub backup file." };
  if (b.version !== 2) return { ok: false, name, error: `This backup uses format version ${String(b.version ?? "unknown")}. Only version 2 backups can be restored.` };
  if (!b.data || typeof b.data !== "object") return { ok: false, name, error: "The backup has no data in it." };
  const counts = (Object.keys(ENTITY_LABEL) as EntityKey[])
    .filter((k) => Array.isArray(b.data![k]))
    .map((k) => ({ key: k, count: (b.data![k] as unknown[]).length }));
  return { ok: true, backup: b as HubBackup, name, counts };
}

/* ------------------------------------------------------------------ view */

export function ExportsView() {
  const { data, viewer } = useHub();
  const toast = useToast();
  const confirm = useConfirm();

  const dates = useMemo(
    () => [...data.workLogs.map((l) => l.date), ...data.interactions.map((i) => i.date), ...data.deals.map((d) => d.dateAdded), ...data.payments.map((p) => p.issueDate || p.dueDate)],
    [data.workLogs, data.interactions, data.deals, data.payments]
  );
  const period = usePeriod(dates, "month");
  const [scope, setScope] = useState<Scope>("period");
  const r = period.range;
  const tag = scope === "all" ? "all-time" : r.label.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");

  const sets = useMemo<Dataset[]>(() => {
    const common = { scope, range: r, tag };
    return [
      makeDataset({ ...common, key: "workLogs", title: "Work log", sub: "Every engineering entry", slug: "work-log", rows: data.workLogs, columns: WORK_LOG_COLUMNS, date: (x) => x.date }),
      makeDataset({ ...common, key: "deals", title: "Deals", sub: "Leads and deals, by date added", slug: "deals", rows: data.deals, columns: DEAL_COLUMNS, date: (x) => x.dateAdded }),
      makeDataset({ ...common, key: "interactions", title: "Visits", sub: "Client visits and calls", slug: "visits", rows: data.interactions, columns: INTERACTION_COLUMNS, date: (x) => x.date }),
      makeDataset({ ...common, key: "clients", title: "Clients", sub: "Accounts, owners and deal values", slug: "clients", rows: data.clients, columns: CLIENT_COLUMNS }),
      makeDataset({ ...common, key: "projects", title: "Projects", sub: "Delivery status and blockers", slug: "projects", rows: data.projects, columns: PROJECT_COLUMNS }),
      makeDataset({
        ...common,
        key: "payments",
        title: "Invoices",
        sub: "Billing, receipts and TDS, by invoice date",
        slug: "invoices",
        rows: data.payments,
        columns: PAYMENT_COLUMNS,
        date: (x) => x.issueDate || x.dueDate,
      }),
      makeDataset({ ...common, key: "posts", title: "Content", sub: "Posts, by scheduled date", slug: "content", rows: data.posts, columns: POST_COLUMNS, date: (x) => x.scheduledAt || x.publishedAt || x.createdAt }),
      makeDataset({ ...common, key: "campaigns", title: "Campaigns", sub: "Budget, spend and leads, by start date", slug: "campaigns", rows: data.campaigns, columns: CAMPAIGN_COLUMNS, date: (x) => x.startDate }),
      makeDataset({ ...common, key: "drafts", title: "Assistant drafts", sub: "Emails, posts and plans the assistant wrote", slug: "assistant-drafts", rows: data.drafts, columns: DRAFT_COLUMNS, date: (x) => x.createdAt }),
      makeDataset({ ...common, key: "activity", title: "Activity", sub: "Who changed what, newest first", slug: "activity", rows: data.activity, columns: ACTIVITY_COLUMNS, date: (x) => x.at }),
      makeDataset({ ...common, key: "roster", title: "Roster", sub: "Team members", slug: "roster", rows: data.roster, columns: ROSTER_COLUMNS }),
      makeDataset({ ...common, key: "repositories", title: "Repositories", sub: "Repositories and who looks after them", slug: "repositories", rows: data.repositories, columns: REPOSITORY_COLUMNS }),
    ];
  }, [data.workLogs, data.deals, data.interactions, data.clients, data.projects, data.payments, data.posts, data.campaigns, data.drafts, data.activity, data.roster, data.repositories, scope, r, tag]);

  const [printAt, setPrintAt] = useState<string | null>(null);

  if (!data.ready) return <SkeletonPage />;

  const canExport = can(viewer, "data.export");
  const scopeLabel = scope === "all" ? "All time" : r.label;
  const totalRows = sets.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Export scope"
            value={scope}
            onChange={setScope}
            options={[
              { value: "period", label: "Selected period" },
              { value: "all", label: "All time" },
            ]}
          />
          {scope === "period" && <PeriodPicker granularity={period.granularity} onGranularity={period.setGranularity} range={r} onShift={period.shift} onToday={period.reset} />}
        </div>
        <button type="button" className="btn btn-ghost self-start lg:self-auto" onClick={() => setPrintAt(nowISO())}>
          <Printer aria-hidden className="h-4 w-4" /> Print summary
        </button>
      </div>

      {!canExport ? (
        <div className="card p-5 sm:p-6">
          <p className="text-[14px] text-ink-2">Only the administrator can download exports.</p>
        </div>
      ) : (
        <>
          <p className="px-1 text-[13px] text-ink-3">
            {scope === "all"
              ? `Every row of every dataset, ${formatNumber(totalRows)} rows in all.`
              : `${formatNumber(totalRows)} rows for ${r.label}. Clients, projects, roster and repositories are always exported whole.`}
          </p>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3" aria-label="Datasets">
            {sets.map((s, i) => {
              const lime = i === 0;
              return (
                <li
                  key={s.key}
                  className={`${lime ? "card-lime" : "card"} flex min-h-[190px] min-w-0 animate-rise flex-col p-5 sm:p-6`}
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span aria-hidden className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${lime ? "bg-ink text-lime" : "bg-surface-2"}`}>
                      <FileSpreadsheet className="h-5 w-5" />
                    </span>
                    <span className={`chip ${lime ? "bg-white/70 text-on-lime" : ""}`}>{s.dated ? scopeLabel : "Snapshot"}</span>
                  </div>
                  <div className="mt-5 min-w-0">
                    <h3 className="text-[17px] font-medium tracking-[-0.02em]">{s.title}</h3>
                    <p className={`mt-1 text-[12.5px] ${lime ? "text-on-lime/65" : "text-ink-3"}`}>{s.sub}</p>
                    <p className={`mt-1 text-[12px] ${lime ? "text-on-lime/65" : "text-ink-3"}`}>
                      {s.lastUpdated ? `Last updated ${formatDateIST(s.lastUpdated, { year: true })}` : "No rows yet"}
                    </p>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-5">
                    <span className="text-[13px] tabular-nums">
                      <span className="num mr-1 text-[28px]">{formatNumber(s.count)}</span>
                      {s.count === 1 ? "row" : "rows"}
                      {s.dated && scope === "period" && s.total !== s.count && <span className={lime ? "text-on-lime/60" : "text-ink-3"}> of {formatNumber(s.total)}</span>}
                    </span>
                    <button
                      type="button"
                      className={`btn btn-sm ${lime ? "btn-ink" : "btn-ghost"}`}
                      onClick={s.run}
                      disabled={!s.count}
                      aria-label={`Download ${s.title} as CSV`}
                    >
                      <Download aria-hidden className="h-3.5 w-3.5" /> Download CSV
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <BackupCard />
          {can(viewer, "data.reset", { data }) && <DeviceDataCard confirm={confirm} toast={toast} />}
        </>
      )}

      {printAt && <PrintSummaryDialog generatedAt={printAt} scope={scope} range={r} label={scopeLabel} onClose={() => setPrintAt(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ backup and restore */

function BackupCard() {
  const { data, viewer } = useHub();
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [busy, setBusy] = useState(false);
  const canImport = can(viewer, "data.import");
  const effectiveMode = data.sharedMode ? "merge" : mode;

  const download = () => {
    try {
      downloadJson(`axoraa-hub-backup-${todayKeyIST()}.json`, data.exportBackup());
      toast({ message: "Downloaded the full backup", tone: "positive" });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Couldn't build the backup.", tone: "negative" });
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setParsed(parseBackup(await file.text(), file.name));
    } catch {
      setParsed({ ok: false, name: file.name, error: "Couldn't read this file." });
    }
  };

  const restore = async () => {
    if (!parsed?.ok) return;
    const replace = effectiveMode === "replace";
    const ok = await confirm({
      title: replace ? "Replace the data on this device?" : "Merge this backup?",
      body: replace
        ? "Every dataset in the backup replaces what is on this device. Records that are not in the backup are deleted. Download a backup first if you might need them."
        : data.sharedMode
        ? "Records from the backup are added to the shared Google Sheet. Records with the same ID are overwritten. Nothing is deleted."
        : "Records from the backup are added. Records with the same ID are overwritten. Nothing is deleted.",
      confirmLabel: replace ? "Replace data" : "Merge backup",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await data.importBackup(parsed.backup, effectiveMode);
      toast({ message: `Restored ${formatNumber(res.imported)} ${res.imported === 1 ? "record" : "records"} from ${parsed.name}`, tone: "positive" });
      setParsed(null);
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Couldn't restore the backup.", tone: "negative" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="backup-heading" className="card p-5 sm:p-6">
      <CardHeader icon={<DatabaseBackup />} title={<span id="backup-heading">Backup and restore</span>} subtitle="Everything in the hub as one JSON file, including settings" />
      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="card-inset flex flex-col p-5">
          <p className="text-[14px] font-medium text-ink">Download a full backup</p>
          <p className="mt-1 text-[13px] text-ink-3">
            {data.sharedMode ? "Takes what this browser has loaded from the shared sheet." : "Takes every record stored on this device."} Keep it somewhere safe.
          </p>
          <div className="mt-auto pt-4">
            <button type="button" className="btn btn-ink btn-sm" onClick={download}>
              <Download aria-hidden className="h-3.5 w-3.5" /> Download full backup (.json)
            </button>
          </div>
        </div>

        <div className="card-inset flex flex-col p-5">
          <p className="text-[14px] font-medium text-ink">Restore from backup</p>
          {!canImport ? (
            <p className="mt-1 text-[13px] text-ink-3">Only the administrator can restore a backup.</p>
          ) : (
            <>
              <p className="mt-1 text-[13px] text-ink-3">Pick an axoraa-hub-backup file. You see what is in it before anything changes.</p>
              <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void onFile(e)} />
              <div className="mt-4">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
                  <FileUp aria-hidden className="h-3.5 w-3.5" /> Choose backup file
                </button>
              </div>

              {parsed && !parsed.ok && (
                <div role="alert" className="mt-4 rounded-[18px] bg-coral-soft px-4 py-3 text-[13px] text-ink">
                  <span className="font-medium">{parsed.name}</span>: {parsed.error}
                </div>
              )}

              {parsed?.ok && (
                <div className="mt-4 space-y-4 rounded-[18px] bg-surface p-4">
                  <div>
                    <p className="truncate text-[13px] font-medium text-ink">{parsed.name}</p>
                    <p className="text-[12px] text-ink-3">
                      Made {parsed.backup.exportedAt ? formatDateTimeIST(parsed.backup.exportedAt) : "on an unknown date"}
                      {parsed.backup.exportedBy ? ` by ${parsed.backup.exportedBy}` : ""}
                    </p>
                  </div>
                  <ul className="flex flex-wrap gap-1.5" aria-label="Records in this backup">
                    {parsed.counts.map((c) => (
                      <li key={c.key} className="chip chip-outline">
                        {ENTITY_LABEL[c.key]} <span className="font-medium tabular-nums">{formatNumber(c.count)}</span>
                      </li>
                    ))}
                    {parsed.counts.length === 0 && <li className="text-[12.5px] text-ink-3">No datasets in this file.</li>}
                  </ul>
                  <fieldset className="space-y-2">
                    <legend className="mb-1.5 text-[12px] font-medium text-ink-2">How to restore</legend>
                    {(["merge", "replace"] as const).map((m) => {
                      const disabled = m === "replace" && data.sharedMode;
                      return (
                        <label
                          key={m}
                          className={`flex items-start gap-3 rounded-[16px] px-3 py-2.5 ${effectiveMode === m ? "bg-lime-soft" : "bg-surface-2"} ${disabled ? "opacity-60" : "cursor-pointer"}`}
                        >
                          <input
                            type="radio"
                            name="restore-mode"
                            value={m}
                            checked={effectiveMode === m}
                            disabled={disabled}
                            onChange={() => setMode(m)}
                            className="mt-1 accent-accent"
                          />
                          <span className="min-w-0">
                            <span className="block text-[13.5px] font-medium text-ink">{m === "merge" ? "Merge" : "Replace"}</span>
                            <span className="block text-[12px] text-ink-3">
                              {m === "merge"
                                ? "Add the backup's records and update ones with the same ID."
                                : disabled
                                ? "Replace only works with data on this device. Use merge for the shared sheet."
                                : "Make this device match the backup exactly."}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn btn-coral btn-sm" disabled={busy || parsed.counts.length === 0} onClick={() => void restore()}>
                      <RotateCcw aria-hidden className="h-3.5 w-3.5" /> {busy ? "Restoring" : effectiveMode === "replace" ? "Replace with backup" : "Merge backup"}
                    </button>
                    <button type="button" className="btn btn-plain btn-sm" disabled={busy} onClick={() => setParsed(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ data on this device */

function DeviceDataCard({ confirm, toast }: { confirm: ReturnType<typeof useConfirm>; toast: ReturnType<typeof useToast> }) {
  const { data } = useHub();

  const reset = async (mode: "empty" | "demo") => {
    const ok = await confirm(
      mode === "empty"
        ? {
            title: "Clear all data on this device?",
            body: "This removes every record stored in this browser, the demo data and anything you added. Download a backup first if you want to keep it.",
            confirmLabel: "Clear data",
            tone: "danger",
          }
        : {
            title: "Load the demo data?",
            body: "Sample work logs, deals, clients, invoices and posts replace what is stored in this browser now.",
            confirmLabel: "Load demo data",
            tone: "danger",
          }
    );
    if (!ok) return;
    try {
      data.resetLocalData(mode);
      toast({ message: mode === "empty" ? "Cleared the data on this device" : "Loaded the demo data", tone: "positive" });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Couldn't reset the data.", tone: "negative" });
    }
  };

  return (
    <section aria-labelledby="device-heading" className="card p-5 sm:p-6">
      <CardHeader icon={<HardDrive />} title={<span id="device-heading">Data on this device</span>} subtitle="Records are kept in this browser until Google Sheets is shared" />
      <div className="mt-5 flex flex-col gap-4 rounded-[22px] bg-amber-soft p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber text-ink">
            <ShieldAlert className="h-4 w-4" />
          </span>
          <p className="min-w-0 pt-1 text-[13.5px] text-ink">
            {data.hasDemoData ? "This device still has demo data mixed in. Clear it before real use." : "Start again from an empty hub, or bring the demo data back to try things out."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-coral btn-sm" onClick={() => void reset("empty")}>
            <Trash2 aria-hidden className="h-3.5 w-3.5" /> Clear demo data
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void reset("demo")}>
            Load demo data
          </button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ print summary */

/** '1 Nov 2026 to 30 Nov 2026' for a range with an exclusive end. */
function rangeText(range: RangeLike): string {
  const last = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate() - 1);
  return `${formatDateIST(toDayKey(range.start), { year: true })} to ${formatDateIST(toDayKey(last), { year: true })}`;
}

function PrintSummaryDialog({ generatedAt, scope, range, label, onClose }: { generatedAt: string; scope: Scope; range: ReturnType<typeof usePeriod>["range"]; label: string; onClose: () => void }) {
  const { data, viewer } = useHub();
  const within = <T,>(rows: T[], date: (x: T) => string | undefined) => (scope === "all" ? rows : rows.filter((x) => inRange(dayKeyOf(date(x)) ?? undefined, range)));

  const logs = within(data.workLogs, (l) => l.date);
  const hours = logs.reduce((s, l) => s + (Number(l.hours) || 0), 0);
  const deals = within(data.deals, (d) => d.dateAdded);
  const won = within(
    data.deals.filter((d) => d.leadStatus === "Closed Won"),
    (d) => d.conversionDate || d.dateAdded
  );
  const visits = within(data.interactions, (i) => i.date);
  const clients = within(data.clients, (c) => c.signedDate);
  const invoices = within(data.payments, (p) => p.issueDate || p.dueDate);
  const posts = within(data.posts.filter((p) => p.status === "published"), (p) => p.publishedAt || p.scheduledAt);
  const campaigns = within(data.campaigns, (c) => c.startDate);
  const people = scope === "all" ? [] : engineeringRollup(data.workLogs, range).people.filter((p) => p.entries > 0);

  const money = (rows: typeof invoices, f: (p: (typeof invoices)[number]) => number) => rows.reduce((s, p) => s + f(p), 0);
  const sections: { title: string; rows: [string, string][] }[] = [
    {
      title: "Engineering",
      rows: [
        ["Hours logged", `${formatNumber(hours, 1)} h`],
        ["Work entries", formatNumber(logs.length)],
        ["Completed tasks", formatNumber(logs.filter((l) => l.workStatus === "Completed").length)],
        ["Blocked tasks", formatNumber(logs.filter((l) => l.workStatus === "Blocked").length)],
      ],
    },
    {
      title: "Sales and marketing",
      rows: [
        ["Deals added", formatNumber(deals.length)],
        ["Deals won", `${formatNumber(won.length)}, ${formatInrFull(won.reduce((s, d) => s + (Number(d.estimatedDealValue) || 0), 0))}`],
        ["Visits logged", formatNumber(visits.length)],
        ["Posts published", formatNumber(posts.length)],
        ["Campaign spend", formatInrFull(campaigns.reduce((s, c) => s + (Number(c.spend) || 0), 0))],
        ["Campaign leads", formatNumber(campaigns.reduce((s, c) => s + (Number(c.leads) || 0), 0))],
      ],
    },
    {
      title: "Clients and collections",
      rows: [
        ["Clients signed", formatNumber(clients.length)],
        ["Invoices raised", formatNumber(invoices.length)],
        ["Invoiced", formatInrFull(money(invoices, (p) => Number(p.invoicedAmount) || 0))],
        ["Received", formatInrFull(money(invoices, (p) => Number(p.receivedAmount) || 0))],
        ["TDS deducted", formatInrFull(money(invoices, invoiceTds))],
        ["Balance", formatInrFull(money(invoices, (p) => Number(p.pendingAmount) || 0))],
        ["Overdue", formatInrFull(money(invoices, (p) => Number(p.overdueAmount) || 0))],
      ],
    },
  ];

  return (
    <Dialog
      open
      onClose={onClose}
      icon={<Printer />}
      title="Print summary"
      description={`Totals for ${label}`}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn-ink" onClick={() => printNow()}>
            <Printer aria-hidden /> Print
          </button>
        </>
      }
    >
      <div className="-mx-2 overflow-x-auto rounded-[18px] bg-surface-2 p-2 sm:p-4">
        <PrintArea>
          <article
            aria-label={`Summary for ${label}`}
            className="paper mx-auto w-full min-w-[520px] max-w-[794px] rounded-sm border border-line px-6 py-8 text-ink sm:px-10 sm:py-10 print:min-w-0 print:max-w-none print:rounded-none print:border-0 print:p-0"
          >
            <header className="flex items-end justify-between gap-6 border-b border-line pb-4">
              <div>
                <p className="text-[12px] text-ink-3">Axoraa Hub</p>
                <h1 className="mt-1 text-[24px] font-medium tracking-[-0.03em]">Summary for {label}</h1>
              </div>
              {scope === "period" && <p className="shrink-0 text-[12px] tabular-nums text-ink-3">{rangeText(range)}</p>}
            </header>
            <div className="mt-6 grid gap-8 sm:grid-cols-2">
              {sections.map((s) => (
                <section key={s.title} className={s.title === "Clients and collections" ? "sm:col-span-2" : ""}>
                  <h2 className="text-[13px] font-medium text-ink-2">{s.title}</h2>
                  <dl className={`mt-2 ${s.title === "Clients and collections" ? "grid gap-x-10 sm:grid-cols-2" : ""}`}>
                    {s.rows.map(([k, v]) => (
                      <div key={k} className="flex items-baseline justify-between gap-6 border-b border-line py-2 text-[13px]">
                        <dt className="text-ink-2">{k}</dt>
                        <dd className="tabular-nums text-ink">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
            {people.length > 0 && (
              <section className="mt-8">
                <h2 className="text-[13px] font-medium text-ink-2">Hours by person</h2>
                <table className="mt-2 w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-line-strong text-left text-[12px] text-ink-3">
                      <th scope="col" className="py-2 font-medium">Person</th>
                      <th scope="col" className="py-2 text-right font-medium">Entries</th>
                      <th scope="col" className="py-2 text-right font-medium">Hours</th>
                      <th scope="col" className="py-2 text-right font-medium">Completed</th>
                      <th scope="col" className="py-2 text-right font-medium">Blocked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((p) => (
                      <tr key={p.name} className="border-b border-line">
                        <td className="py-2">{p.name}</td>
                        <td className="py-2 text-right tabular-nums">{p.entries}</td>
                        <td className="py-2 text-right tabular-nums">{formatNumber(p.hours, 1)}</td>
                        <td className="py-2 text-right tabular-nums">{p.completed}</td>
                        <td className="py-2 text-right tabular-nums">{p.blocked}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
            <footer className="mt-10 border-t border-line pt-4 text-[12px] text-ink-3">
              Generated by {viewer.name} on {formatDateTimeIST(generatedAt)}. Axoraa, {COMPANY_EMAIL}
            </footer>
          </article>
        </PrintArea>
      </div>
    </Dialog>
  );
}
