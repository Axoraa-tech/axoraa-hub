// Integration contracts shared by the Meta adapters, the integration routes and the Integrations view.
// Types plus two constant tables; isomorphic.

export type ChannelId = "facebook_page" | "instagram" | "linkedin";

export type IntegrationStatus =
  | { state: "not_configured"; missing: string[] }
  | { state: "connected"; account: { id: string; name: string }; tokenExpiresAt?: string }
  | { state: "error"; code?: number; message: string; at: string };

export interface PostDraft {
  text: string;
  link?: string;
  mediaUrls?: string[];
  /** ISO timestamp with a Z. */
  scheduledAt?: string;
}

export interface PublishResult {
  channel: ChannelId;
  externalId: string;
  permalink?: string;
  state: "published" | "scheduled" | "queued";
}

export interface InsightQuery {
  /** 'YYYY-MM-DD' or ISO. */
  since: string;
  until: string;
  metrics?: string[];
}

export interface InsightPoint {
  metric: string;
  date: string;
  value: number | null;
}

export interface ChannelCapabilities {
  nativeSchedule: boolean;
  maxPerDay?: number;
  imageFormats: string[];
}

export interface SocialChannel {
  readonly id: ChannelId;
  status(): Promise<IntegrationStatus>;
  capabilities(): ChannelCapabilities;
  publish(d: PostDraft): Promise<PublishResult>;
  schedule(d: PostDraft & { scheduledAt: string }): Promise<PublishResult>;
  insights(q: InsightQuery): Promise<InsightPoint[]>;
}

export interface Lead {
  source: "meta_lead_ads" | "website" | "manual" | "referral";
  externalId: string;
  createdAt: string;
  formId?: string;
  adId?: string;
  campaignId?: string;
  /** Form answers keyed by the field name Meta sends (full_name, phone_number, email, company_name, ...). */
  fields: Record<string, string>;
}

/** A source of inbound leads. Not to be confused with the LeadSource label type in lib/types.ts. */
export interface LeadSource {
  readonly id: string;
  status(): Promise<IntegrationStatus>;
  fetchById(id: string): Promise<Lead | null>;
  fetchSince(sinceIso: string): Promise<Lead[]>;
}

export type AdsLevel = "account" | "campaign" | "adset" | "ad";

export interface AdsSummaryRow {
  id: string;
  name: string;
  spendInr: number;
  impressions: number | null;
  clicks: number | null;
  leads: number | null;
}

export interface AdsReporter {
  status(): Promise<IntegrationStatus>;
  summary(q: InsightQuery & { level?: AdsLevel }): Promise<AdsSummaryRow[]>;
}

export const CHANNEL_LABEL: Record<ChannelId, string> = {
  facebook_page: "Facebook Page",
  instagram: "Instagram",
  linkedin: "LinkedIn",
};

export const CHANNEL_LIMITS: Record<
  ChannelId,
  { captionMax: number; nativeSchedule: boolean; imageFormats?: string[] }
> = {
  facebook_page: { captionMax: 63206, nativeSchedule: true },
  instagram: { captionMax: 2200, nativeSchedule: false, imageFormats: ["image/jpeg"] },
  linkedin: { captionMax: 3000, nativeSchedule: false },
};

export interface IntegrationsStatusResponse {
  sheets: { configured: boolean; version: 1 | 2 | null };
  assistant: { configured: boolean; model: string };
  meta: {
    page: IntegrationStatus;
    instagram: IntegrationStatus;
    leads: IntegrationStatus;
    ads: IntegrationStatus;
    publishEnabled: boolean;
    leadsEnabled: boolean;
    webhookPath: "/api/integrations/meta/webhook";
    tokenDaysLeft: number | null;
  };
}
