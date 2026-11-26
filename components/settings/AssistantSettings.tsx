"use client";

import React, { useState } from "react";
import { Bot } from "lucide-react";
import { AGENT_CATALOG } from "@/lib/agents/catalog";
import type { AgentKey, AgentRole } from "@/lib/agents/types";
import { estimateCostInr, monthUsage } from "@/lib/agents/cost";
import { formatInrFull, formatNumber, todayKeyIST } from "@/lib/format";
import { useHub } from "@/lib/hub/context";
import { useNow } from "@/lib/prefs";
import { CardHeader } from "@/components/ui/primitives";
import { ErrorSummary, Field, Input, Switch } from "@/components/ui/form";
import { StatusDot } from "@/components/ui/Status";
import { SettingsFormFooter, sameJson, type SettingsFormProps } from "./CompanyProfileForm";
import { Code } from "./IntegrationRow";

const ROLE_LABEL: Record<AgentRole, string> = { admin: "Admin", founder: "Founders", marketing: "Marketing" };

interface Draft {
  disabledAgents: AgentKey[];
  input: string;
  output: string;
  usdToInr: string;
}

function positive(v: string, allowZero = true): boolean {
  if (v.trim() === "") return false;
  const n = Number(v);
  return Number.isFinite(n) && (allowZero ? n >= 0 : n > 0);
}

export function AssistantSettings({ settings, onSave, onDirtyChange, saving }: SettingsFormProps) {
  const { data, features } = useHub();
  const now = useNow();
  const [baseline, setBaseline] = useState<Draft>(() => ({
    disabledAgents: [...settings.disabledAgents].sort(),
    input: String(settings.assistantPricing.inputUsdPerMTok),
    output: String(settings.assistantPricing.outputUsdPerMTok),
    usdToInr: String(settings.assistantPricing.usdToInr),
  }));
  const [draft, setDraft] = useState<Draft>(baseline);
  const [submitted, setSubmitted] = useState(false);
  const dirty = !sameJson(draft, baseline);

  const update = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onDirtyChange(!sameJson(next, baseline));
  };

  const errors: { field: string; message: string }[] = [];
  if (!positive(draft.input)) errors.push({ field: "as-in", message: "Input price must be a number, 0 or more" });
  if (!positive(draft.output)) errors.push({ field: "as-out", message: "Output price must be a number, 0 or more" });
  if (!positive(draft.usdToInr, false)) errors.push({ field: "as-fx", message: "The rupee rate must be more than 0" });
  const errorFor = (f: string) => (submitted ? errors.find((e) => e.field === f)?.message : undefined);

  const todayKey = now ? todayKeyIST(now) : null;
  const usage = todayKey ? monthUsage(data.drafts, todayKey) : null;
  const pricing = {
    inputUsdPerMTok: positive(draft.input) ? Number(draft.input) : settings.assistantPricing.inputUsdPerMTok,
    outputUsdPerMTok: positive(draft.output) ? Number(draft.output) : settings.assistantPricing.outputUsdPerMTok,
    usdToInr: positive(draft.usdToInr, false) ? Number(draft.usdToInr) : settings.assistantPricing.usdToInr,
  };
  const cost = usage ? estimateCostInr(usage, pricing) : 0;
  const enabledCount = AGENT_CATALOG.length - draft.disabledAgents.length;

  const toggle = (key: AgentKey, on: boolean) => {
    const set = new Set(draft.disabledAgents);
    if (on) set.delete(key);
    else set.add(key);
    update({ disabledAgents: [...set].sort() });
  };

  return (
    <form
      noValidate
      className="card min-w-0 p-5 sm:p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setSubmitted(true);
        if (errors.length) return;
        const ok = await onSave({ disabledAgents: draft.disabledAgents, assistantPricing: pricing });
        if (ok) {
          setBaseline(draft);
          setSubmitted(false);
          onDirtyChange(false);
        }
      }}
    >
      <CardHeader
        icon={<Bot />}
        title="Assistant"
        subtitle="Which agents the team can run, and what they cost"
        action={<StatusDot tone={features.assistant.configured ? "positive" : "neutral"} label={features.assistant.configured ? "Connected" : "Not configured"} />}
      />

      {submitted && errors.length > 0 && (
        <div className="mt-5">
          <ErrorSummary errors={errors} />
        </div>
      )}

      {/* Usage */}
      <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="card-inset px-4 py-3">
          <div className="text-[12px] text-ink-3">Model</div>
          <div className="mt-1 truncate font-mono text-[13px] text-ink">{features.assistant.model}</div>
        </div>
        <div className="card-inset px-4 py-3">
          <div className="text-[12px] text-ink-3">Runs this month</div>
          <div className="num mt-1 text-[26px]">{usage ? formatNumber(usage.runs) : "–"}</div>
        </div>
        <div className="card-inset px-4 py-3">
          <div className="text-[12px] text-ink-3">Estimated cost</div>
          <div className="num mt-1 text-[26px]">{usage ? formatInrFull(cost) : "–"}</div>
        </div>
      </div>
      <p className="mt-3 text-[13px] text-ink-2" aria-live="polite">
        {usage
          ? `This month: ${formatNumber(usage.runs)} ${usage.runs === 1 ? "run" : "runs"}, about ${formatInrFull(cost)}. Web search charges are not included.`
          : "Counting this month's runs."}
      </p>
      {!features.assistant.configured && (
        <p className="mt-2 text-[12.5px] text-ink-3">
          The assistant stays off until <Code>ANTHROPIC_API_KEY</Code> is set on the server. You can still choose the agents now.
        </p>
      )}

      {/* Agents */}
      <section className="mt-6" aria-labelledby="as-agents">
        <div className="flex items-end justify-between gap-2">
          <h4 id="as-agents" className="text-[14px] font-medium text-ink">
            Agents
          </h4>
          <span className="text-[12.5px] text-ink-3">
            {enabledCount} of {AGENT_CATALOG.length} on
          </span>
        </div>
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {AGENT_CATALOG.map((a) => {
            const on = !draft.disabledAgents.includes(a.key);
            return (
              <li key={a.key} className={`rounded-[18px] p-4 transition-colors ${on ? "bg-surface-2" : "hatch"}`}>
                <Switch checked={on} onChange={(v) => toggle(a.key, v)} label={<span className="font-medium">{a.name}</span>} description={a.description} />
                <div className="mt-2.5 flex flex-wrap gap-1.5 pl-14">
                  {a.roles.map((r) => (
                    <span key={r} className="chip bg-surface">
                      {ROLE_LABEL[r]}
                    </span>
                  ))}
                  {a.usesWebSearch && <span className="chip chip-outline">Web search</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Pricing */}
      <section className="mt-6" aria-labelledby="as-pricing">
        <h4 id="as-pricing" className="text-[14px] font-medium text-ink">
          Pricing for the estimate
        </h4>
        <p className="mt-0.5 text-[12.5px] text-ink-3">Per million tokens, in US dollars, and the rate used to show rupees.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <Field label="Input, USD per million" htmlFor="as-in" error={errorFor("as-in")}>
            <Input id="as-in" type="number" inputMode="decimal" min={0} step={0.01} value={draft.input} onChange={(e) => update({ input: e.target.value })} className="tabular-nums" />
          </Field>
          <Field label="Output, USD per million" htmlFor="as-out" error={errorFor("as-out")}>
            <Input id="as-out" type="number" inputMode="decimal" min={0} step={0.01} value={draft.output} onChange={(e) => update({ output: e.target.value })} className="tabular-nums" />
          </Field>
          <Field label="Rupees per US dollar" htmlFor="as-fx" error={errorFor("as-fx")}>
            <Input id="as-fx" type="number" inputMode="decimal" min={0} step={0.01} value={draft.usdToInr} onChange={(e) => update({ usdToInr: e.target.value })} className="tabular-nums" />
          </Field>
        </div>
      </section>

      <SettingsFormFooter
        dirty={dirty}
        saving={saving}
        onReset={() => {
          setDraft(baseline);
          setSubmitted(false);
          onDirtyChange(false);
        }}
      />
    </form>
  );
}
