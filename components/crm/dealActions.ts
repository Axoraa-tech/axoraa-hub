"use client";

// Shared CRM helpers: contact links, the follow-up email, the deal-to-client prefill, the
// stage suggestion after a visit, and the one stage-move routine used by the board, the
// table, the deal sheet and the visit editor (save, toast with Undo, the Won flow).
import { useSyncExternalStore } from "react";
import { STAGE_ORDER } from "@/lib/analytics";
import { clientFacingEmail, signature, type EmailDraft } from "@/lib/company";
import { normalizeIndianPhone, todayKeyIST } from "@/lib/format";
import { useHub } from "@/lib/hub/context";
import { can } from "@/lib/hub/permissions";
import { FOUNDER_NAMES } from "@/lib/people";
import type { HubSettings } from "@/lib/settings";
import type { ClientMasterRecord, InteractionOutcome, LeadStageStatus, MarketingDeal } from "@/lib/types";
import { useConfirm, useToast } from "@/components/ui/feedback";

/* ------------------------------------------------------------------ contact links */

/** tel: link for any number with at least 6 digits, otherwise null. */
export function telHref(phone: string | null | undefined): string | null {
  const raw = String(phone ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 6) return null;
  const normalized = normalizeIndianPhone(raw);
  return `tel:${normalized ? `+${normalized}` : raw.replace(/[^\d+]/g, "")}`;
}

/** wa.me link for a valid Indian mobile number, otherwise null. */
export function whatsappHref(phone: string | null | undefined, text?: string): string | null {
  const n = normalizeIndianPhone(phone);
  if (!n) return null;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** The saved Google Maps link, or a Maps search on the address. Null when there is nothing to search. */
export function mapsHref(d: Pick<MarketingDeal, "googleMapsLink" | "officeAddress" | "city" | "stateRegion" | "companyName">): string | null {
  const link = (d.googleMapsLink ?? "").trim();
  if (/^https?:\/\//i.test(link)) return link;
  const parts = [d.officeAddress, d.city, d.stateRegion].map((s) => (s ?? "").trim()).filter(Boolean);
  if (!parts.length) return null;
  const q = [d.companyName, ...parts].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function firstName(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

/** The deal email: to the contact, cc the company's client-facing address, signed by the viewer. */
export function dealEmailDraft(deal: MarketingDeal, settings: HubSettings, senderName: string): EmailDraft {
  const hello = firstName(deal.contactPerson);
  const opening = hello ? `Hi ${hello},\n\n` : "";
  const action = (deal.followUpAction ?? "").trim();
  return {
    to: (deal.emailAddress ?? "").trim(),
    cc: clientFacingEmail(settings.company),
    subject: `Axoraa: ${deal.companyName}`,
    body: `${opening}${action}\n\n${signature(settings.company, senderName)}`,
  };
}

/** A short WhatsApp opener. */
export function dealWhatsappText(deal: MarketingDeal, senderName: string): string {
  const hello = firstName(deal.contactPerson);
  const who = senderName && senderName !== "Administrator" ? `${senderName} from Axoraa` : "the Axoraa team";
  return `${hello ? `Hi ${hello}, ` : "Hi, "}this is ${who}. ${(deal.followUpAction ?? "").trim() || "Following up on our conversation."}`.trim();
}

/** Valid-looking email address (blank counts as valid; required-ness is checked separately). */
export function isEmailOk(v: string | null | undefined): boolean {
  const s = (v ?? "").trim();
  return !s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/* ------------------------------------------------------------------ deal to client */

export function clientPrefillFromDeal(deal: MarketingDeal, todayKey: string): Partial<ClientMasterRecord> {
  return {
    companyName: deal.companyName,
    industry: deal.industry,
    salesOwner: FOUNDER_NAMES.includes(deal.marketingPerson) ? deal.marketingPerson : "",
    dealValue: deal.estimatedDealValue,
    dealStatus: "Won",
    contractScope: deal.clientRequirements,
    contactPerson: deal.contactPerson,
    contactEmail: deal.emailAddress,
    contactPhone: deal.phoneNumber,
    sourceDealId: deal.id,
    signedDate: todayKey,
  };
}

/* ------------------------------------------------------------------ stages */

export const STAGE_SHORT: Record<LeadStageStatus, string> = {
  "New Lead": "New lead",
  Contacted: "Contacted",
  "Meeting Scheduled": "Meeting",
  "Demo Completed": "Demo done",
  "Proposal Sent": "Proposal",
  Negotiation: "Negotiation",
  "Closed Won": "Won",
  "Closed Lost": "Lost",
  "On Hold": "On hold",
};

/** The forward path a deal normally takes. */
const PROGRESSION: LeadStageStatus[] = ["New Lead", "Contacted", "Meeting Scheduled", "Demo Completed", "Proposal Sent", "Negotiation", "Closed Won"];

/**
 * The stage a visit outcome points to, or null when it suggests nothing new. Never moves a deal
 * backwards, and never touches a closed deal.
 */
export function stageForOutcome(outcome: InteractionOutcome | string, current: LeadStageStatus): LeadStageStatus | null {
  if (current === "Closed Won" || current === "Closed Lost") return null;
  const at = PROGRESSION.indexOf(current);
  let target: LeadStageStatus | null = null;
  if (outcome === "Proposal Requested") target = "Proposal Sent";
  else if (outcome === "Needs Demo") target = "Meeting Scheduled";
  else if (outcome === "Closed - Lost") return "Closed Lost";
  else if (outcome === "Positive - Advancing") target = at >= 0 && at < PROGRESSION.length - 1 ? PROGRESSION[at + 1] : current === "On Hold" ? "Contacted" : null;
  if (!target || target === current) return null;
  const ti = PROGRESSION.indexOf(target);
  if (at >= 0 && ti <= at) return null;
  return target;
}

export const ALL_STAGES = STAGE_ORDER;

/* ------------------------------------------------------------------ moving a deal */

/**
 * Moves a deal to a stage: saves it, toasts with Undo and runs the Won flow (offer to create the
 * client record when the viewer may, or explain who will). Sets conversionDate on Won.
 */
export function useDealMover() {
  const { data, all, viewer, openOverlay } = useHub();
  const toast = useToast();
  const confirm = useConfirm();

  return async function move(deal: MarketingDeal, stage: LeadStageStatus): Promise<boolean> {
    if (deal.leadStatus === stage) return true;
    const company = deal.companyName || "the deal";
    const before: Partial<MarketingDeal> = { leadStatus: deal.leadStatus, conversionDate: deal.conversionDate ?? "" };
    const patch: Partial<MarketingDeal> = { leadStatus: stage };
    const today = todayKeyIST();
    if (stage === "Closed Won") patch.conversionDate = today;

    const res = await data.saveDeal(patch, deal.id);
    const undo = {
      label: "Undo",
      onClick: () => {
        void data.saveDeal(before, deal.id).then((r) => {
          toast(r.ok ? { message: `Moved ${company} back to ${deal.leadStatus}` } : { message: "Couldn't undo in Google Sheets. The change is kept on this device.", tone: "negative" });
        });
      },
    };
    if (!res.ok) {
      toast({ message: `Moved ${company} to ${stage}. Not saved to Google Sheets yet; it is kept on this device.`, tone: "negative", action: undo });
    }

    if (stage === "Closed Won") {
      const hasClient = all.clients.some((c) => c.sourceDealId === deal.id) || data.clients.some((c) => c.sourceDealId === deal.id);
      if (!can(viewer, "client.edit")) {
        if (res.ok) toast({ message: `Moved ${company} to Won. The administrator will create the client record.`, tone: "positive", action: undo });
        return res.ok;
      }
      if (res.ok) toast({ message: `Moved ${company} to Closed Won`, tone: "positive", action: undo });
      if (!hasClient) {
        const yes = await confirm({
          title: `Create a client record for ${company}?`,
          body: "The client form opens with the contact, value and scope from this deal filled in.",
          confirmLabel: "Create client",
          cancelLabel: "Not now",
        });
        if (yes) openOverlay({ kind: "client", prefill: clientPrefillFromDeal({ ...deal, ...patch } as MarketingDeal, today) });
      }
      return res.ok;
    }

    if (res.ok) toast({ message: `Moved ${company} to ${stage}`, action: undo });
    return res.ok;
  };
}

/* ------------------------------------------------------------------ layout */

const MD_QUERY = "(max-width: 767.98px)";

function subscribeMd(cb: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(MD_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** True below the md breakpoint (phones). False during server render. */
export function useBelowMd(): boolean {
  return useSyncExternalStore(
    subscribeMd,
    () => (typeof window !== "undefined" && !!window.matchMedia ? window.matchMedia(MD_QUERY).matches : false),
    () => false
  );
}

/** Deal fields the deal form edits. Stage, owner, quote and derived fields are left out on purpose. */
export const DEAL_FORM_KEYS = [
  "companyName",
  "industry",
  "contactPerson",
  "designation",
  "phoneNumber",
  "emailAddress",
  "isDecisionMaker",
  "decisionMakerDetails",
  "officeAddress",
  "city",
  "stateRegion",
  "googleMapsLink",
  "leadSource",
  "campaignId",
  "clientRequirements",
  "solutionsPitched",
  "budgetSpecified",
  "estimatedDealValue",
  "demoRequired",
  "proposalSent",
  "proposalValue",
  "initialVisitDate",
  "visitType",
  "nextFollowUpDate",
  "followUpAction",
  "followUpPriority",
  "notesNextSteps",
] as const satisfies readonly (keyof MarketingDeal)[];

export type DealFormKey = (typeof DEAL_FORM_KEYS)[number];
export type DealDraft = Pick<MarketingDeal, DealFormKey>;

export function draftFromDeal(d: Partial<MarketingDeal>): DealDraft {
  return {
    companyName: d.companyName ?? "",
    industry: d.industry ?? "",
    contactPerson: d.contactPerson ?? "",
    designation: d.designation ?? "",
    phoneNumber: d.phoneNumber ?? "",
    emailAddress: d.emailAddress ?? "",
    isDecisionMaker: !!d.isDecisionMaker,
    decisionMakerDetails: d.decisionMakerDetails ?? "",
    officeAddress: d.officeAddress ?? "",
    city: d.city ?? "",
    stateRegion: d.stateRegion ?? "",
    googleMapsLink: d.googleMapsLink ?? "",
    leadSource: d.leadSource ?? "",
    campaignId: d.campaignId ?? "",
    clientRequirements: d.clientRequirements ?? "",
    solutionsPitched: d.solutionsPitched ?? "",
    budgetSpecified: Number(d.budgetSpecified) || 0,
    estimatedDealValue: Number(d.estimatedDealValue) || 0,
    demoRequired: d.demoRequired ?? "Not Needed",
    proposalSent: !!d.proposalSent,
    proposalValue: Number(d.proposalValue) || 0,
    initialVisitDate: d.initialVisitDate ?? "",
    visitType: d.visitType ?? "",
    nextFollowUpDate: d.nextFollowUpDate ?? "",
    followUpAction: d.followUpAction ?? "",
    followUpPriority: d.followUpPriority ?? "Medium",
    notesNextSteps: d.notesNextSteps ?? "",
  };
}

export interface FieldError {
  field: string;
  message: string;
}

/** Field ids are `deal-<key>` so the error summary can focus them. */
export function validateDealDraft(d: DealDraft): FieldError[] {
  const out: FieldError[] = [];
  if (!d.companyName.trim()) out.push({ field: "deal-companyName", message: "Enter the company name" });
  if (!(Number(d.estimatedDealValue) >= 0)) out.push({ field: "deal-estimatedDealValue", message: "Deal value can't be negative" });
  if (!isEmailOk(d.emailAddress)) out.push({ field: "deal-emailAddress", message: "Check the email address, for example name@company.com" });
  return out;
}
