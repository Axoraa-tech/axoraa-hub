"use client";

import React from "react";
import { ChevronDown } from "lucide-react";
import { formatDateIST, formatInr, todayKeyIST } from "@/lib/format";
import { INDIAN_STATES } from "@/lib/gst";
import { useHub } from "@/lib/hub/context";
import { useNow } from "@/lib/prefs";
import type { InteractionType, LeadStageStatus, MarketingDeal } from "@/lib/types";
import { Checkbox, DateInput, ErrorSummary, Field, Input, MoneyInput, Select, Switch, Textarea } from "@/components/ui/form";
import { dueText } from "@/components/ui/Status";
import type { DealDraft, DealFormKey, FieldError } from "./dealActions";

const VISIT_TYPES: InteractionType[] = ["Intro Meeting", "Product Demo", "Follow-up", "Commercial Negotiation", "Technical Scoping", "Check-in"];
const QUICK_KEYS: DealFormKey[] = ["companyName", "contactPerson", "phoneNumber", "leadSource", "estimatedDealValue", "nextFollowUpDate"];

const GROUPS: { id: string; title: string; keys: DealFormKey[] }[] = [
  { id: "contact", title: "Contact", keys: ["contactPerson", "designation", "phoneNumber", "emailAddress", "isDecisionMaker", "decisionMakerDetails"] },
  { id: "company", title: "Company", keys: ["companyName", "industry", "officeAddress", "city", "stateRegion", "googleMapsLink"] },
  {
    id: "opportunity",
    title: "Opportunity",
    keys: ["leadSource", "campaignId", "clientRequirements", "solutionsPitched", "budgetSpecified", "estimatedDealValue", "demoRequired", "proposalSent", "proposalValue"],
  },
  { id: "followup", title: "Follow-up", keys: ["nextFollowUpDate", "followUpAction", "followUpPriority", "initialVisitDate", "visitType"] },
  { id: "notes", title: "Notes", keys: ["notesNextSteps"] },
];

const WIDE: DealFormKey[] = ["clientRequirements", "solutionsPitched", "officeAddress", "googleMapsLink", "decisionMakerDetails", "followUpAction", "notesNextSteps", "isDecisionMaker", "proposalSent"];

function withCurrent(list: readonly string[], current: string): string[] {
  return current && !list.includes(current) ? [...list, current] : [...list];
}

/**
 * Every editable deal field, grouped. Stage and owner live in the sheet header. Derived figures
 * (weighted value, last contact, due) are shown read-only as sentences.
 * `quick` (new deal on a phone) shows six fields and folds the rest into 'More details'.
 */
export function DealForm({
  draft,
  onChange,
  errors,
  isNew,
  quick,
  readOnly,
  deal,
  stage,
}: {
  draft: DealDraft;
  onChange: (patch: Partial<DealDraft>) => void;
  errors: FieldError[];
  isNew: boolean;
  quick: boolean;
  readOnly: boolean;
  deal?: MarketingDeal | null;
  stage: LeadStageStatus;
}) {
  const { data } = useHub();
  const now = useNow();
  const todayKey = now ? todayKeyIST(now) : "";
  const errorFor = (k: DealFormKey) => errors.find((e) => e.field === `deal-${k}`)?.message;

  const set = <K extends DealFormKey>(k: K, v: DealDraft[K]) => onChange({ [k]: v } as Partial<DealDraft>);
  const text = (k: DealFormKey, label: string, opts: { placeholder?: string; mono?: boolean; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; type?: string; required?: boolean; autoComplete?: string } = {}) => (
    <Field label={label} htmlFor={`deal-${k}`} error={errorFor(k)} required={opts.required}>
      <Input
        id={`deal-${k}`}
        type={opts.type ?? "text"}
        inputMode={opts.inputMode}
        autoComplete={opts.autoComplete ?? "off"}
        value={String(draft[k] ?? "")}
        placeholder={opts.placeholder}
        onChange={(e) => set(k, e.target.value as never)}
        className={opts.mono ? "font-mono" : ""}
      />
    </Field>
  );
  const money = (k: "budgetSpecified" | "estimatedDealValue" | "proposalValue", label: string, hint?: string) => (
    <Field label={label} htmlFor={`deal-${k}`} error={errorFor(k)} hint={hint}>
      <MoneyInput id={`deal-${k}`} value={draft[k]} onChange={(v) => set(k, v ?? 0)} />
    </Field>
  );

  const field = (k: DealFormKey): React.ReactNode => {
    switch (k) {
      case "companyName":
        return text(k, "Company", { placeholder: "Apex FinTech Solutions", required: true, autoComplete: "organization" });
      case "industry":
        return text(k, "Industry", { placeholder: "Logistics, retail, healthcare" });
      case "contactPerson":
        return text(k, "Contact person", { placeholder: "Rajiv Malhotra", autoComplete: "name" });
      case "designation":
        return text(k, "Designation", { placeholder: "Head of operations" });
      case "phoneNumber":
        return text(k, "Phone", { placeholder: "98450 12345", mono: true, inputMode: "tel", type: "tel", autoComplete: "tel" });
      case "emailAddress":
        return text(k, "Email", { placeholder: "name@company.com", inputMode: "email", type: "email", autoComplete: "email" });
      case "isDecisionMaker":
        return <Checkbox id="deal-isDecisionMaker" checked={draft.isDecisionMaker} onChange={(v) => set(k, v)} label="This contact makes the decision" />;
      case "decisionMakerDetails":
        return (
          <Field label="Who else decides" htmlFor="deal-decisionMakerDetails">
            <Input id="deal-decisionMakerDetails" value={draft.decisionMakerDetails} onChange={(e) => set(k, e.target.value)} placeholder="CFO signs off above ₹10 L" />
          </Field>
        );
      case "officeAddress":
        return text(k, "Office address", { placeholder: "Building, street, area", autoComplete: "street-address" });
      case "city":
        return text(k, "City", { placeholder: "Bengaluru", autoComplete: "address-level2" });
      case "stateRegion":
        return (
          <Field label="State" htmlFor="deal-stateRegion">
            <Select id="deal-stateRegion" value={draft.stateRegion} onChange={(e) => set(k, e.target.value)}>
              <option value="">Choose a state</option>
              {withCurrent(
                INDIAN_STATES.map((s) => s.name),
                draft.stateRegion
              ).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        );
      case "googleMapsLink":
        return text(k, "Google Maps link", { placeholder: "https://maps.google.com/?q=", inputMode: "url", type: "url" });
      case "leadSource":
        return (
          <Field label="Source" htmlFor="deal-leadSource">
            <Select id="deal-leadSource" value={draft.leadSource} onChange={(e) => set(k, e.target.value)}>
              <option value="">Choose a source</option>
              {withCurrent(data.settings.leadSources, draft.leadSource).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        );
      case "campaignId":
        return (
          <Field label="Campaign" htmlFor="deal-campaignId" hint={data.campaigns.length ? undefined : "No campaigns yet"}>
            <Select id="deal-campaignId" value={draft.campaignId ?? ""} onChange={(e) => set(k, e.target.value)}>
              <option value="">No campaign</option>
              {data.campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              {draft.campaignId && !data.campaigns.some((c) => c.id === draft.campaignId) && <option value={draft.campaignId}>Campaign not found</option>}
            </Select>
          </Field>
        );
      case "clientRequirements":
        return (
          <Field label="What they need" htmlFor="deal-clientRequirements">
            <Textarea id="deal-clientRequirements" rows={3} value={draft.clientRequirements} onChange={(e) => set(k, e.target.value)} placeholder="The problem, the users, the deadline" />
          </Field>
        );
      case "solutionsPitched":
        return text(k, "What we pitched", { placeholder: "Order tracking web app with a driver Android app" });
      case "budgetSpecified":
        return money(k, "Their budget");
      case "estimatedDealValue":
        return money(k, "Deal value", "Before GST");
      case "demoRequired":
        return (
          <Field label="Demo" htmlFor="deal-demoRequired">
            <Select id="deal-demoRequired" value={draft.demoRequired} onChange={(e) => set(k, e.target.value as DealDraft["demoRequired"])}>
              <option value="Not Needed">Not needed</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Completed">Completed</option>
            </Select>
          </Field>
        );
      case "proposalSent":
        return <Switch id="deal-proposalSent" checked={draft.proposalSent} onChange={(v) => set(k, v)} label="Proposal sent" description="Turn on once the client has the proposal" />;
      case "proposalValue":
        return money(k, "Proposal value");
      case "nextFollowUpDate":
        return (
          <Field label="Next follow-up" htmlFor="deal-nextFollowUpDate">
            <DateInput id="deal-nextFollowUpDate" value={draft.nextFollowUpDate} onChange={(e) => set(k, e.target.value)} />
          </Field>
        );
      case "followUpAction":
        return text(k, "Next step", { placeholder: "Send the revised scope and book the security review" });
      case "followUpPriority":
        return (
          <Field label="Priority" htmlFor="deal-followUpPriority">
            <Select id="deal-followUpPriority" value={draft.followUpPriority} onChange={(e) => set(k, e.target.value as DealDraft["followUpPriority"])}>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </Select>
          </Field>
        );
      case "initialVisitDate":
        return (
          <Field label="First visit" htmlFor="deal-initialVisitDate">
            <DateInput id="deal-initialVisitDate" value={draft.initialVisitDate} onChange={(e) => set(k, e.target.value)} />
          </Field>
        );
      case "visitType":
        return (
          <Field label="Visit type" htmlFor="deal-visitType">
            <Select id="deal-visitType" value={draft.visitType} onChange={(e) => set(k, e.target.value)}>
              <option value="">Not set</option>
              {withCurrent(VISIT_TYPES, draft.visitType).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
        );
      case "notesNextSteps":
        return (
          <Field label="Notes" htmlFor="deal-notesNextSteps">
            <Textarea id="deal-notesNextSteps" rows={4} value={draft.notesNextSteps} onChange={(e) => set(k, e.target.value)} placeholder="Anything the next person on this deal should know" />
          </Field>
        );
    }
  };

  const cell = (k: DealFormKey) => (
    <div key={k} className={WIDE.includes(k) ? "sm:col-span-2" : ""}>
      {field(k)}
    </div>
  );

  const group = (g: (typeof GROUPS)[number], keys: DealFormKey[]) =>
    keys.length ? (
      <section key={g.id} aria-labelledby={`deal-group-${g.id}`} className="space-y-3">
        <h3 id={`deal-group-${g.id}`} className="text-[13px] font-medium text-ink-2">
          {g.title}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">{keys.map(cell)}</div>
      </section>
    ) : null;

  /* ---------------------------------------------------------------- derived sentences */

  const prob = Number(data.settings.stageProbabilities[stage]) || 0;
  const weighted = Math.round((Number(draft.estimatedDealValue) || 0) * prob);
  const sentences: string[] = [`Weighted value ${formatInr(weighted)} at ${Math.round(prob * 100)}% for ${stage}.`];
  if (todayKey && draft.nextFollowUpDate) {
    const due = dueText({ nextFollowUpDate: draft.nextFollowUpDate, leadStatus: stage }, todayKey);
    if (due !== "Closed") sentences.push(`Follow-up: ${due.charAt(0).toLowerCase()}${due.slice(1)}.`);
  }
  if (deal && !isNew) {
    if (deal.lastInteractionDate) {
      const days = Number(deal.daysSinceLastVisit) || 0;
      sentences.push(
        `Last contact ${formatDateIST(deal.lastInteractionDate, { year: true })}${days ? `, ${days} ${days === 1 ? "day" : "days"} ago` : ", today"}.`
      );
    } else sentences.push("No visit logged yet.");
    sentences.push(`Lead ${deal.leadId || "without an ID"}, added ${formatDateIST(deal.dateAdded, { year: true })}.`);
    if (deal.leadStatus === "Closed Won" && deal.conversionDate) sentences.push(`Won on ${formatDateIST(deal.conversionDate, { year: true })}.`);
    if (deal.quoteNumber && deal.quoteNumber !== "auto") sentences.push(`Quotation ${deal.quoteNumber}.`);
  } else {
    sentences.push("The lead ID is given when you save.");
  }

  const derived = (
    <div className="card-inset space-y-1 p-4 text-[13px] text-ink-2">
      {deal?.externalSource === "meta_lead_ads" && <p className="text-ink-3">From a Meta Lead Ad, form {deal.formId || "not recorded"}.</p>}
      {sentences.map((s) => (
        <p key={s}>{s}</p>
      ))}
    </div>
  );

  const errorSummary = errors.length > 0 && <ErrorSummary errors={errors} />;

  if (quick) {
    const rest = GROUPS.map((g) => ({ g, keys: g.keys.filter((k) => !QUICK_KEYS.includes(k)) }));
    const restHasError = errors.some((e) => !QUICK_KEYS.some((k) => e.field === `deal-${k}`));
    return (
      <fieldset disabled={readOnly} className="min-w-0 space-y-5">
        {errorSummary}
        <div className="grid gap-4">{QUICK_KEYS.map(cell)}</div>
        <details className="group rounded-[20px] bg-surface-2 p-1" open={restHasError ? true : undefined}>
          <summary className="flex h-11 cursor-pointer list-none items-center justify-between rounded-[16px] px-4 text-[14px] font-medium text-ink [&::-webkit-details-marker]:hidden">
            More details
            <ChevronDown aria-hidden className="size-4 text-ink-2 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-6 rounded-[16px] bg-raised p-4">{rest.map(({ g, keys }) => group(g, keys))}</div>
        </details>
        {derived}
      </fieldset>
    );
  }

  return (
    <fieldset disabled={readOnly} className="min-w-0 space-y-6">
      {errorSummary}
      {derived}
      {GROUPS.map((g) => group(g, g.keys))}
    </fieldset>
  );
}
