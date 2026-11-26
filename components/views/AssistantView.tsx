"use client";

import React from "react";
import { CalendarRange, FileText, Globe, Megaphone, MessageSquareText, NotebookPen, PenLine, Plug, ReceiptIndianRupee, TimerReset } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { agentRoleOf, agentsFor, AGENT_BY_KEY, type AgentCatalogEntry } from "@/lib/agents/catalog";
import { estimateCostInr, monthUsage } from "@/lib/agents/cost";
import type { AgentKey, AgentRef } from "@/lib/agents/types";
import { COMPANY_EMAIL, supportMailto } from "@/lib/company";
import { formatInr, todayKeyIST } from "@/lib/format";
import { useHub } from "@/lib/hub/context";
import { PREF, useLocalPref, useNow } from "@/lib/prefs";
import { AgentForm, parseRefParam, useRefRecord } from "@/components/studio/AgentForm";
import { AgentRunner, useAgentRun } from "@/components/studio/AgentRunner";
import { DraftHistory } from "@/components/studio/DraftHistory";
import { EmptyState, Segmented, Toolbar } from "@/components/ui/primitives";

const AGENT_ICON: Record<AgentKey, LucideIcon> = {
  follow_up: MessageSquareText,
  visit_notes: NotebookPen,
  prospect_brief: Globe,
  proposal_outline: FileText,
  social_posts: CalendarRange,
  meta_campaign: Megaphone,
  pipeline_review: TimerReset,
  payment_reminder: ReceiptIndianRupee,
};

/** Amber inset card shown wherever the assistant would run without an API key on the server. */
export function AssistantNotConfigured() {
  const { viewer, navigate } = useHub();
  const admin = viewer.privileged;
  return (
    <div className="rounded-inset bg-amber-soft p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber text-ink">
          <Plug className="size-4" />
        </span>
        <p className="min-w-0 text-[13.5px] text-ink">
          {admin ? (
            <>The assistant needs an API key on the server. Add ANTHROPIC_API_KEY to the server&apos;s environment and redeploy; drafts already saved stay in History.</>
          ) : (
            <>
              The assistant needs an API key on the server. Ask the administrator or write to{" "}
              <a href={supportMailto({ subject: "Assistant setup" })} className="font-medium underline underline-offset-2">
                {COMPANY_EMAIL}
              </a>
              .
            </>
          )}
        </p>
      </div>
      {admin && (
        <button type="button" className="btn btn-ghost btn-sm mt-4" onClick={() => navigate("integrations")}>
          Open integrations
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ the run panel for one agent */

function AgentPanel({ entry, refParam }: { entry: AgentCatalogEntry; refParam: string | null }) {
  const { features } = useHub();
  const run = useAgentRun(entry.key);
  const parsed = parseRefParam(refParam);
  const usable: AgentRef | undefined = parsed && entry.refTypes.includes(parsed.type) ? parsed : undefined;
  const record = useRefRecord(usable);
  const unavailable = !!refParam && (!usable || !record);
  const Icon = AGENT_ICON[entry.key];

  return (
    <div className="min-w-0 space-y-3 sm:space-y-4">
      <section className="card min-w-0 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink">
            <Icon className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-medium leading-tight tracking-[-0.02em] text-ink">{entry.name}</h2>
            <p className="mt-1 text-[13px] text-ink-3">{entry.description}</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {entry.usesWebSearch && <span className="chip chip-outline">Web search</span>}
              {entry.supportsLanguage && <span className="chip chip-outline">English, Kannada, Hindi</span>}
              {record && usable && <span className="chip chip-ink max-w-full truncate">{record.name}</span>}
            </div>
          </div>
        </div>

        {unavailable && (
          <p role="status" className="mt-4 rounded-inset bg-amber-soft px-4 py-3 text-[13.5px] text-ink">
            That record isn&apos;t available to you.{entry.refRequired ? " Pick another below." : ""}
          </p>
        )}

        <div className="mt-5">
          {features.assistant.configured ? (
            <AgentForm entry={entry} initialRef={unavailable ? undefined : usable} running={run.running} onRun={run.start} onStop={run.stop} />
          ) : (
            <AssistantNotConfigured />
          )}
        </div>
      </section>
      {features.assistant.configured && <AgentRunner run={run} />}
    </div>
  );
}

/* ------------------------------------------------------------------ view */

function suggestedAgent(agents: AgentCatalogEntry[], overdue: number, unpaid: number): AgentKey | null {
  const has = (k: AgentKey) => agents.some((a) => a.key === k);
  if (overdue >= 3 && has("pipeline_review")) return "pipeline_review";
  if (unpaid > 0 && has("payment_reminder")) return "payment_reminder";
  if (has("follow_up")) return "follow_up";
  return agents[0]?.key ?? null;
}

export function AssistantView() {
  const { data, viewer, params, setParams } = useHub();
  const now = useNow();
  const role = agentRoleOf(viewer.category);
  const agents = agentsFor(role, data.settings.disabledAgents);
  const keys = agents.map((a) => a.key);
  const [last, setLast] = useLocalPref<string>(PREF.assistantLast(viewer.accountId), "");

  const tab = params.get("tab") === "history" ? "history" : "run";
  const requested = params.get("agent");
  const activeKey: AgentKey | undefined =
    requested && keys.includes(requested as AgentKey) ? (requested as AgentKey) : last && keys.includes(last as AgentKey) ? (last as AgentKey) : keys[0];
  const active = activeKey ? AGENT_BY_KEY[activeKey] : undefined;
  const refParam = requested === activeKey ? params.get("ref") : null;

  const todayKey = now ? todayKeyIST(now) : "";
  const overdue = todayKey ? data.deals.filter((d) => d.dueStatus === "Overdue").length : 0;
  const unpaid = data.payments.filter((p) => p.status === "Overdue").length;
  const suggested = suggestedAgent(agents, overdue, unpaid);
  const usage = todayKey ? monthUsage(data.drafts, todayKey) : null;
  const cost = usage && viewer.privileged ? estimateCostInr(usage, data.settings.assistantPricing) : null;

  const pick = (k: AgentKey) => {
    setLast(k);
    setParams({ agent: k, ref: null });
  };

  if (!role) {
    return (
      <div className="card">
        <EmptyState icon={<PenLine />} title="The assistant isn't part of your workspace" body="Ask the administrator if you need drafts written for you." />
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-5">
      <Toolbar className="justify-between">
        <Segmented
          label="Assistant section"
          value={tab}
          onChange={(v) => setParams({ tab: v === "history" ? "history" : null })}
          options={[
            { value: "run", label: "Run" },
            { value: "history", label: `History${data.drafts.length ? ` (${data.drafts.length})` : ""}` },
          ]}
        />
        {usage && (
          <span className="px-1 text-[12.5px] tabular-nums text-ink-3">
            {usage.runs === 0 ? "No runs this month yet" : `${usage.runs} ${usage.runs === 1 ? "run" : "runs"} this month`}
            {cost !== null && usage.runs > 0 ? `, about ${formatInr(cost)}` : ""}
          </span>
        )}
      </Toolbar>

      {tab === "history" ? (
        <DraftHistory onRunAgent={() => setParams({ tab: null })} />
      ) : agents.length === 0 || !active ? (
        <div className="card">
          <EmptyState icon={<PenLine />} title="Every assistant task is switched off" body="The administrator can switch them back on in Settings." />
        </div>
      ) : (
        <div className="grid min-w-0 gap-3 sm:gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-5">
          <nav aria-label="Assistant tasks" className="min-w-0">
            <ul className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
              {agents.map((a) => {
                const on = a.key === activeKey;
                const Icon = AGENT_ICON[a.key];
                const isSuggested = a.key === suggested && !on;
                return (
                  <li key={a.key} className="w-[220px] shrink-0 snap-start lg:w-auto">
                    <button
                      type="button"
                      aria-current={on ? "page" : undefined}
                      onClick={() => pick(a.key)}
                      className={`card-interactive flex h-full w-full flex-col gap-2 rounded-[22px] p-4 text-left transition-colors ${
                        on ? "bg-accent text-on-accent" : isSuggested ? "bg-lime text-on-lime" : "bg-surface text-ink shadow-[var(--shadow-card)] hover:bg-surface"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span
                          aria-hidden
                          className={`flex size-8 items-center justify-center rounded-full ${on ? "bg-white/10 dark:bg-black/10" : isSuggested ? "bg-on-lime/10" : "bg-surface-2"}`}
                        >
                          <Icon className="size-4" />
                        </span>
                        {isSuggested && <span className="rounded-full bg-on-lime/10 px-2 py-0.5 text-[11px] font-medium">Suggested</span>}
                      </span>
                      <span className="text-[14px] font-medium leading-tight tracking-[-0.01em]">{a.name}</span>
                      <span className={`line-clamp-2 text-[12px] leading-snug ${on ? "opacity-70" : isSuggested ? "text-on-lime/70" : "text-ink-3"}`}>{a.description}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          <AgentPanel key={`${active.key}:${refParam ?? ""}`} entry={active} refParam={refParam} />
        </div>
      )}
    </div>
  );
}

