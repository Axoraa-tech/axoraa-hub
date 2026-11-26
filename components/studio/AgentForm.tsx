"use client";

import React, { useId, useState } from "react";
import { Play, Square } from "lucide-react";
import { OPEN_STAGES, visitLinksDeal } from "@/lib/analytics";
import type { AgentCatalogEntry } from "@/lib/agents/catalog";
import { INPUT_SCHEMAS } from "@/lib/agents/schemas";
import type { AgentLanguage, AgentRef, AgentRunRequest } from "@/lib/agents/types";
import { addDaysKey, formatDateIST, formatInr, todayKeyIST } from "@/lib/format";
import { useHub } from "@/lib/hub/context";
import { CHANNEL_LABEL, type ChannelId } from "@/lib/integrations/types";
import { MARKETING_NAMES } from "@/lib/people";
import type { Campaign, MarketingDeal, PaymentBillingRecord } from "@/lib/types";
import { ChannelMark, channelMarkFor } from "@/components/ui/ChannelMark";
import { Combobox, DateInput, ErrorSummary, Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/form";
import { Segmented } from "@/components/ui/primitives";
import { LANGUAGE_LABEL, type RunMeta } from "./AgentRunner";

type Values = Record<string, unknown>;
type FieldError = { field: string; message: string };

const CHANNELS: ChannelId[] = ["facebook_page", "instagram", "linkedin"];
const MAX_VISITS = 3;

function nextMonday(today: string): string {
  const wd = new Date(`${today}T00:00:00Z`).getUTCDay();
  const add = (8 - wd) % 7 || 7;
  return addDaysKey(today, add);
}

const str = (v: unknown) => (typeof v === "string" ? v : v === undefined || v === null ? "" : String(v));
const numOrUndef = (v: unknown) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  const s = str(v).trim();
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
};

/** Parses 'type:id' from the URL. */
export function parseRefParam(v: string | null | undefined): AgentRef | undefined {
  if (!v) return undefined;
  const i = v.indexOf(":");
  if (i <= 0) return undefined;
  const type = v.slice(0, i);
  const id = v.slice(i + 1);
  if (!id || !["deal", "visit", "invoice", "campaign", "client"].includes(type)) return undefined;
  return { type: type as AgentRef["type"], id };
}

/** The record behind a ref in the viewer's (scoped) data, or null when it is missing or out of scope. */
export function useRefRecord(ref?: AgentRef): { name: string } | null {
  const { data } = useHub();
  if (!ref) return null;
  switch (ref.type) {
    case "deal": {
      const d = data.deals.find((x) => x.id === ref.id);
      return d ? { name: d.companyName } : null;
    }
    case "visit": {
      const v = data.interactions.find((x) => x.id === ref.id);
      return v ? { name: `${v.companyName}, visit on ${formatDateIST(v.date)}` } : null;
    }
    case "invoice": {
      const p = data.payments.find((x) => x.id === ref.id);
      return p ? { name: `${p.invoiceId}, ${p.companyName}` } : null;
    }
    case "campaign": {
      const c = data.campaigns.find((x) => x.id === ref.id);
      return c ? { name: c.name } : null;
    }
    case "client": {
      const c = data.clients.find((x) => x.id === ref.id);
      return c ? { name: c.companyName } : null;
    }
  }
}

function defaults(entry: AgentCatalogEntry, services: string[], initial: Values, prefillNotes: string, prefillCompany: { name?: string; city?: string }): Values {
  const today = todayKeyIST();
  const base: Record<string, Values> = {
    follow_up: { channel: "all", tone: "warm", notes: "" },
    visit_notes: { notes: prefillNotes },
    prospect_brief: { company: prefillCompany.name ?? "", city: prefillCompany.city ?? "", website: "", focus: "" },
    proposal_outline: { budgetNote: "", timelineWeeks: "" },
    social_posts: { goal: "", channels: [...CHANNELS], startDate: nextMonday(today), weeks: 2, postsPerWeek: 3, topics: "" },
    meta_campaign: { service: services[0] ?? "", customService: "", objective: "leads", locations: "Bengaluru", dailyBudgetInr: 1000, durationDays: 14, audienceNotes: "" },
    pipeline_review: { repName: "" },
    payment_reminder: { tone: "gentle" },
  };
  return { ...base[entry.key], ...initial };
}

export function AgentForm({
  entry,
  fixedRef,
  initialRef,
  initialInput,
  running,
  onRun,
  onStop,
}: {
  entry: AgentCatalogEntry;
  /** A ref the form may not change (agent sheet over a record). */
  fixedRef?: AgentRef;
  /** A starting ref the viewer may change (from ?ref=). */
  initialRef?: AgentRef;
  initialInput?: Record<string, unknown>;
  running: boolean;
  onRun: (body: AgentRunRequest, meta: RunMeta) => void;
  onStop: () => void;
}) {
  const { data, viewer } = useHub();
  const uid = useId().replace(/:/g, "");
  const id = (f: string) => `af-${uid}-${f}`;
  const services = data.settings.company.services;
  const isAdmin = viewer.category === "admin";

  const [ref, setRef] = useState<AgentRef | undefined>(fixedRef ?? initialRef);
  const visitForNotes = ref?.type === "visit" ? data.interactions.find((v) => v.id === ref.id) : undefined;
  const dealForCompany = ref?.type === "deal" ? data.deals.find((d) => d.id === ref.id) : undefined;
  const [values, setValues] = useState<Values>(() =>
    defaults(entry, services, initialInput ?? {}, visitForNotes?.discussionFeedback ?? "", { name: dealForCompany?.companyName, city: dealForCompany?.city })
  );
  const [language, setLanguage] = useState<AgentLanguage>("en");
  const [errors, setErrors] = useState<FieldError[]>([]);
  const set = (k: string, v: unknown) => setValues((s) => ({ ...s, [k]: v }));
  const errorFor = (f: string) => errors.find((e) => e.field === id(f))?.message;

  const deals = [...data.deals].sort((a, b) => a.companyName.localeCompare(b.companyName));
  const openInvoices = data.payments.filter((p) => (Number(p.pendingAmount) || 0) > 0.5).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  const selectedDeal = ref?.type === "deal" ? data.deals.find((d) => d.id === ref.id) ?? null : null;
  const selectedInvoice = ref?.type === "invoice" ? data.payments.find((p) => p.id === ref.id) ?? null : null;
  const usesDealPicker = !fixedRef && entry.refTypes.includes("deal") && ref?.type !== "visit";
  const usesInvoicePicker = !fixedRef && entry.refTypes.includes("invoice");
  const usesCampaignPicker = !fixedRef && entry.refTypes.includes("campaign");

  /* ---------------------------------------------------------------- build the request */

  const buildInput = (): Values => {
    const v = values;
    switch (entry.key) {
      case "follow_up":
        return { channel: v.channel, tone: v.tone, notes: str(v.notes) };
      case "visit_notes":
        return { notes: str(v.notes) };
      case "prospect_brief":
        return { company: str(v.company), city: str(v.city), website: str(v.website), focus: str(v.focus) };
      case "proposal_outline":
        return { budgetNote: str(v.budgetNote), timelineWeeks: numOrUndef(v.timelineWeeks) };
      case "social_posts":
        return { goal: str(v.goal), channels: v.channels, startDate: str(v.startDate), weeks: Number(v.weeks), postsPerWeek: Number(v.postsPerWeek), topics: str(v.topics) };
      case "meta_campaign": {
        const service = v.service === "__other" ? str(v.customService) : str(v.service);
        const locations = str(v.locations)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        return {
          service,
          objective: v.objective,
          locations,
          dailyBudgetInr: typeof v.dailyBudgetInr === "number" ? v.dailyBudgetInr : undefined,
          durationDays: numOrUndef(v.durationDays),
          audienceNotes: str(v.audienceNotes),
        };
      }
      case "pipeline_review":
        return isAdmin && str(v.repName) ? { repName: str(v.repName) } : {};
      case "payment_reminder":
        return { tone: v.tone };
    }
  };

  const buildContext = (): AgentRunRequest["context"] => {
    const c: NonNullable<AgentRunRequest["context"]> = {};
    if (ref?.type === "deal") {
      const deal = data.deals.find((d) => d.id === ref.id);
      if (deal) {
        c.deal = deal;
        c.visits = data.interactions
          .filter((v) => visitLinksDeal(v, deal))
          .sort((a, b) => String(b.date).localeCompare(String(a.date)))
          .slice(0, MAX_VISITS);
      }
    } else if (ref?.type === "visit") {
      const visit = data.interactions.find((v) => v.id === ref.id);
      if (visit) {
        c.visits = [visit];
        const deal = data.deals.find((d) => visitLinksDeal(visit, d));
        if (deal) c.deal = deal;
      }
    } else if (ref?.type === "invoice") {
      const inv = data.payments.find((p) => p.id === ref.id);
      if (inv) {
        c.invoice = inv;
        const client = data.clients.find((x) => x.clientId === inv.clientId);
        if (client) c.client = client;
      }
    } else if (ref?.type === "campaign") {
      const camp = data.campaigns.find((x) => x.id === ref.id);
      if (camp) c.campaign = camp;
    } else if (ref?.type === "client") {
      const client = data.clients.find((x) => x.id === ref.id);
      if (client) c.client = client;
    }
    if (entry.key === "pipeline_review") c.deals = data.deals.filter((d) => OPEN_STAGES.includes(d.leadStatus));
    return c;
  };

  const titleFor = (input: Values): string => {
    const deal = ref?.type === "deal" ? data.deals.find((d) => d.id === ref.id) : ref?.type === "visit" ? data.deals.find((d) => visitForNotes && visitLinksDeal(visitForNotes, d)) : undefined;
    const company = deal?.companyName ?? visitForNotes?.companyName;
    switch (entry.key) {
      case "follow_up":
        return `Follow-up for ${company ?? "a deal"}`;
      case "visit_notes":
        return company ? `Visit notes for ${company}` : "Visit notes";
      case "prospect_brief":
        return `Brief on ${str(input.company)}`;
      case "proposal_outline":
        return `Proposal outline for ${company ?? "a deal"}`;
      case "social_posts":
        return `Social posts from ${formatDateIST(str(input.startDate))}`;
      case "meta_campaign":
        return `Meta campaign for ${str(input.service)}`;
      case "pipeline_review":
        return input.repName ? `Stale deals for ${str(input.repName)}` : "Stale deals review";
      case "payment_reminder": {
        const inv = data.payments.find((p) => ref?.type === "invoice" && p.id === ref.id);
        return `Payment reminder for ${inv ? `${inv.invoiceId}, ${inv.companyName}` : "an invoice"}`;
      }
    }
  };

  const submit = () => {
    const errs: FieldError[] = [];
    if (entry.refRequired && !ref) {
      errs.push({ field: id(entry.refType === "invoice" ? "invoice" : "deal"), message: entry.refType === "invoice" ? "Pick the invoice to remind about." : "Pick a deal first." });
    }
    if (entry.key === "meta_campaign" && values.service === "__other" && !str(values.customService).trim()) {
      errs.push({ field: id("customService"), message: "Name the service to promote." });
    }
    const input = buildInput();
    const parsed = INPUT_SCHEMAS[entry.key].safeParse(input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = id(String(issue.path[0] ?? "input"));
        if (!errs.some((e) => e.field === field)) errs.push({ field, message: issue.message });
      }
    }
    setErrors(errs);
    if (errs.length || !parsed.success) return;

    const clean = parsed.data as Values;
    const body: AgentRunRequest = { input: clean };
    if (ref) body.ref = ref;
    if (entry.supportsLanguage) body.language = language;
    if (!data.sharedMode) {
      body.context = buildContext();
      body.company = data.settings.company;
    }
    onRun(body, { title: titleFor(clean), input: clean, language: entry.supportsLanguage ? language : "en", ref });
  };

  /* ---------------------------------------------------------------- fields */

  const dealPicker = usesDealPicker && (
    <div className="md:col-span-2">
      <Combobox<MarketingDeal>
        id={id("deal")}
        label={entry.refRequired ? "Deal" : "Deal (optional)"}
        items={deals}
        value={selectedDeal}
        onChange={(d) => setRef(d ? { type: "deal", id: d.id } : undefined)}
        getKey={(d) => d.id}
        getLabel={(d) => d.companyName}
        getDescription={(d) => `${d.leadId}, ${d.leadStatus}${d.estimatedDealValue ? `, ${formatInr(d.estimatedDealValue)}` : ""}`}
        placeholder={deals.length ? "Search your deals" : "No deals yet"}
        error={errorFor("deal")}
      />
    </div>
  );

  const invoicePicker = usesInvoicePicker && (
    <div className="md:col-span-2">
      <Combobox<PaymentBillingRecord>
        id={id("invoice")}
        label="Invoice"
        items={openInvoices}
        value={selectedInvoice}
        onChange={(p) => setRef(p ? { type: "invoice", id: p.id } : undefined)}
        getKey={(p) => p.id}
        getLabel={(p) => `${p.invoiceId}, ${p.companyName}`}
        getDescription={(p) => `${formatInr(p.pendingAmount)} due ${formatDateIST(p.dueDate)}${p.status === "Overdue" ? ", overdue" : ""}`}
        placeholder={openInvoices.length ? "Search unpaid invoices" : "No unpaid invoices"}
        error={errorFor("invoice")}
      />
    </div>
  );

  const campaignPicker = usesCampaignPicker && (
    <Field label="Campaign (optional)" htmlFor={id("campaign")} hint="The plan can be saved onto it">
      <Select id={id("campaign")} value={ref?.type === "campaign" ? ref.id : ""} onChange={(e) => setRef(e.target.value ? { type: "campaign", id: e.target.value } : undefined)}>
        <option value="">A new campaign</option>
        {data.campaigns.map((c: Campaign) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
    </Field>
  );

  let fields: React.ReactNode = null;
  switch (entry.key) {
    case "follow_up":
      fields = (
        <>
          {dealPicker}
          <Field label="Channel" htmlFor={id("channel")}>
            <Select id={id("channel")} value={str(values.channel)} onChange={(e) => set("channel", e.target.value)}>
              <option value="all">Email, WhatsApp and call points</option>
              <option value="email">Email only</option>
              <option value="whatsapp">WhatsApp only</option>
              <option value="call">Call points only</option>
            </Select>
          </Field>
          <div>
            <span className="mb-1.5 block text-[12px] font-medium text-ink-2" id={id("tone-label")}>
              Tone
            </span>
            <Segmented
              label="Tone"
              value={str(values.tone) as "warm" | "formal"}
              onChange={(v) => set("tone", v)}
              options={[
                { value: "warm", label: "Warm" },
                { value: "formal", label: "Formal" },
              ]}
            />
          </div>
          <Field label="Anything to mention (optional)" htmlFor={id("notes")} error={errorFor("notes")} className="md:col-span-2">
            <Textarea id={id("notes")} rows={3} value={str(values.notes)} onChange={(e) => set("notes", e.target.value)} placeholder="Demo went well, they want pricing for 50 users" />
          </Field>
        </>
      );
      break;
    case "visit_notes":
      fields = (
        <>
          {dealPicker}
          <Field
            label="Visit notes"
            htmlFor={id("notes")}
            error={errorFor("notes")}
            hint={errorFor("notes") ? undefined : "Write it the way you would tell a colleague. Who you met, what they said, what happens next."}
            required
            className="md:col-span-2"
          >
            <Textarea id={id("notes")} rows={8} value={str(values.notes)} onChange={(e) => set("notes", e.target.value)} placeholder="Met Rajiv (CTO) and the finance head at their Whitefield office…" />
          </Field>
        </>
      );
      break;
    case "prospect_brief":
      fields = (
        <>
          <Field label="Company" htmlFor={id("company")} error={errorFor("company")} required>
            <Input id={id("company")} value={str(values.company)} onChange={(e) => set("company", e.target.value)} placeholder="Apex FinTech Solutions" autoComplete="off" />
          </Field>
          <Field label="City (optional)" htmlFor={id("city")} error={errorFor("city")}>
            <Input id={id("city")} value={str(values.city)} onChange={(e) => set("city", e.target.value)} placeholder="Bengaluru" />
          </Field>
          <Field label="Website (optional)" htmlFor={id("website")} error={errorFor("website")} hint="Helps the search find the right company">
            <Input id={id("website")} value={str(values.website)} onChange={(e) => set("website", e.target.value)} placeholder="apexfintech.in" inputMode="url" />
          </Field>
          <Field label="What to look for (optional)" htmlFor={id("focus")} error={errorFor("focus")}>
            <Input id={id("focus")} value={str(values.focus)} onChange={(e) => set("focus", e.target.value)} placeholder="Their loan app and who runs IT" />
          </Field>
        </>
      );
      break;
    case "proposal_outline":
      fields = (
        <>
          {dealPicker}
          <Field label="Budget note (optional)" htmlFor={id("budgetNote")} error={errorFor("budgetNote")}>
            <Input id={id("budgetNote")} value={str(values.budgetNote)} onChange={(e) => set("budgetNote", e.target.value)} placeholder="They mentioned ₹8 to 10 lakh" />
          </Field>
          <Field label="Timeline in weeks (optional)" htmlFor={id("timelineWeeks")} error={errorFor("timelineWeeks")}>
            <Input id={id("timelineWeeks")} inputMode="numeric" value={str(values.timelineWeeks)} onChange={(e) => set("timelineWeeks", e.target.value.replace(/[^\d]/g, ""))} placeholder="12" />
          </Field>
        </>
      );
      break;
    case "social_posts": {
      const chosen = (values.channels as ChannelId[]) ?? [];
      fields = (
        <>
          <Field label="Goal" htmlFor={id("goal")} error={errorFor("goal")} required className="md:col-span-2">
            <Input id={id("goal")} value={str(values.goal)} onChange={(e) => set("goal", e.target.value)} placeholder="Get enquiries for custom billing software from Bengaluru retailers" />
          </Field>
          <fieldset className="md:col-span-2" aria-describedby={errorFor("channels") ? id("channels-error") : undefined}>
            <legend className="mb-1.5 block text-[12px] font-medium text-ink-2">Channels</legend>
            <div className="flex flex-wrap gap-2" id={id("channels")} tabIndex={-1}>
              {CHANNELS.map((c) => {
                const on = chosen.includes(c);
                return (
                  <label
                    key={c}
                    className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-[13px] font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${
                      on ? "bg-accent text-on-accent" : "bg-surface-2 text-ink-2 hover:text-ink"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={on}
                      onChange={(e) => set("channels", e.target.checked ? [...chosen, c] : chosen.filter((x) => x !== c))}
                    />
                    <ChannelMark channel={channelMarkFor(c)} size={15} />
                    {CHANNEL_LABEL[c]}
                  </label>
                );
              })}
            </div>
            {errorFor("channels") && (
              <span id={id("channels-error")} className="mt-1.5 block text-[12px] text-negative">
                {errorFor("channels")}
              </span>
            )}
          </fieldset>
          <Field label="Start date" htmlFor={id("startDate")} error={errorFor("startDate")} hint={values.startDate ? formatDateIST(str(values.startDate), { weekday: true, year: true }) : undefined}>
            <DateInput id={id("startDate")} value={str(values.startDate)} onChange={(e) => set("startDate", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Weeks" htmlFor={id("weeks")} error={errorFor("weeks")}>
              <Select id={id("weeks")} value={str(values.weeks)} onChange={(e) => set("weeks", Number(e.target.value))}>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Posts a week" htmlFor={id("postsPerWeek")} error={errorFor("postsPerWeek")}>
              <Select id={id("postsPerWeek")} value={str(values.postsPerWeek)} onChange={(e) => set("postsPerWeek", Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Topics (optional)" htmlFor={id("topics")} error={errorFor("topics")} className="md:col-span-2">
            <Textarea id={id("topics")} rows={2} value={str(values.topics)} onChange={(e) => set("topics", e.target.value)} placeholder="GST invoicing, offline billing, a case study from a Mysuru distributor" />
          </Field>
        </>
      );
      break;
    }
    case "meta_campaign":
      fields = (
        <>
          {campaignPicker}
          <Field label="Service to promote" htmlFor={id("service")} error={errorFor("service")}>
            <Select id={id("service")} value={str(values.service)} onChange={(e) => set("service", e.target.value)}>
              {services.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value="__other">Something else…</option>
            </Select>
          </Field>
          {values.service === "__other" && (
            <Field label="Service" htmlFor={id("customService")} error={errorFor("customService")} required>
              <Input id={id("customService")} value={str(values.customService)} onChange={(e) => set("customService", e.target.value)} placeholder="Clinic management software" />
            </Field>
          )}
          <Field label="Objective" htmlFor={id("objective")} error={errorFor("objective")}>
            <Select id={id("objective")} value={str(values.objective)} onChange={(e) => set("objective", e.target.value)}>
              <option value="leads">Leads (lead form)</option>
              <option value="traffic">Website visits</option>
              <option value="awareness">Awareness</option>
            </Select>
          </Field>
          <Field label="Locations" htmlFor={id("locations")} error={errorFor("locations")} hint="Separate with commas">
            <Input id={id("locations")} value={str(values.locations)} onChange={(e) => set("locations", e.target.value)} placeholder="Bengaluru, Mysuru" />
          </Field>
          <Field label="Daily budget" htmlFor={id("dailyBudgetInr")} error={errorFor("dailyBudgetInr")} hint="₹200 to ₹1,00,000">
            <MoneyInput id={id("dailyBudgetInr")} value={typeof values.dailyBudgetInr === "number" ? values.dailyBudgetInr : null} onChange={(n) => set("dailyBudgetInr", n ?? undefined)} />
          </Field>
          <Field
            label="Days"
            htmlFor={id("durationDays")}
            error={errorFor("durationDays")}
            hint={typeof values.dailyBudgetInr === "number" && Number(values.durationDays) > 0 ? `Total ${formatInr(values.dailyBudgetInr * Number(values.durationDays))}` : "3 to 90"}
          >
            <Input id={id("durationDays")} inputMode="numeric" value={str(values.durationDays)} onChange={(e) => set("durationDays", e.target.value.replace(/[^\d]/g, ""))} />
          </Field>
          <Field label="Audience notes (optional)" htmlFor={id("audienceNotes")} error={errorFor("audienceNotes")} className="md:col-span-2">
            <Textarea id={id("audienceNotes")} rows={2} value={str(values.audienceNotes)} onChange={(e) => set("audienceNotes", e.target.value)} placeholder="Owners of clinics with 2 to 10 doctors" />
          </Field>
        </>
      );
      break;
    case "pipeline_review":
      fields = isAdmin ? (
        <Field label="Whose deals" htmlFor={id("repName")}>
          <Select id={id("repName")} value={str(values.repName)} onChange={(e) => set("repName", e.target.value)}>
            <option value="">Everyone</option>
            {MARKETING_NAMES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <p className="text-[13.5px] text-ink-2 md:col-span-2">Looks at your open deals whose follow-up has passed or with no visit in 14 days.</p>
      );
      break;
    case "payment_reminder":
      fields = (
        <>
          {invoicePicker}
          <div>
            <span className="mb-1.5 block text-[12px] font-medium text-ink-2">Tone</span>
            <Segmented
              label="Tone"
              value={str(values.tone) as "gentle" | "firm"}
              onChange={(v) => set("tone", v)}
              options={[
                { value: "gentle", label: "Gentle" },
                { value: "firm", label: "Firm" },
              ]}
            />
          </div>
        </>
      );
      break;
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!running) submit();
      }}
      className="space-y-4"
    >
      <ErrorSummary errors={errors} title="Fix these before running" />
      <div className="grid gap-4 md:grid-cols-2">
        {fields}
        {entry.supportsLanguage && (
          <Field label="Language" htmlFor={id("language")} hint={language === "en" ? undefined : "Subject lines and the signature stay in English"}>
            <Select id={id("language")} value={language} onChange={(e) => setLanguage(e.target.value as AgentLanguage)}>
              {(Object.keys(LANGUAGE_LABEL) as AgentLanguage[]).map((l) => (
                <option key={l} value={l}>
                  {LANGUAGE_LABEL[l]}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button type="submit" className="btn btn-primary" disabled={running}>
          <Play aria-hidden /> {entry.name}
        </button>
        {running && (
          <button type="button" className="btn btn-ghost" onClick={onStop}>
            <Square aria-hidden /> Stop
          </button>
        )}
        {entry.usesWebSearch && <span className="text-[12px] text-ink-3">Searches the web. Takes a minute or two.</span>}
      </div>
    </form>
  );
}
