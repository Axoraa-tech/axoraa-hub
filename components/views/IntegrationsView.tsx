"use client";

import React, { useState } from "react";
import { ArrowUpRight, AtSign, Bot, Database, Plug, RefreshCw } from "lucide-react";
import { useHub } from "@/lib/hub/context";
import { useNow } from "@/lib/prefs";
import { clientFacingEmail } from "@/lib/company";
import { estimateCostInr, monthUsage } from "@/lib/agents/cost";
import { formatInrFull, formatNumber, relativeTime, todayKeyIST } from "@/lib/format";
import { CardHeader, EmptyState } from "@/components/ui/primitives";
import { ChannelMark } from "@/components/ui/ChannelMark";
import { IntegrationRow, Code, Notice } from "@/components/settings/IntegrationRow";
import { SheetsPanel, sheetsStatus } from "@/components/settings/SheetsPanel";
import { MetaPanel, metaSummary, useIntegrationStatus } from "@/components/settings/MetaPanel";

type RowId = "sheets" | "assistant" | "meta";

export function IntegrationsView() {
  const { data, features, viewer, params, navigate } = useHub();
  const now = useNow();
  const { load, checking, check, reload } = useIntegrationStatus();
  const [open, setOpen] = useState<Record<RowId, boolean>>(() => {
    const s = params.get("section");
    return { sheets: s === "sheets", assistant: s === "assistant", meta: s === "meta" };
  });

  if (!viewer.privileged) {
    return (
      <div className="card">
        <EmptyState icon={<Plug />} title="Only the administrator can manage integrations" body="Ask the administrator if something needs connecting." />
      </div>
    );
  }

  const toggle = (id: RowId) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const reveal = (id: RowId) => {
    setOpen((o) => ({ ...o, [id]: true }));
    window.requestAnimationFrame(() => document.getElementById(`integration-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const status = load.kind === "ready" ? load.status : null;
  const sheets = sheetsStatus(data, features);
  const assistantConfigured = status ? status.assistant.configured : features.assistant.configured;
  const model = status?.assistant.model ?? features.assistant.model;
  const meta = metaSummary(status);
  const inbox = clientFacingEmail(data.settings.company);

  const todayKey = now ? todayKeyIST(now) : null;
  const usage = todayKey ? monthUsage(data.drafts, todayKey) : null;
  const cost = usage ? estimateCostInr(usage, data.settings.assistantPricing) : 0;

  const connections: { id: RowId | "inbox"; name: string; on: boolean; label: string }[] = [
    { id: "sheets", name: "Google Sheets", on: sheets.version === 2, label: sheets.label },
    { id: "assistant", name: "Assistant", on: assistantConfigured, label: assistantConfigured ? "Connected" : "Not configured" },
    { id: "meta", name: "Meta", on: meta.tone === "positive", label: meta.label },
    { id: "inbox", name: "Shared inbox", on: true, label: inbox },
  ];
  const onCount = connections.filter((c) => c.on).length;

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-5">
      {/* Bento summary */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:gap-5 xl:grid-cols-12">
        <section className="card-ink flex min-h-[176px] animate-rise flex-col justify-between p-5 sm:p-6 xl:col-span-5" aria-labelledby="int-storage">
          <div className="flex items-center justify-between gap-3">
            <h3 id="int-storage" className="text-[13px] font-normal text-white/55">
              Shared storage
            </h3>
            <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lime">
              <Database className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-4">
            <div className="flex items-end gap-2">
              <span className="num text-[44px] sm:text-[52px]">{sheets.version === 2 ? "Shared" : sheets.version === 1 ? "Logs only" : "This device"}</span>
            </div>
            <p className="mt-2 text-[12.5px] text-white/55">
              {sheets.version === 2
                ? `Google Sheets, script version 2. Last sync ${data.syncState.lastSyncedAt ? relativeTime(data.syncState.lastSyncedAt, now) : "not yet"}.`
                : sheets.version === 1
                ? "Work logs go to Google Sheets. Everything else stays in each browser."
                : sheets.configured
                ? "The Apps Script did not answer. Records are saved in this browser for now."
                : "Records are saved in each browser until a Google Sheet is connected."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn btn-lime btn-sm" onClick={() => reveal("sheets")}>
                {sheets.version === 2 ? "Manage" : "Set up"} Google Sheets
              </button>
              {sheets.configured && (
                <button
                  type="button"
                  className="btn btn-sm bg-white/10 text-white hover:bg-white/20"
                  disabled={data.syncState.busy}
                  onClick={() => void data.pullFromSheet()}
                >
                  <RefreshCw aria-hidden className={data.syncState.busy ? "animate-spin" : ""} /> Pull now
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="card min-w-0 animate-rise p-5 sm:p-6 xl:col-span-7" style={{ animationDelay: "60ms" }}>
          <CardHeader icon={<Plug />} title="Connections" subtitle="What the hub can reach from the server" />
          <div className="mt-5 flex items-end gap-2">
            <span className="num text-[44px]">{onCount}</span>
            <span className="mb-1 text-[14px] text-ink-3">of {connections.length} working</span>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {connections.map((c) => (
              <li key={c.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => (c.id === "inbox" ? navigate("settings", { section: "company" }) : reveal(c.id))}
                  className="group flex w-full min-w-0 flex-col gap-2 rounded-[18px] text-left focus-visible:outline-offset-4"
                >
                  <span aria-hidden className={`block h-10 w-full rounded-full transition-transform group-hover:-translate-y-px ${c.on ? "bg-lime" : "hatch"}`} />
                  <span className="truncate text-[13px] font-medium text-ink">{c.name}</span>
                  <span className="-mt-1.5 truncate text-[12px] text-ink-3" title={c.label}>
                    {c.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Rows */}
      <div className="space-y-3 sm:space-y-4">
        <IntegrationRow
          id="sheets"
          icon={<Database />}
          name="Google Sheets"
          purpose="The shared database: work logs, deals, visits, clients, invoices, content and settings."
          status={{ tone: sheets.tone, label: sheets.label }}
          actionLabel={open.sheets ? "Close" : sheets.configured ? "Manage" : "Set up"}
          open={open.sheets}
          onToggle={() => toggle("sheets")}
        >
          <SheetsPanel />
        </IntegrationRow>

        <IntegrationRow
          id="assistant"
          icon={<Bot />}
          name="Claude assistant"
          purpose="Drafts follow-ups, visit notes, proposals, posts and briefs for the team to review."
          status={load.kind === "loading" && !features.assistant.configured ? null : { tone: assistantConfigured ? "positive" : "neutral", label: assistantConfigured ? "Connected" : "Not configured" }}
          actionLabel={open.assistant ? "Close" : assistantConfigured ? "Manage" : "Set up"}
          open={open.assistant}
          onToggle={() => toggle("assistant")}
        >
          <div className="space-y-4">
            {!assistantConfigured && (
              <Notice tone="warning" icon={<Bot />}>
                The assistant needs <Code>ANTHROPIC_API_KEY</Code> on the server. Add it and redeploy; the Assistant page shows a plain notice until then.
              </Notice>
            )}
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="card-inset px-4 py-3">
                <dt className="text-[12px] text-ink-3">Model</dt>
                <dd className="mt-1 truncate font-mono text-[13px] text-ink">{model}</dd>
              </div>
              <div className="card-inset px-4 py-3">
                <dt className="text-[12px] text-ink-3">Runs this month</dt>
                <dd className="num mt-1 text-[26px]">{usage ? formatNumber(usage.runs) : "–"}</dd>
              </div>
              <div className="card-inset px-4 py-3">
                <dt className="text-[12px] text-ink-3">About</dt>
                <dd className="num mt-1 text-[26px]">{usage ? formatInrFull(cost) : "–"}</dd>
              </div>
            </dl>
            <p className="text-[13px] text-ink-2">
              Each person can run the assistant up to 30 times an hour by default (<Code>AGENTS_RATE_LIMIT_PER_HOUR</Code>). Web search charges are not included in the estimate.
            </p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate("settings", { section: "assistant" })}>
              Assistant settings <ArrowUpRight aria-hidden />
            </button>
          </div>
        </IntegrationRow>

        <IntegrationRow
          id="meta"
          icon={<ChannelMark channel="facebook" size={18} />}
          name="Meta"
          purpose="Facebook Page posts, Instagram, Lead Ads and ads reporting."
          status={load.kind === "loading" ? null : load.kind === "error" ? { tone: "negative", label: "Status unavailable" } : meta}
          actionLabel={open.meta ? "Close" : meta.tone === "neutral" ? "Set up" : "Manage"}
          open={open.meta}
          onToggle={() => toggle("meta")}
        >
          <MetaPanel load={load} checking={checking} onCheck={check} onReload={reload} />
        </IntegrationRow>

        <IntegrationRow
          id="linkedin"
          icon={<ChannelMark channel="linkedin" size={18} />}
          name="LinkedIn"
          purpose="Company page posts. Plan them in the content calendar and share them from LinkedIn."
          note="Not available yet"
        />

        <IntegrationRow
          id="inbox"
          icon={<AtSign />}
          name="Shared inbox"
          purpose={
            <>
              <span className="font-medium text-ink">{inbox}</span>
              <span className="block">Used for client email cc, invoices, quotations and assistant signatures.</span>
            </>
          }
          note={
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate("settings", { section: "company" })}>
              Change in Settings <ArrowUpRight aria-hidden />
            </button>
          }
        />
      </div>
    </div>
  );
}

