"use client";

import React, { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { AlertTriangle, BarChart3, Check, Copy, Inbox, Megaphone, RefreshCw, Webhook } from "lucide-react";
import type { IntegrationStatus, IntegrationsStatusResponse } from "@/lib/integrations/types";
import { useHub } from "@/lib/hub/context";
import { formatNumber } from "@/lib/format";
import { ChannelMark } from "@/components/ui/ChannelMark";
import { useToast } from "@/components/ui/feedback";
import { StatusDot, type Tone } from "@/components/ui/Status";
import { Code, Notice, SetupSteps } from "./IntegrationRow";

/* ------------------------------------------------------------------ status loading */

export type StatusLoad =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; status: IntegrationsStatusResponse; checkedLive: boolean };

async function fetchStatus(check: boolean): Promise<StatusLoad> {
  try {
    const res = await fetch(`/api/integrations/status${check ? "?check=1" : ""}`, { cache: "no-store" });
    if (!res.ok) {
      return { kind: "error", message: res.status === 401 ? "Your session has ended. Sign in again." : "Couldn't load the connection status." };
    }
    return { kind: "ready", status: (await res.json()) as IntegrationsStatusResponse, checkedLive: check };
  } catch {
    return { kind: "error", message: "Couldn't reach the server." };
  }
}

/** Loads /api/integrations/status once on mount; reload() and check() refresh it (check asks Meta live). */
export function useIntegrationStatus() {
  const [load, setLoad] = useState<StatusLoad>({ kind: "loading" });
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchStatus(false).then((r) => {
      if (alive) setLoad(r);
    });
    return () => {
      alive = false;
    };
  }, []);

  const refresh = useCallback(async (check: boolean) => {
    if (check) setChecking(true);
    else setLoad({ kind: "loading" });
    const r = await fetchStatus(check);
    setLoad(r);
    setChecking(false);
    return r;
  }, []);

  return { load, checking, reload: () => refresh(false), check: () => refresh(true) };
}

/* ------------------------------------------------------------------ helpers */

export function metaSummary(status: IntegrationsStatusResponse | null): { tone: Tone; label: string } {
  if (!status) return { tone: "neutral", label: "Checking" };
  const page = status.meta.page;
  if (page.state === "connected") return { tone: "positive", label: page.account.name ? page.account.name : "Connected" };
  if (page.state === "error") return { tone: "negative", label: "Connection error" };
  return { tone: "neutral", label: "Not connected" };
}

function statusChip(s: IntegrationStatus, fallbackName: string): { tone: Tone; label: string } {
  if (s.state === "connected") return { tone: "positive", label: s.account.name || fallbackName };
  if (s.state === "error") return { tone: "negative", label: s.code === 190 ? "Token rejected" : "Error" };
  return { tone: "neutral", label: "Not connected" };
}

const noopSubscribe = () => () => {};
function useOrigin(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => ""
  );
}

/* ------------------------------------------------------------------ panel */

export function MetaPanel({
  load,
  checking,
  onCheck,
  onReload,
}: {
  load: StatusLoad;
  checking: boolean;
  onCheck: () => Promise<StatusLoad>;
  onReload: () => Promise<StatusLoad>;
}) {
  const { data, viewer } = useHub();
  const toast = useToast();
  const origin = useOrigin();
  const [copied, setCopied] = useState(false);
  const [fetchingLeads, setFetchingLeads] = useState(false);

  if (load.kind === "loading") {
    return (
      <div role="status" aria-live="polite" className="space-y-2">
        <span className="sr-only">Loading the Meta status</span>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} aria-hidden className="skeleton block h-14 w-full rounded-[18px]" />
        ))}
      </div>
    );
  }

  if (load.kind === "error") {
    return (
      <Notice
        tone="negative"
        icon={<RefreshCw />}
        action={
          <button type="button" className="btn btn-ink btn-sm" onClick={() => void onReload()}>
            Try again
          </button>
        }
      >
        {load.message}
      </Notice>
    );
  }

  const { status } = load;
  const meta = status.meta;
  const configured = meta.page.state !== "not_configured";
  const missing = [
    ...new Set(
      [meta.page, meta.leads, meta.instagram, meta.ads].flatMap((s) => (s.state === "not_configured" ? s.missing : []))
    ),
  ];
  const baseMissing = meta.page.state === "not_configured" ? meta.page.missing : [];
  const shownMissing = configured ? missing.filter((m) => !baseMissing.includes(m)) : missing;
  const webhookUrl = `${origin}${meta.webhookPath}`;
  const days = meta.tokenDaysLeft;

  const copyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${meta.webhookPath}`);
      setCopied(true);
      toast({ message: "Copied the webhook address", tone: "positive" });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ message: "Couldn't copy. Select the address and copy it by hand.", tone: "negative" });
    }
  };

  const check = async () => {
    const r = await onCheck();
    if (r.kind !== "ready") toast({ message: "Couldn't check the connection", tone: "negative" });
    else if (r.status.meta.page.state === "connected") toast({ message: `Connected to ${r.status.meta.page.account.name || "the Facebook Page"}`, tone: "positive" });
    else if (r.status.meta.page.state === "error") toast({ message: r.status.meta.page.message, tone: "negative" });
  };

  const backfill = async () => {
    setFetchingLeads(true);
    try {
      const res = await fetch("/api/integrations/meta/leads/backfill", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const body = (await res.json().catch(() => ({}))) as { fetched?: number; created?: number; skipped?: number; failed?: number; forms?: number; error?: string; message?: string };
      if (!res.ok) {
        toast({ message: body.message || body.error || "Couldn't fetch missed leads", tone: "negative" });
        return;
      }
      if (!body.forms) {
        toast({ message: "No lead forms are listed. Add their ids to META_LEADGEN_FORM_IDS." });
        return;
      }
      const created = body.created ?? 0;
      toast({
        message: `Fetched ${formatNumber(body.fetched ?? 0)} leads: ${formatNumber(created)} new, ${formatNumber(body.skipped ?? 0)} already in Deals${body.failed ? `, ${formatNumber(body.failed)} failed` : ""}`,
        tone: body.failed ? "negative" : "positive",
      });
      if (created > 0) void data.pullFromSheet();
    } catch {
      toast({ message: "Couldn't reach the server", tone: "negative" });
    } finally {
      setFetchingLeads(false);
    }
  };

  const rows: { key: string; icon: React.ReactNode; name: string; purpose: string; status: IntegrationStatus; fallback: string; note?: string }[] = [
    {
      key: "page",
      icon: <ChannelMark channel="facebook" size={18} />,
      name: "Facebook Page",
      purpose: "Publish and schedule posts from the content calendar.",
      status: meta.page,
      fallback: "Set up, not checked yet",
    },
    {
      key: "instagram",
      icon: <ChannelMark channel="instagram" size={18} />,
      name: "Instagram",
      purpose: "The professional account linked to the Page.",
      status: meta.instagram,
      fallback: "Linked",
      note: "Publishing and reporting from the hub are not built yet.",
    },
    {
      key: "leads",
      icon: <Inbox />,
      name: "Lead Ads",
      purpose: "New leads from Meta forms land in Deals as New Lead.",
      status: meta.leads,
      fallback: "Webhook ready",
    },
    {
      key: "ads",
      icon: <BarChart3 />,
      name: "Ads reporting",
      purpose: "Spend and results per campaign.",
      status: meta.ads,
      fallback: "Ad account set",
      note: "Publishing and reporting from the hub are not built yet.",
    },
  ];

  return (
    <div className="space-y-5">
      {days !== null && days <= 10 && (
        <Notice tone={days <= 3 ? "negative" : "warning"} icon={<AlertTriangle />}>
          <p className="font-medium">
            {days < 0 ? "The Meta token has expired." : days === 0 ? "The Meta token expires today." : `The Meta token expires in ${days} ${days === 1 ? "day" : "days"}.`}
          </p>
          <p className="mt-0.5 text-ink-2">
            Create a new system-user token in Business Settings, then update <Code>META_SYSTEM_USER_TOKEN</Code> and <Code>META_SYSTEM_USER_TOKEN_EXPIRES_AT</Code>.
          </p>
        </Notice>
      )}

      {meta.page.state === "error" && (
        <Notice tone="negative" icon={<RefreshCw />}>
          {meta.page.message}
        </Notice>
      )}

      {/* Sub-rows */}
      <ul className="card-inset divide-y divide-line overflow-hidden p-0">
        {rows.map((r) => {
          const chip = statusChip(r.status, r.fallback);
          return (
            <li key={r.key} className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-ink [&>svg]:h-4 [&>svg]:w-4">
                  {r.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-ink">{r.name}</p>
                  <p className="text-[12.5px] text-ink-3">{r.purpose}</p>
                  {r.note && <p className="mt-0.5 text-[12px] text-ink-3">{r.note}</p>}
                </div>
              </div>
              <div className="pl-12 sm:pl-0">
                <StatusDot tone={chip.tone} label={chip.label} />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Lead Ads needs shared storage */}
      {status.sheets.version !== 2 && (
        <Notice tone="warning" icon={<Inbox />}>
          Lead Ads need shared Google Sheets first. Update the Apps Script to version 2, then Meta leads are stored in Deals for the whole team.
        </Notice>
      )}

      {/* Missing variables */}
      {viewer.privileged && shownMissing.length > 0 && (
        <div>
          <h4 className="text-[14px] font-medium text-ink">{configured ? "Optional settings not set" : "Add these to the server environment"}</h4>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {shownMissing.map((m) => (
              <li key={m}>
                <Code>{m}</Code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Webhook */}
      <div className="card-inset p-4">
        <div className="flex items-center gap-2 text-[12px] text-ink-3">
          <Webhook aria-hidden className="h-3.5 w-3.5" /> Webhook address for Lead Ads
        </div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 break-all rounded-[14px] bg-surface px-3 py-2.5 font-mono text-[12.5px] text-ink">{webhookUrl}</code>
          <button type="button" className="btn btn-ghost btn-sm shrink-0" onClick={copyWebhook}>
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="mt-2 text-[12px] text-ink-3">
          In the Meta app, subscribe the Page to the <Code>leadgen</Code> field with this address and the value of <Code>META_WEBHOOK_VERIFY_TOKEN</Code>.
        </p>
      </div>

      {/* Publishing */}
      <p className="flex items-start gap-2 text-[13px] text-ink-2">
        <Megaphone aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
        {meta.publishEnabled ? (
          "Publishing to the Facebook Page is on. Marketing can publish and schedule from the content calendar."
        ) : (
          <span>
            Publishing is off. Set <Code>META_PUBLISH_ENABLED</Code> to <Code>true</Code> to turn it on.
          </span>
        )}
      </p>

      {/* Setup */}
      {!configured && (
        <div>
          <h4 className="mb-3 text-[14px] font-medium text-ink">Connect Meta</h4>
          <SetupSteps
            label="Meta setup steps"
            steps={[
              <>In Meta for Developers, create a Business app and add the Page to your Business Portfolio.</>,
              <>
                Create a system user with access to the Page and generate a token with <Code>pages_manage_posts</Code>, <Code>pages_read_engagement</Code> and{" "}
                <Code>leads_retrieval</Code>.
              </>,
              <>
                Set <Code>META_APP_ID</Code>, <Code>META_APP_SECRET</Code>, <Code>META_PAGE_ID</Code>, <Code>META_SYSTEM_USER_TOKEN</Code> and its expiry date on the server, then
                redeploy.
              </>,
              <>
                For Lead Ads, also set <Code>META_WEBHOOK_VERIFY_TOKEN</Code> (32 or more random characters) and subscribe the webhook address above.
              </>,
            ]}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-ink" disabled={!configured || checking} onClick={check}>
          <RefreshCw aria-hidden className={checking ? "animate-spin" : ""} /> {checking ? "Checking" : "Check connection"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={!meta.leadsEnabled || fetchingLeads}
          onClick={backfill}
          title={meta.leadsEnabled ? undefined : "Needs Meta, the webhook token and shared Google Sheets"}
        >
          <Inbox aria-hidden /> {fetchingLeads ? "Fetching leads" : "Fetch missed leads (last 7 days)"}
        </button>
        {load.checkedLive && meta.page.state === "connected" && <span className="text-[12.5px] text-ink-3">Checked just now</span>}
      </div>
    </div>
  );
}
