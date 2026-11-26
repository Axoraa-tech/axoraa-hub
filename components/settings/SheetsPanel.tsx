"use client";

import React, { useState } from "react";
import { AlertTriangle, ArrowUpRight, Check, Copy, Database, RefreshCw, Upload, UploadCloud } from "lucide-react";
import { useHub } from "@/lib/hub/context";
import { useNow } from "@/lib/prefs";
import { formatNumber, relativeTime } from "@/lib/format";
import type { FeatureFlags } from "@/lib/features";
import type { HubData } from "@/lib/useHubData";
import type { RemoteEntity } from "@/lib/data/entities";
import { GOOGLE_APPS_SCRIPT_TEMPLATE } from "@/lib/googleAppsScriptCode";
import { useConfirm, useToast } from "@/components/ui/feedback";
import type { Tone } from "@/components/ui/Status";
import { Code, Notice, SetupSteps } from "./IntegrationRow";

export const ENTITY_LABEL: Record<RemoteEntity, [string, string]> = {
  deals: ["deal", "deals"],
  interactions: ["visit", "visits"],
  clients: ["client", "clients"],
  projects: ["project", "projects"],
  payments: ["invoice", "invoices"],
  roster: ["team member", "team members"],
  repositories: ["repository", "repositories"],
  posts: ["post", "posts"],
  campaigns: ["campaign", "campaigns"],
  drafts: ["assistant draft", "assistant drafts"],
  activity: ["activity line", "activity lines"],
  settings: ["settings row", "settings rows"],
};

export function countLabel(entity: RemoteEntity, n: number): string {
  const [one, many] = ENTITY_LABEL[entity];
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

export interface SheetsStatus {
  configured: boolean;
  version: 1 | 2 | null;
  tone: Tone;
  label: string;
}

/** One reading of the Sheets connection for the row chip and the summary card. */
export function sheetsStatus(data: HubData, features: FeatureFlags): SheetsStatus {
  const version = data.remoteVersion ?? features.sheets.version;
  const configured = features.sheets.configured || version !== null || data.source === "sheet";
  if (!configured) return { configured, version: null, tone: "neutral", label: "Not connected" };
  if (version === 2) return { configured, version, tone: "positive", label: "Connected, version 2" };
  if (version === 1) return { configured, version, tone: "warning", label: "Version 1, work logs only" };
  return { configured, version: null, tone: "negative", label: "Not reachable" };
}

const SETUP_STEPS = [
  <>
    In the workbook, open <b className="font-medium text-ink">Extensions, Apps Script</b>, and paste the script into Code.gs (use <b className="font-medium text-ink">Copy Apps Script</b> below).
  </>,
  <>
    In <b className="font-medium text-ink">Project Settings, Script properties</b>, add <Code>AXORAA_TOKEN</Code> with a long random value.
  </>,
  <>
    <b className="font-medium text-ink">Deploy, New deployment, Web app</b>. Execute as <b className="font-medium text-ink">Me</b>, access <b className="font-medium text-ink">Anyone</b>. Requests without the token are rejected.
  </>,
  <>
    On the server, set <Code>SHEETS_WEBAPP_URL</Code> (the /exec address) and <Code>SHEETS_API_TOKEN</Code> (the same token), then redeploy the hub.
  </>,
];

const UPDATE_STEPS = [
  <>Copy the version 2 script with <b className="font-medium text-ink">Copy Apps Script</b> below.</>,
  <>
    In the workbook, open <b className="font-medium text-ink">Extensions, Apps Script</b>, select everything in Code.gs and paste the new script over it. The token property stays as it is.
  </>,
  <>
    Open <b className="font-medium text-ink">Deploy, Manage deployments</b>, edit the web app, choose <b className="font-medium text-ink">New version</b> and deploy. The /exec address does not change.
  </>,
  <>Come back here and press <b className="font-medium text-ink">Pull now</b>. Every record in the hub is then shared through the sheet.</>,
];

export function SheetsPanel() {
  const { data, features, navigate, viewer } = useHub();
  const toast = useToast();
  const confirm = useConfirm();
  const now = useNow();
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const status = sheetsStatus(data, features);
  const busy = data.syncState.busy || uploading;
  const shared = status.version === 2;
  const lastSync = data.syncState.lastSyncedAt;
  const localOnly = data.localOnly;
  const unsynced = data.unsynced.length;

  const sharedRecords =
    data.deals.length + data.interactions.length + data.clients.length + data.projects.length + data.payments.length + data.posts.length + data.campaigns.length;

  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
      setCopied(true);
      toast({ message: "Copied the Apps Script", tone: "positive" });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ message: "Couldn't copy. Open the script below and copy it by hand.", tone: "negative" });
    }
  };

  const pull = async () => {
    const res = (await data.pullFromSheet()) as { workLogs?: { success?: boolean; message?: string }; shared?: boolean } | undefined;
    const failed = res?.workLogs?.success === false || res?.shared === false;
    toast(
      failed
        ? { message: res?.workLogs?.message || "Couldn't reach Google Sheets. Showing what's saved on this device.", tone: "negative" }
        : { message: "Pulled the latest from Google Sheets", tone: "positive" }
    );
  };

  const pushLogs = async () => {
    const n = data.workLogs.length;
    const ok = await confirm({
      title: "Push work logs to the sheet?",
      body: `This overwrites the Daily Work Log tab with ${formatNumber(n)} ${n === 1 ? "row" : "rows"}.`,
      confirmLabel: "Overwrite the tab",
      tone: "danger",
    });
    if (!ok) return;
    const res = (await data.pushAll()) as { success?: boolean; message?: string } | undefined;
    toast(
      res?.success === false
        ? { message: res.message || "Couldn't write to Google Sheets", tone: "negative" }
        : { message: `Wrote ${formatNumber(n)} work log ${n === 1 ? "row" : "rows"} to the sheet`, tone: "positive" }
    );
  };

  const upload = async () => {
    const entries = Object.entries(localOnly.byEntity).filter(([, n]) => (n ?? 0) > 0) as [RemoteEntity, number][];
    const ok = await confirm({
      title: "Upload this device's records?",
      body: (
        <div className="space-y-3">
          <p>These records are only in this browser. Uploading adds them to Google Sheets so the whole team sees them.</p>
          <ul className="flex flex-wrap gap-1.5">
            {entries.map(([e, n]) => (
              <li key={e} className="chip">
                {countLabel(e, n)}
              </li>
            ))}
          </ul>
          {localOnly.excludedDemo > 0 && (
            <p className="text-[13px] text-ink-3">
              {formatNumber(localOnly.excludedDemo)} demo {localOnly.excludedDemo === 1 ? "record is" : "records are"} left out.
            </p>
          )}
        </div>
      ),
      confirmLabel: `Upload ${formatNumber(localOnly.total)}`,
    });
    if (!ok) return;
    setUploading(true);
    try {
      const r = await data.pushLocalToShared();
      const parts = [`Uploaded ${formatNumber(r.pushed)} ${r.pushed === 1 ? "record" : "records"}`];
      if (r.skipped) parts.push(`${formatNumber(r.skipped)} already shared or not yours`);
      if (r.failed) parts.push(`${formatNumber(r.failed)} failed`);
      toast({ message: parts.join(", "), tone: r.failed ? "negative" : "positive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Status */}
      {!status.configured && (
        <Notice tone="warning" icon={<Database />}>
          <p className="font-medium">Not connected</p>
          <p className="mt-0.5 text-ink-2">Records are saved in each person&apos;s browser. Connect a Google Sheet so the team works from the same data.</p>
        </Notice>
      )}
      {status.configured && status.version === null && (
        <Notice
          tone="negative"
          icon={<RefreshCw />}
          action={
            <button type="button" className="btn btn-ink btn-sm" disabled={busy} onClick={pull}>
              Try again
            </button>
          }
        >
          Couldn&apos;t reach the Apps Script. Showing what&apos;s saved on this device.
        </Notice>
      )}
      {status.version === 1 && (
        <Notice tone="warning" icon={<AlertTriangle />}>
          <p className="font-medium">Connected with script version 1. Only work logs are shared.</p>
          <p className="mt-0.5 text-ink-2">Deals, visits, clients, invoices, content and settings stay on each device until the script is updated.</p>
        </Notice>
      )}
      {shared && (
        <Notice tone="positive" icon={<Check />}>
          <p className="font-medium">Connected with script version 2</p>
          <p className="mt-0.5 text-ink-2">Every record in the hub is shared through the sheet. Sequence numbers are issued by the script.</p>
        </Notice>
      )}

      {/* Figures */}
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="card-inset px-4 py-3">
          <dt className="text-[12px] text-ink-3">Last sync</dt>
          <dd className="mt-1 truncate text-[15px] font-medium">{lastSync ? relativeTime(lastSync, now) : "Not yet"}</dd>
        </div>
        <div className="card-inset px-4 py-3">
          <dt className="text-[12px] text-ink-3">Work log rows</dt>
          <dd className="num mt-1 text-[26px]">{formatNumber(data.workLogs.length)}</dd>
        </div>
        <div className="card-inset px-4 py-3">
          <dt className="text-[12px] text-ink-3">{shared ? "Shared records" : "Records here"}</dt>
          <dd className="num mt-1 text-[26px]">{formatNumber(sharedRecords)}</dd>
        </div>
        <div className="card-inset px-4 py-3">
          <dt className="text-[12px] text-ink-3">Not saved yet</dt>
          <dd className={`num mt-1 text-[26px] ${unsynced ? "text-negative" : ""}`}>{formatNumber(unsynced)}</dd>
        </div>
      </dl>

      {unsynced > 0 && (
        <Notice
          tone="negative"
          icon={<UploadCloud />}
          action={
            <button type="button" className="btn btn-ink btn-sm" disabled={busy} onClick={() => void data.retrySync()}>
              Retry now
            </button>
          }
        >
          {formatNumber(unsynced)} {unsynced === 1 ? "change is" : "changes are"} saved on this device but not in Google Sheets yet.
        </Notice>
      )}

      {shared && localOnly.total > 0 && (
        <Notice
          icon={<Upload />}
          action={
            <>
              <button type="button" className="btn btn-lime btn-sm" disabled={busy} onClick={upload}>
                <Upload aria-hidden /> Upload this device&apos;s records
              </button>
              <button type="button" className="btn btn-plain btn-sm" onClick={() => data.dismissLocalOnly()}>
                Not now
              </button>
            </>
          }
        >
          This browser has {formatNumber(localOnly.total)} {localOnly.total === 1 ? "record" : "records"} from before sharing was turned on.
          {localOnly.excludedDemo > 0 ? ` Demo data (${formatNumber(localOnly.excludedDemo)}) is left out.` : ""}
        </Notice>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ink" disabled={!status.configured || busy} onClick={pull}>
          <RefreshCw aria-hidden className={data.syncState.busy ? "animate-spin" : ""} /> Pull now
        </button>
        {viewer.privileged && data.source === "sheet" && (
          <button type="button" className="btn btn-ghost" disabled={busy || data.workLogs.length === 0} onClick={pushLogs}>
            <Upload aria-hidden /> Push work logs to the sheet
          </button>
        )}
        {shared && localOnly.total === 0 && (
          <button type="button" className="btn btn-ghost" disabled title="Nothing on this device is waiting to be shared">
            <Upload aria-hidden /> Upload this device&apos;s records
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={copyScript}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />} Copy Apps Script
        </button>
        <button type="button" className="btn btn-plain" onClick={() => navigate("exports")}>
          CSV and backups <ArrowUpRight aria-hidden />
        </button>
      </div>
      {data.syncState.message && (
        <p role="status" className={`text-[12.5px] ${data.syncState.error ? "text-negative" : "text-ink-3"}`}>
          {data.syncState.message}
        </p>
      )}

      {/* Steps */}
      {status.version !== 2 && (
        <div>
          <h4 className="mb-3 text-[14px] font-medium text-ink">{status.version === 1 ? "Update the script to version 2" : "Connect a Google Sheet"}</h4>
          <SetupSteps label={status.version === 1 ? "Update steps" : "Setup steps"} steps={status.version === 1 ? UPDATE_STEPS : SETUP_STEPS} />
        </div>
      )}

      <details className="group">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full px-1 text-[13px] font-medium text-ink-2 hover:text-ink">
          <span className="transition-transform group-open:rotate-90" aria-hidden>
            ›
          </span>
          Show the Apps Script
        </summary>
        <pre className="mt-3 max-h-72 overflow-auto rounded-[20px] bg-ink-panel p-5 font-mono text-[11.5px] leading-relaxed text-on-ink-panel/80">
          {GOOGLE_APPS_SCRIPT_TEMPLATE}
        </pre>
      </details>
    </div>
  );
}
