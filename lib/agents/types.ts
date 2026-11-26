// Assistant (Claude) agent contracts shared by /api/agents, the Assistant view and stored drafts.
// Isomorphic: no directive, no browser globals.
import type { CompanyProfile, EmailDraft } from "@/lib/company";
import type { ChannelId } from "@/lib/integrations/types";
import type {
  Campaign,
  CampaignPlan,
  ClientMasterRecord,
  MarketingDeal,
  MarketingInteraction,
  PaymentBillingRecord,
} from "@/lib/types";

export type { EmailDraft };

export type AgentKey =
  | "follow_up"
  | "visit_notes"
  | "prospect_brief"
  | "proposal_outline"
  | "social_posts"
  | "meta_campaign"
  | "pipeline_review"
  | "payment_reminder";

export type AgentRole = "admin" | "founder" | "marketing";

export type AgentLanguage = "en" | "kn" | "hi";

export type AgentRefType = "deal" | "visit" | "invoice" | "campaign" | "client";

export type AgentRef = { type: AgentRefType; id: string };

export type AgentUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  webSearches?: number;
};

export type AgentOutput =
  | { kind: "message"; email?: EmailDraft; whatsapp?: string; callPoints?: string[] }
  | {
      kind: "visit_notes";
      fields: Partial<MarketingInteraction>;
      dealPatch?: Partial<MarketingDeal>;
      recapEmail?: EmailDraft;
    }
  | { kind: "brief"; markdown: string; sources: { title: string; url: string }[] }
  | {
      kind: "proposal";
      summary: string;
      scope: string[];
      outOfScope: string[];
      milestones: { name: string; deliverables: string[]; weeks: number; percent: number }[];
      assumptions: string[];
      priceBand?: { lowInr: number; highInr: number; note: string };
    }
  | {
      kind: "social_posts";
      posts: {
        channel: ChannelId;
        date: string;
        caption: string;
        hashtags: string[];
        imageBrief: string;
        cta?: string;
      }[];
    }
  | { kind: "campaign_plan"; plan: CampaignPlan }
  | {
      kind: "pipeline_review";
      summary: string;
      deals: {
        dealId: string;
        company: string;
        risk: "high" | "medium" | "low";
        reason: string;
        nextAction: string;
        followUpDate?: string;
      }[];
    };

export type AgentOutputKind = AgentOutput["kind"];

export type AgentErrorCode =
  | "not_configured"
  | "unauthorized"
  | "forbidden"
  | "disabled"
  | "bad_input"
  | "not_found"
  | "rate_limited"
  | "refused"
  | "timeout"
  | "upstream";

export type AgentRunEvent =
  | { type: "status"; message: string }
  | { type: "thinking"; text: string }
  | { type: "text"; text: string }
  | { type: "search"; query: string }
  | { type: "result"; output: AgentOutput; model: string; usage: AgentUsage }
  | { type: "error"; code: AgentErrorCode; message: string };

/** Maximum length of a revision instruction. */
export const REVISE_INSTRUCTION_MAX = 500;

export interface AgentRunRequest {
  input: Record<string, unknown>;
  ref?: AgentRef;
  language?: AgentLanguage;
  revise?: { previous: AgentOutput; instruction: string };
  /**
   * Records the browser already holds. Honoured ONLY when the server's script version is not 2;
   * in shared mode the server loads records by ref and reads Settings itself.
   */
  context?: {
    deal?: MarketingDeal;
    visits?: MarketingInteraction[];
    deals?: MarketingDeal[];
    invoice?: PaymentBillingRecord;
    client?: ClientMasterRecord;
    campaign?: Campaign;
  };
  /** Same rule as context. */
  company?: Partial<CompanyProfile>;
}

/**
 * Wire format of POST /api/agents/[key]: Server-Sent Events.
 * Each event is `data: ${JSON.stringify(AgentRunEvent)}\n\n`, a `: ping\n\n` comment every 15s,
 * and the stream ends after a 'result' or 'error' event.
 */
export function encodeAgentEvent(e: AgentRunEvent): string {
  return `data: ${JSON.stringify(e)}\n\n`;
}
