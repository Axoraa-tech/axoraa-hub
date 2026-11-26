import "server-only";

// Writes a Meta lead into the shared Deals tab. The id is deterministic (deal_meta_<leadgen_id>) and the
// write is insert-only, so a lead delivered twice (webhook retry, catch-up) is stored once.
import type { Lead } from "@/lib/integrations/types";
import type { ActivityEvent, MarketingDeal } from "@/lib/types";
import { newId, nowISO, todayKeyIST } from "@/lib/format";
import { MARKETING_NAMES } from "@/lib/people";
import { normalizeSettings, type MetaLeadAssignment } from "@/lib/settings";
import { sequencesFor } from "@/lib/data/sequences";
import { listAll, upsertRow } from "@/lib/server/sheets";
import { leadToDeal } from "./leads";

/** Stable, stateless spread across the marketing team (FNV-1a over the lead id). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function assigneeFor(rule: MetaLeadAssignment, leadId: string, team: readonly string[] = MARKETING_NAMES): string {
  if (rule.mode === "rep") return rule.rep && team.includes(rule.rep) ? rule.rep : "";
  if (rule.mode === "alternate") return team.length ? team[hash(leadId) % team.length] : "";
  return "";
}

const BLANK_DEAL: Omit<MarketingDeal, "id" | "marketingPerson"> = {
  leadId: "",
  dateAdded: "",
  companyName: "",
  industry: "",
  contactPerson: "",
  designation: "",
  phoneNumber: "",
  emailAddress: "",
  officeAddress: "",
  city: "",
  stateRegion: "",
  googleMapsLink: "",
  leadSource: "Meta Lead Ad",
  initialVisitDate: "",
  lastInteractionDate: "",
  visitType: "",
  isDecisionMaker: false,
  decisionMakerDetails: "",
  clientRequirements: "",
  solutionsPitched: "",
  budgetSpecified: 0,
  estimatedDealValue: 0,
  weightedValue: 0,
  demoRequired: "Not Needed",
  proposalSent: false,
  proposalValue: 0,
  leadStatus: "New Lead",
  nextFollowUpDate: "",
  followUpAction: "Call the lead",
  followUpPriority: "High",
  followUpStatus: "Pending",
  daysSinceLastVisit: 0,
  dueStatus: "Today",
  notesNextSteps: "",
};

export async function ingestLead(lead: Lead): Promise<"created" | "skipped"> {
  const data = await listAll();
  const settingsRow = (data.settings ?? []).find((r) => r.id === "settings") ?? data.settings?.[0];
  const settings = normalizeSettings(settingsRow);
  const today = todayKeyIST();
  const now = nowISO();
  const marketingPerson = assigneeFor(settings.metaLeadAssignment, lead.externalId);
  const id = `deal_meta_${lead.externalId}`;

  const deal: MarketingDeal = {
    ...BLANK_DEAL,
    ...leadToDeal(lead, today),
    id,
    marketingPerson,
    createdAt: now,
    updatedAt: now,
    createdBy: "system",
    ...(marketingPerson ? { assignedAt: now } : {}),
  } as MarketingDeal;

  const activity: ActivityEvent = {
    id: newId("act"),
    at: now,
    actorId: "system",
    actorName: "Meta Lead Ads",
    action: "meta.lead_received",
    entity: "deals",
    entityId: id,
    summary: "Meta lead received",
  };

  // upsertRow encodes the row itself (encodeRow), so the record is passed as-is.
  const res = await upsertRow("deals", deal, { mode: "insert_only", sequences: sequencesFor("deals", deal, today), activity });
  return res.skipped ? "skipped" : "created";
}
