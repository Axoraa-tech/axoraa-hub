import "server-only";

// Meta Lead Ads as a lead source. Answers are flattened into Lead.fields and turned into a deal by
// leadToDeal. Lead answers are personal data: they are never logged.
import type { IntegrationStatus, Lead, LeadSource } from "@/lib/integrations/types";
import type { MarketingDeal } from "@/lib/types";
import { formatDateIST, todayKeyIST } from "@/lib/format";
import { IntegrationNotConfiguredError } from "../errors";
import type { MetaConfig } from "./config";
import { getPageToken, graphFetch, isGraphId } from "./graph";

const LEAD_FIELDS = "created_time,field_data,ad_id,form_id,campaign_id";
const MAX_PAGES_PER_FORM = 20;

interface RawLead {
  id?: string;
  created_time?: string;
  field_data?: { name?: string; values?: unknown[] }[];
  ad_id?: string;
  form_id?: string;
  campaign_id?: string;
}

function flatten(raw: RawLead): Lead | null {
  if (!raw.id) return null;
  const fields: Record<string, string> = {};
  for (const f of raw.field_data ?? []) {
    if (!f || typeof f.name !== "string" || !f.name) continue;
    const values = (f.values ?? []).filter((v) => v !== null && v !== undefined).map((v) => String(v).trim()).filter(Boolean);
    fields[f.name] = values.join(", ");
  }
  const created = raw.created_time ? Date.parse(raw.created_time) : NaN;
  return {
    source: "meta_lead_ads",
    externalId: raw.id,
    createdAt: Number.isNaN(created) ? new Date().toISOString() : new Date(created).toISOString(),
    formId: raw.form_id,
    adId: raw.ad_id,
    campaignId: raw.campaign_id,
    fields,
  };
}

export class MetaLeadSource implements LeadSource {
  readonly id = "meta_lead_ads";
  constructor(private readonly config: MetaConfig) {}

  async status(): Promise<IntegrationStatus> {
    if (!this.config.webhookVerifyToken) return { state: "not_configured", missing: ["META_WEBHOOK_VERIFY_TOKEN"] };
    const n = this.config.leadgenFormIds.length;
    return {
      state: "connected",
      account: { id: this.config.pageId, name: n ? `${n} lead ${n === 1 ? "form" : "forms"} for catch-up` : "Webhook ready" },
    };
  }

  async fetchById(id: string): Promise<Lead | null> {
    if (!isGraphId(id)) return null;
    const token = await getPageToken();
    const { data } = await graphFetch<RawLead>(id, { params: { fields: LEAD_FIELDS }, token });
    return flatten({ ...data, id: data.id ?? id });
  }

  async fetchSince(sinceIso: string): Promise<Lead[]> {
    const since = Math.floor(Date.parse(sinceIso) / 1000);
    if (!Number.isFinite(since)) return [];
    const token = await getPageToken();
    const out: Lead[] = [];
    for (const form of this.config.leadgenFormIds) {
      if (!isGraphId(form)) continue;
      let after: string | undefined;
      for (let page = 0; page < MAX_PAGES_PER_FORM; page++) {
        const { data } = await graphFetch<{ data?: RawLead[]; paging?: { cursors?: { after?: string }; next?: string } }>(`${form}/leads`, {
          params: {
            fields: LEAD_FIELDS,
            limit: 100,
            filtering: JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: since }]),
            after,
          },
          token,
        });
        for (const raw of data.data ?? []) {
          const lead = flatten(raw);
          if (lead) out.push(lead);
        }
        after = data.paging?.next ? data.paging.cursors?.after : undefined;
        if (!after) break;
      }
    }
    return out;
  }
}

/** A lead source that is not connected. */
export class NotConnectedLeadSource implements LeadSource {
  readonly id = "meta_lead_ads";
  constructor(private readonly missing: string[]) {}
  async status(): Promise<IntegrationStatus> {
    return { state: "not_configured", missing: this.missing };
  }
  async fetchById(): Promise<Lead | null> {
    throw new IntegrationNotConfiguredError(this.missing, "Meta Lead Ads are not connected.");
  }
  async fetchSince(): Promise<Lead[]> {
    throw new IntegrationNotConfiguredError(this.missing, "Meta Lead Ads are not connected.");
  }
}

const MAPPED = new Set(["full_name", "first_name", "last_name", "email", "phone_number", "company_name", "city", "job_title"]);

function humanize(key: string): string {
  const s = key.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : key;
}

/** The deal fields for a Meta lead. Unmapped answers go into notesNextSteps as 'question: answer' lines. */
export function leadToDeal(lead: Lead, todayKey = todayKeyIST()): Partial<MarketingDeal> {
  const f = lead.fields;
  const name = f.full_name || [f.first_name, f.last_name].filter(Boolean).join(" ");
  const notes = Object.entries(f)
    .filter(([k, v]) => !MAPPED.has(k) && v)
    .map(([k, v]) => `${humanize(k)}: ${v}`);
  return {
    leadId: "",
    dateAdded: todayKey,
    contactPerson: name,
    emailAddress: f.email ?? "",
    phoneNumber: f.phone_number ?? "",
    companyName: f.company_name || `Meta lead ${formatDateIST(lead.createdAt)}`,
    city: f.city ?? "",
    designation: f.job_title ?? "",
    notesNextSteps: notes.join("\n"),
    leadSource: "Meta Lead Ad",
    externalSource: "meta_lead_ads",
    externalId: lead.externalId,
    formId: lead.formId,
    adId: lead.adId,
    campaignId: lead.campaignId,
    leadStatus: "New Lead",
    nextFollowUpDate: todayKey,
    followUpPriority: "High",
  };
}
