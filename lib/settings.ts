// Hub-wide settings: company profile, pipeline, work and assistant defaults. Isomorphic.
import { DEFAULT_COMPANY, resolveCompany, type CompanyProfile } from "./company";
import type { LeadSource, LeadStageStatus, WorkType } from "./types";
import type { AgentKey } from "./agents/types";

export interface MetaLeadAssignment {
  mode: "admin" | "rep" | "alternate";
  rep?: string;
}

export interface AssistantPricing {
  inputUsdPerMTok: number;
  outputUsdPerMTok: number;
  usdToInr: number;
}

export interface HubSettings {
  id: "settings";
  company: CompanyProfile;
  stageProbabilities: Record<LeadStageStatus, number>;
  leadSources: string[];
  projects: string[];
  workTypes: string[];
  weeklyHoursTarget: number;
  followUpDefaultDays: number;
  disabledAgents: AgentKey[];
  metaLeadAssignment: MetaLeadAssignment;
  assistantPricing: AssistantPricing;
  updatedAt: string;
  updatedBy?: string;
}

export const DEFAULT_STAGE_PROBABILITIES: Record<LeadStageStatus, number> = {
  "New Lead": 0.1,
  Contacted: 0.15,
  "Meeting Scheduled": 0.25,
  "Demo Completed": 0.4,
  "Proposal Sent": 0.55,
  Negotiation: 0.75,
  "Closed Won": 1,
  "Closed Lost": 0,
  "On Hold": 0.1,
};

// Records keyed by the union make the compiler check that every value is listed.
const LEAD_SOURCE_SET: Record<LeadSource, true> = {
  "Website / Inbound": true,
  "Field Visit / Direct Walk-in": true,
  Referral: true,
  "LinkedIn / Outreach": true,
  "Exhibition / Event": true,
  "Cold Call": true,
  "Meta Lead Ad": true,
};
const WORK_TYPE_SET: Record<WorkType, true> = {
  "Authentication / Authorization": true,
  Refactoring: true,
  Database: true,
  "Bug Fix / UI Enhancement": true,
  "DevOps / Infrastructure": true,
  "UI/UX Improvement": true,
  "API Integration": true,
  "New Feature": true,
  "Feature Enhancement": true,
};

/** Every LeadSource value, in display order. */
export const LEAD_SOURCES = Object.keys(LEAD_SOURCE_SET) as LeadSource[];
/** Every WorkType value, in display order. */
export const WORK_TYPES = Object.keys(WORK_TYPE_SET) as WorkType[];

const AGENT_KEYS: Record<AgentKey, true> = {
  follow_up: true,
  visit_notes: true,
  prospect_brief: true,
  proposal_outline: true,
  social_posts: true,
  meta_campaign: true,
  pipeline_review: true,
  payment_reminder: true,
};

export const DEFAULT_SETTINGS: HubSettings = {
  id: "settings",
  company: DEFAULT_COMPANY,
  stageProbabilities: DEFAULT_STAGE_PROBABILITIES,
  leadSources: [...LEAD_SOURCES],
  projects: ["SeekFactory", "Seek factory APK", "Marketing Operations", "Client Accounts"],
  workTypes: [...WORK_TYPES],
  weeklyHoursTarget: 40,
  followUpDefaultDays: 3,
  disabledAgents: [],
  metaLeadAssignment: { mode: "admin" },
  assistantPricing: { inputUsdPerMTok: 4, outputUsdPerMTok: 20, usdToInr: 85 },
  updatedAt: "",
};

// Settings rows from the sheet may carry JSON as text; accept both.
function maybeJson(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return v;
  try {
    return JSON.parse(t);
  } catch {
    return v;
  }
}

function stringList(v: unknown, fallback: string[]): string[] {
  const parsed = maybeJson(v);
  if (!Array.isArray(parsed)) return [...fallback];
  const out = parsed.filter((s): s is string => typeof s === "string").map((s) => s.trim()).filter(Boolean);
  return [...new Set(out)];
}

function finiteNumber(v: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  const n = typeof v === "string" && v.trim() === "" ? NaN : Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

/** Deep-merges any stored or remote value onto DEFAULT_SETTINGS. Never throws. */
export function normalizeSettings(raw: unknown): HubSettings {
  const parsedRaw = maybeJson(raw);
  const src = (parsedRaw && typeof parsedRaw === "object" && !Array.isArray(parsedRaw) ? parsedRaw : {}) as Record<string, unknown>;
  try {
    const companyRaw = maybeJson(src.company);
    const probsRaw = maybeJson(src.stageProbabilities);
    const stageProbabilities = { ...DEFAULT_STAGE_PROBABILITIES };
    if (probsRaw && typeof probsRaw === "object") {
      for (const stage of Object.keys(DEFAULT_STAGE_PROBABILITIES) as LeadStageStatus[]) {
        stageProbabilities[stage] = finiteNumber((probsRaw as Record<string, unknown>)[stage], DEFAULT_STAGE_PROBABILITIES[stage], 0, 1);
      }
    }
    const disabled = stringList(src.disabledAgents, []).filter((k): k is AgentKey => k in AGENT_KEYS);

    const metaRaw = maybeJson(src.metaLeadAssignment);
    const metaObj = metaRaw && typeof metaRaw === "object" ? (metaRaw as Record<string, unknown>) : {};
    const mode = metaObj.mode === "rep" || metaObj.mode === "alternate" || metaObj.mode === "admin" ? metaObj.mode : "admin";
    const metaLeadAssignment: MetaLeadAssignment = { mode };
    if (typeof metaObj.rep === "string" && metaObj.rep.trim()) metaLeadAssignment.rep = metaObj.rep.trim();

    const priceRaw = maybeJson(src.assistantPricing);
    const priceObj = priceRaw && typeof priceRaw === "object" ? (priceRaw as Record<string, unknown>) : {};
    const d = DEFAULT_SETTINGS.assistantPricing;

    const leadSources = stringList(src.leadSources, DEFAULT_SETTINGS.leadSources);
    const projects = stringList(src.projects, DEFAULT_SETTINGS.projects);
    const workTypes = stringList(src.workTypes, DEFAULT_SETTINGS.workTypes);

    const out: HubSettings = {
      id: "settings",
      company: resolveCompany(companyRaw && typeof companyRaw === "object" ? (companyRaw as Partial<CompanyProfile>) : undefined),
      stageProbabilities,
      leadSources: leadSources.length ? leadSources : [...DEFAULT_SETTINGS.leadSources],
      projects: projects.length ? projects : [...DEFAULT_SETTINGS.projects],
      workTypes: workTypes.length ? workTypes : [...DEFAULT_SETTINGS.workTypes],
      weeklyHoursTarget: finiteNumber(src.weeklyHoursTarget, DEFAULT_SETTINGS.weeklyHoursTarget, 1, 168),
      followUpDefaultDays: Math.round(finiteNumber(src.followUpDefaultDays, DEFAULT_SETTINGS.followUpDefaultDays, 0, 365)),
      disabledAgents: [...new Set(disabled)],
      metaLeadAssignment,
      assistantPricing: {
        inputUsdPerMTok: finiteNumber(priceObj.inputUsdPerMTok, d.inputUsdPerMTok, 0),
        outputUsdPerMTok: finiteNumber(priceObj.outputUsdPerMTok, d.outputUsdPerMTok, 0),
        usdToInr: finiteNumber(priceObj.usdToInr, d.usdToInr, 0.0001),
      },
      updatedAt: typeof src.updatedAt === "string" ? src.updatedAt : "",
    };
    if (typeof src.updatedBy === "string" && src.updatedBy) out.updatedBy = src.updatedBy;
    return out;
  } catch {
    return {
      ...DEFAULT_SETTINGS,
      company: resolveCompany(),
      stageProbabilities: { ...DEFAULT_STAGE_PROBABILITIES },
    };
  }
}
