"use client";

import React, { useState } from "react";
import { PenLine, Save, Trash2 } from "lucide-react";
import { campaignRollup } from "@/lib/analytics";
import { agentRoleOf, agentsFor } from "@/lib/agents/catalog";
import { formatInr, formatInrFull, todayKeyIST } from "@/lib/format";
import { useHub } from "@/lib/hub/context";
import { can } from "@/lib/hub/permissions";
import { MARKETING_NAMES } from "@/lib/people";
import type { Campaign } from "@/lib/types";
import type { Overlay } from "@/lib/views";
import { Sheet } from "@/components/ui/Dialog";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { DateInput, ErrorSummary, Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/primitives";
import { CampaignPlanView } from "./AgentOutputView";

type CampaignOverlay = Extract<Overlay, { kind: "campaign" }>;
type FieldError = { field: string; message: string };

const PLATFORMS: Campaign["platform"][] = ["Meta", "Google Ads", "LinkedIn", "Email / Outreach", "SEO / Content", "Offline / Event"];
const OBJECTIVES: { value: Campaign["objective"]; label: string }[] = [
  { value: "leads", label: "Leads" },
  { value: "traffic", label: "Website visits" },
  { value: "awareness", label: "Awareness" },
  { value: "engagement", label: "Engagement" },
];
const STATUSES: Campaign["status"][] = ["Planning", "Active", "Paused", "Completed"];

interface Draft {
  name: string;
  platform: Campaign["platform"];
  objective: Campaign["objective"];
  status: Campaign["status"];
  startDate: string;
  endDate: string;
  dailyBudget: number | null;
  totalBudget: number | null;
  spend: number | null;
  leads: string;
  ownerName: string;
  audience: string;
  notes: string;
}

function draftOf(c: Partial<Campaign>, owner: string, today: string): Draft {
  return {
    name: c.name ?? "",
    platform: c.platform ?? "Meta",
    objective: c.objective ?? "leads",
    status: c.status ?? "Planning",
    startDate: (c.startDate ?? today).slice(0, 10),
    endDate: (c.endDate ?? "").slice(0, 10),
    dailyBudget: c.dailyBudget ?? null,
    totalBudget: c.totalBudget ?? null,
    spend: c.spend ?? null,
    leads: c.leads !== undefined && c.leads !== null ? String(c.leads) : "",
    ownerName: c.ownerName ?? owner,
    audience: c.audience ?? "",
    notes: c.notes ?? "",
  };
}

export function CampaignEditor({ overlay, onClose }: { overlay: CampaignOverlay; onClose: () => void }) {
  const { data, viewer, navigate } = useHub();
  const toast = useToast();
  const confirm = useConfirm();
  const [savedId, setSavedId] = useState<string | null>(overlay.campaignId ?? null);
  const campaign = savedId ? data.campaigns.find((c) => c.id === savedId) ?? null : null;
  const [draft, setDraft] = useState<Draft>(() => draftOf(campaign ?? overlay.prefill ?? {}, viewer.name, todayKeyIST()));
  const [baseline, setBaseline] = useState(() => JSON.stringify(draft));
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState(false);

  if (overlay.campaignId && !campaign) {
    return (
      <Sheet open onClose={onClose} title="Campaign" width="md">
        <EmptyState title="This campaign isn't available" body="It was deleted, or it is not in your workspace." />
      </Sheet>
    );
  }

  const canEdit = can(viewer, "campaign.edit", { data, record: campaign ?? undefined });
  const canPlan = agentsFor(agentRoleOf(viewer.category), data.settings.disabledAgents).some((a) => a.key === "meta_campaign");
  const dirty = JSON.stringify(draft) !== baseline;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const errorFor = (f: string) => errors.find((e) => e.field === `cmp-${f}`)?.message;
  const roll = campaign ? campaignRollup([campaign], data.deals)[0] : null;
  const linkedDeals = campaign ? data.deals.filter((d) => d.campaignId === campaign.id).length : 0;

  const save = async () => {
    const errs: FieldError[] = [];
    if (!draft.name.trim()) errs.push({ field: "cmp-name", message: "Name the campaign." });
    if (!draft.startDate) errs.push({ field: "cmp-startDate", message: "Pick a start date." });
    if (draft.endDate && draft.startDate && draft.endDate < draft.startDate) errs.push({ field: "cmp-endDate", message: "The end date is before the start date." });
    const leads = draft.leads.trim() ? Number(draft.leads) : 0;
    if (!Number.isFinite(leads) || leads < 0) errs.push({ field: "cmp-leads", message: "Leads must be a whole number." });
    setErrors(errs);
    if (errs.length) return;
    setBusy(true);
    const patch: Partial<Campaign> = {
      name: draft.name.trim(),
      platform: draft.platform,
      objective: draft.objective,
      status: draft.status,
      startDate: draft.startDate,
      endDate: draft.endDate || undefined,
      dailyBudget: draft.dailyBudget ?? undefined,
      totalBudget: draft.totalBudget ?? 0,
      spend: draft.spend ?? 0,
      leads: Math.round(leads),
      ownerName: draft.ownerName,
      audience: draft.audience.trim(),
      notes: draft.notes.trim(),
      ...(campaign ? {} : { source: "manual" as const }),
    };
    const res = await data.saveCampaign(patch, savedId ?? undefined);
    setBusy(false);
    setSavedId(res.record.id);
    setBaseline(JSON.stringify(draft));
    toast({ message: res.ok ? (savedId ? "Campaign saved" : `Added ${patch.name}`) : "Saved on this device. Not saved to Google Sheets yet.", tone: res.ok ? "positive" : "negative" });
  };

  const remove = async () => {
    if (!campaign) return;
    const ok = await confirm({
      title: "Delete this campaign?",
      body: `“${campaign.name}” will be removed.${linkedDeals ? ` ${linkedDeals} linked ${linkedDeals === 1 ? "deal keeps" : "deals keep"} their details.` : ""}`,
      confirmLabel: "Delete campaign",
      tone: "danger",
    });
    if (!ok) return;
    const res = await data.deleteCampaign(campaign.id);
    if (res.ok) {
      toast({ message: "Campaign deleted" });
      onClose();
    } else toast({ message: res.error || "Couldn't delete the campaign.", tone: "negative" });
  };

  const owners = Array.from(new Set([...MARKETING_NAMES, viewer.name, draft.ownerName].filter(Boolean)));

  return (
    <Sheet
      open
      onClose={onClose}
      width="lg"
      title={campaign ? campaign.name : "Add campaign"}
      description={campaign ? `${campaign.platform}, ${campaign.status}` : "Budget, spend and leads for one campaign"}
      footer={
        <>
          {campaign && canEdit && (
            <button type="button" className="btn btn-plain mr-auto text-negative" onClick={remove} disabled={busy}>
              <Trash2 aria-hidden /> Delete
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {dirty ? "Cancel" : "Close"}
          </button>
          {canEdit && (
            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy || (!dirty && !!savedId)}>
              <Save aria-hidden /> {busy ? "Saving…" : "Save"}
            </button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        {roll && (
          <div className="grid grid-cols-3 gap-2">
            <div className="card-inset p-4">
              <div className="text-[12px] text-ink-3">Spend</div>
              <div className="num mt-3 text-[24px]" title={formatInrFull(roll.spend)}>
                {formatInr(roll.spend)}
              </div>
            </div>
            <div className="card-inset p-4">
              <div className="text-[12px] text-ink-3">Leads</div>
              <div className="num mt-3 text-[24px]">{roll.leads}</div>
            </div>
            <div className="card-inset p-4">
              <div className="text-[12px] text-ink-3">Per lead</div>
              <div className="num mt-3 text-[24px]">{roll.leads ? formatInr(roll.cpl) : "–"}</div>
            </div>
          </div>
        )}

        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canEdit) void save();
          }}
        >
          <ErrorSummary errors={errors} />
          <fieldset disabled={!canEdit} className="grid gap-4 md:grid-cols-2">
            <Field label="Name" htmlFor="cmp-name" error={errorFor("name")} required className="md:col-span-2">
              <Input id="cmp-name" value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Clinic software, Bengaluru, December" />
            </Field>
            <Field label="Platform" htmlFor="cmp-platform">
              <Select id="cmp-platform" value={draft.platform} onChange={(e) => set("platform", e.target.value as Campaign["platform"])}>
                {PLATFORMS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
            </Field>
            <Field label="Objective" htmlFor="cmp-objective">
              <Select id="cmp-objective" value={draft.objective} onChange={(e) => set("objective", e.target.value as Campaign["objective"])}>
                {OBJECTIVES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status" htmlFor="cmp-status">
              <Select id="cmp-status" value={draft.status} onChange={(e) => set("status", e.target.value as Campaign["status"])}>
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
            <Field label="Owner" htmlFor="cmp-owner">
              <Select id="cmp-owner" value={draft.ownerName} onChange={(e) => set("ownerName", e.target.value)}>
                {owners.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </Select>
            </Field>
            <Field label="Start date" htmlFor="cmp-startDate" error={errorFor("startDate")} required>
              <DateInput id="cmp-startDate" value={draft.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </Field>
            <Field label="End date (optional)" htmlFor="cmp-endDate" error={errorFor("endDate")}>
              <DateInput id="cmp-endDate" value={draft.endDate} onChange={(e) => set("endDate", e.target.value)} />
            </Field>
            <Field label="Daily budget (optional)" htmlFor="cmp-daily">
              <MoneyInput id="cmp-daily" value={draft.dailyBudget} onChange={(v) => set("dailyBudget", v)} />
            </Field>
            <Field label="Total budget" htmlFor="cmp-total">
              <MoneyInput id="cmp-total" value={draft.totalBudget} onChange={(v) => set("totalBudget", v)} />
            </Field>
            <Field label="Spend so far" htmlFor="cmp-spend">
              <MoneyInput id="cmp-spend" value={draft.spend} onChange={(v) => set("spend", v)} />
            </Field>
            <Field
              label="Leads"
              htmlFor="cmp-leads"
              error={errorFor("leads")}
              hint={linkedDeals ? `${linkedDeals} ${linkedDeals === 1 ? "deal is" : "deals are"} linked; the higher number counts` : "Count from the ad platform"}
            >
              <Input id="cmp-leads" inputMode="numeric" value={draft.leads} onChange={(e) => set("leads", e.target.value.replace(/[^\d]/g, ""))} />
            </Field>
            <Field label="Audience" htmlFor="cmp-audience" className="md:col-span-2">
              <Input id="cmp-audience" value={draft.audience} onChange={(e) => set("audience", e.target.value)} placeholder="Clinic owners in Bengaluru, 28 to 55" />
            </Field>
            <Field label="Notes" htmlFor="cmp-notes" className="md:col-span-2">
              <Textarea id="cmp-notes" rows={3} value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </fieldset>
        </form>

        <dl className="grid grid-cols-2 gap-3 rounded-inset bg-surface-2 p-4 text-[13px] sm:grid-cols-3">
          <div>
            <dt className="text-ink-3">Source</dt>
            <dd className="mt-0.5 text-ink">{campaign?.source === "meta" ? "Synced from Meta" : "Added in the hub"}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Meta campaign ID</dt>
            <dd className="mt-0.5 font-mono text-ink">–</dd>
          </div>
          <div>
            <dt className="text-ink-3">Ad account</dt>
            <dd className="mt-0.5 font-mono text-ink">{campaign?.adAccountId || "–"}</dd>
          </div>
        </dl>

        {campaign?.plan ? (
          <section aria-labelledby="cmp-plan-title" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="cmp-plan-title" className="text-[17px] font-medium tracking-[-0.02em] text-ink">
                Plan
              </h3>
              {canPlan && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    navigate("assistant", { agent: "meta_campaign", ref: `campaign:${campaign.id}`, tab: null });
                    onClose();
                  }}
                >
                  <PenLine aria-hidden /> Plan again
                </button>
              )}
            </div>
            <CampaignPlanView plan={campaign.plan} />
          </section>
        ) : (
          campaign &&
          canPlan &&
          campaign.platform === "Meta" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-inset bg-lime-soft p-4">
              <p className="min-w-0 text-[13.5px] text-ink">No plan yet. The assistant can draft audiences, budget split and ad text for this campaign.</p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  navigate("assistant", { agent: "meta_campaign", ref: `campaign:${campaign.id}`, tab: null });
                  onClose();
                }}
              >
                <PenLine aria-hidden /> Plan with assistant
              </button>
            </div>
          )
        )}
      </div>
    </Sheet>
  );
}
