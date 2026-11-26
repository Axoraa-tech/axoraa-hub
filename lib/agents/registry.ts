// Adding an agent: one AGENT_CATALOG entry in lib/agents/catalog.ts, one AGENT_DEFS entry here, and one prompt block in prompts.ts.
//
// How each agent is run: its input schema, the structured-output schema the model writes to (none for
// the Markdown brief), effort, token limit, web search, and the conversion into an AgentOutput.
// Server-safe and secret-free; the client imports the input schemas through schemas.ts only.
import type * as z from "zod/v4";
import type { ChannelId } from "@/lib/integrations/types";
import type { CampaignPlan, MarketingDeal, MarketingInteraction } from "@/lib/types";
import {
  campaignPlanOutput,
  INPUT_SCHEMAS,
  messageOutput,
  pipelineReviewOutput,
  proposalOutput,
  socialPostsOutput,
  visitNotesOutput,
} from "./schemas";
import type { AgentKey, AgentOutput, AgentOutputKind, EmailDraft } from "./types";

export type AgentEffort = "low" | "medium" | "high";
export type AgentSource = { title: string; url: string };

export interface AgentDef {
  key: AgentKey;
  inputSchema: z.ZodType;
  /** Structured output the model writes. Absent for Markdown agents (prospect_brief). */
  outputSchema?: z.ZodType;
  effort: AgentEffort;
  maxTokens: number;
  webSearch: boolean;
  outputKind: AgentOutputKind;
  /** First progress line shown while the agent runs. */
  statusMessage: string;
  /** Parsed structured output (or the Markdown text) plus web citations → the stored AgentOutput. */
  toOutput(parsedOrText: unknown, citations: AgentSource[]): AgentOutput;
}

/* ------------------------------------------------------------------ helpers */

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(text).filter(Boolean) : []);
const num = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};
const day = (v: unknown): string | undefined => {
  const s = text(v);
  return DAY.test(s) ? s : undefined;
};
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

function email(v: unknown): EmailDraft | undefined {
  const o = obj(v);
  const subject = text(o.subject);
  const body = typeof o.body === "string" ? o.body.trim() : "";
  return subject || body ? { subject, body } : undefined;
}

function toMessage(parsed: unknown): AgentOutput {
  const o = obj(parsed);
  const out: AgentOutput = { kind: "message" };
  const e = email(o.email);
  if (e) out.email = e;
  const wa = typeof o.whatsapp === "string" ? o.whatsapp.trim() : "";
  if (wa) out.whatsapp = wa;
  const points = list(o.callPoints);
  if (points.length) out.callPoints = points;
  return out;
}

const CHANNELS: readonly ChannelId[] = ["facebook_page", "instagram", "linkedin"];

/* ------------------------------------------------------------------ definitions */

export const AGENT_DEFS: Record<AgentKey, AgentDef> = {
  follow_up: {
    key: "follow_up",
    inputSchema: INPUT_SCHEMAS.follow_up,
    outputSchema: messageOutput,
    effort: "medium",
    maxTokens: 16000,
    webSearch: false,
    outputKind: "message",
    statusMessage: "Reading the deal and its recent visits",
    toOutput: (parsed) => toMessage(parsed),
  },

  visit_notes: {
    key: "visit_notes",
    inputSchema: INPUT_SCHEMAS.visit_notes,
    outputSchema: visitNotesOutput,
    effort: "low",
    maxTokens: 16000,
    webSearch: false,
    outputKind: "visit_notes",
    statusMessage: "Sorting the notes into a visit record",
    toOutput: (parsed) => {
      const o = obj(parsed);
      const f = obj(o.fields);
      const fields: Partial<MarketingInteraction> = {};
      for (const k of [
        "interactionType",
        "meetingMode",
        "personsMet",
        "designation",
        "agenda",
        "discussionFeedback",
        "demoRequired",
        "interestLevel",
        "interactionOutcome",
        "actionItemsAgreed",
        "nextSteps",
        "followUpPriority",
      ] as const) {
        const v = text(f[k]);
        if (v) (fields as Record<string, unknown>)[k] = v;
      }
      const date = day(f.date);
      if (date) fields.date = date;
      const next = day(f.nextFollowUpDate);
      if (next) fields.nextFollowUpDate = next;
      fields.probabilityPct = Math.round(num(f.probabilityPct, 0, 100));

      const p = obj(o.dealPatch);
      const dealPatch: Partial<MarketingDeal> = {};
      const stage = text(p.leadStatus);
      if (stage && stage !== "No change") dealPatch.leadStatus = stage as MarketingDeal["leadStatus"];
      const pNext = day(p.nextFollowUpDate);
      if (pNext) dealPatch.nextFollowUpDate = pNext;
      if (text(p.followUpAction)) dealPatch.followUpAction = text(p.followUpAction);
      if (text(p.followUpPriority)) dealPatch.followUpPriority = text(p.followUpPriority) as MarketingDeal["followUpPriority"];
      if (text(p.notesNextSteps)) dealPatch.notesNextSteps = text(p.notesNextSteps);

      const out: AgentOutput = { kind: "visit_notes", fields };
      if (Object.keys(dealPatch).length) out.dealPatch = dealPatch;
      const recap = email(o.recapEmail);
      if (recap) out.recapEmail = recap;
      return out;
    },
  },

  prospect_brief: {
    key: "prospect_brief",
    inputSchema: INPUT_SCHEMAS.prospect_brief,
    effort: "high",
    maxTokens: 32000,
    webSearch: true,
    outputKind: "brief",
    statusMessage: "Planning the research",
    toOutput: (textOut, citations) => {
      const seen = new Set<string>();
      const sources: AgentSource[] = [];
      for (const c of citations) {
        if (!/^https?:\/\//i.test(c.url) || seen.has(c.url)) continue;
        seen.add(c.url);
        sources.push({ title: c.title || c.url, url: c.url });
      }
      return { kind: "brief", markdown: typeof textOut === "string" ? textOut.trim() : "", sources: sources.slice(0, 20) };
    },
  },

  proposal_outline: {
    key: "proposal_outline",
    inputSchema: INPUT_SCHEMAS.proposal_outline,
    outputSchema: proposalOutput,
    effort: "high",
    maxTokens: 32000,
    webSearch: false,
    outputKind: "proposal",
    statusMessage: "Reading the deal's requirements",
    toOutput: (parsed) => {
      const o = obj(parsed);
      const milestones = (Array.isArray(o.milestones) ? o.milestones : []).map((m) => {
        const r = obj(m);
        return { name: text(r.name) || "Milestone", deliverables: list(r.deliverables), weeks: Math.round(num(r.weeks, 0, 520)), percent: num(r.percent, 0, 100) };
      });
      // Make the billing split add up to exactly 100.
      const total = milestones.reduce((s, m) => s + m.percent, 0);
      if (milestones.length && total > 0 && Math.abs(total - 100) > 0.01) {
        let acc = 0;
        milestones.forEach((m, i) => {
          if (i === milestones.length - 1) m.percent = Math.max(0, 100 - acc);
          else {
            m.percent = Math.round((m.percent / total) * 100);
            acc += m.percent;
          }
        });
      }
      const pb = obj(o.priceBand);
      const low = Math.round(num(pb.lowInr));
      const high = Math.round(num(pb.highInr));
      const out: AgentOutput = {
        kind: "proposal",
        summary: text(o.summary),
        scope: list(o.scope),
        outOfScope: list(o.outOfScope),
        milestones,
        assumptions: list(o.assumptions),
      };
      if (low > 0 || high > 0) out.priceBand = { lowInr: Math.min(low, high || low), highInr: Math.max(low, high), note: text(pb.note) };
      return out;
    },
  },

  social_posts: {
    key: "social_posts",
    inputSchema: INPUT_SCHEMAS.social_posts,
    outputSchema: socialPostsOutput,
    effort: "medium",
    maxTokens: 16000,
    webSearch: false,
    outputKind: "social_posts",
    statusMessage: "Planning the calendar",
    toOutput: (parsed) => {
      const o = obj(parsed);
      const posts = (Array.isArray(o.posts) ? o.posts : [])
        .map((p) => {
          const r = obj(p);
          const channel = CHANNELS.includes(r.channel as ChannelId) ? (r.channel as ChannelId) : null;
          const date = day(r.date);
          const caption = typeof r.caption === "string" ? r.caption.trim() : "";
          if (!channel || !date || !caption) return null;
          const post: Extract<AgentOutput, { kind: "social_posts" }>["posts"][number] = {
            channel,
            date,
            caption,
            hashtags: list(r.hashtags).map((h) => h.replace(/^#+/, "").replace(/\s+/g, "")).filter(Boolean),
            imageBrief: text(r.imageBrief),
          };
          if (text(r.cta)) post.cta = text(r.cta);
          return post;
        })
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .sort((a, b) => a.date.localeCompare(b.date));
      return { kind: "social_posts", posts };
    },
  },

  meta_campaign: {
    key: "meta_campaign",
    inputSchema: INPUT_SCHEMAS.meta_campaign,
    outputSchema: campaignPlanOutput,
    effort: "high",
    maxTokens: 32000,
    webSearch: false,
    outputKind: "campaign_plan",
    statusMessage: "Working out the budget and audiences",
    toOutput: (parsed) => {
      const p = obj(obj(parsed).plan);
      const b = obj(p.budget);
      const k = obj(p.kpis);
      const plan: CampaignPlan = {
        name: text(p.name) || "Meta campaign",
        objective: text(p.objective),
        budget: {
          dailyInr: Math.round(num(b.dailyInr)),
          totalInr: Math.round(num(b.totalInr)),
          split: (Array.isArray(b.split) ? b.split : []).map((s) => ({ label: text(obj(s).label), percent: num(obj(s).percent, 0, 100) })).filter((s) => s.label),
        },
        audiences: (Array.isArray(p.audiences) ? p.audiences : []).map((a) => {
          const r = obj(a);
          const ageMin = Math.round(num(r.ageMin, 18, 65));
          return {
            name: text(r.name) || "Audience",
            locations: list(r.locations),
            ageMin,
            ageMax: Math.max(ageMin, Math.round(num(r.ageMax, 18, 65))),
            interests: list(r.interests),
            notes: text(r.notes),
          };
        }),
        creatives: (Array.isArray(p.creatives) ? p.creatives : []).map((c) => {
          const r = obj(c);
          return { primaryText: text(r.primaryText), headline: text(r.headline), description: text(r.description), cta: text(r.cta), imageBrief: text(r.imageBrief) };
        }),
        leadFormQuestions: list(p.leadFormQuestions),
        kpis: { targetCplInr: Math.round(num(k.targetCplInr)), expectedLeads: Math.round(num(k.expectedLeads)) },
        notes: text(p.notes),
      };
      return { kind: "campaign_plan", plan };
    },
  },

  pipeline_review: {
    key: "pipeline_review",
    inputSchema: INPUT_SCHEMAS.pipeline_review,
    outputSchema: pipelineReviewOutput,
    effort: "medium",
    maxTokens: 16000,
    webSearch: false,
    outputKind: "pipeline_review",
    statusMessage: "Looking for deals that have gone quiet",
    toOutput: (parsed) => {
      const o = obj(parsed);
      const deals = (Array.isArray(o.deals) ? o.deals : [])
        .map((d) => {
          const r = obj(d);
          const risk = r.risk === "high" || r.risk === "medium" || r.risk === "low" ? r.risk : "medium";
          const row: Extract<AgentOutput, { kind: "pipeline_review" }>["deals"][number] = {
            dealId: text(r.dealId),
            company: text(r.company),
            risk,
            reason: text(r.reason),
            nextAction: text(r.nextAction),
          };
          const f = day(r.followUpDate);
          if (f) row.followUpDate = f;
          return row;
        })
        .filter((d) => d.dealId);
      return { kind: "pipeline_review", summary: text(o.summary), deals };
    },
  },

  payment_reminder: {
    key: "payment_reminder",
    inputSchema: INPUT_SCHEMAS.payment_reminder,
    outputSchema: messageOutput,
    effort: "low",
    maxTokens: 16000,
    webSearch: false,
    outputKind: "message",
    statusMessage: "Reading the invoice and what has been paid",
    toOutput: (parsed) => toMessage(parsed),
  },
};
