import "server-only";

// Loads the records an agent run may see.
//
// Shared mode (Apps Script v2): the browser's context and company are ignored. Records are loaded by
// req.ref through the foundation policy (getReadable / loadReadable), and Settings come from the
// Settings tab. A record that exists but is not readable is 403; one that does not exist is 404.
//
// Local mode: there is no server copy of the data. What the browser sends is the viewer's own browser
// data, so the server only checks that it is plausibly theirs (deals and visits owned by the viewer
// unless they are the administrator; invoices and clients from the administrator only).
import { resolveCompany } from "@/lib/company";
import { enrichDeal, OPEN_STAGES, visitLinksDeal } from "@/lib/analytics";
import type { PolicyViewer } from "@/lib/data/policy";
import type { RemoteEntity } from "@/lib/data/entities";
import { todayKeyIST } from "@/lib/format";
import { DEFAULT_SETTINGS, normalizeSettings, type HubSettings } from "@/lib/settings";
import { getReadable, loadReadable } from "@/lib/server/records";
import { getScriptVersion, listAll, SheetsError } from "@/lib/server/sheets";
import type { Campaign, ClientMasterRecord, MarketingDeal, MarketingInteraction, PaymentBillingRecord } from "@/lib/types";
import type { AgentContext } from "./prompts";
import type { AgentKey, AgentRunRequest } from "./types";

export type { AgentContext };

export class AgentContextError extends Error {
  constructor(
    public code: "forbidden" | "not_found" | "upstream",
    public status: 403 | 404 | 502,
    message: string
  ) {
    super(message);
    this.name = "AgentContextError";
  }
}

const STALE_DAYS = 14;
const MAX_REVIEW_DEALS = 80;
const MAX_VISITS = 3;

const same = (a: unknown, b: string) => typeof a === "string" && a.trim().toLowerCase() === b.trim().toLowerCase();

function isStale(d: MarketingDeal, todayKey: string): boolean {
  if (!OPEN_STAGES.includes(d.leadStatus)) return false;
  const overdue = !!d.nextFollowUpDate && d.nextFollowUpDate.slice(0, 10) < todayKey;
  return overdue || (Number(d.daysSinceLastVisit) || 0) >= STALE_DAYS;
}

/** Most stale first: overdue follow-ups by date, then longest silence. */
function staleOrder(a: MarketingDeal, b: MarketingDeal): number {
  const fa = a.nextFollowUpDate || "9999";
  const fb = b.nextFollowUpDate || "9999";
  if (fa !== fb) return fa.localeCompare(fb);
  return (Number(b.daysSinceLastVisit) || 0) - (Number(a.daysSinceLastVisit) || 0);
}

function recentVisits(visits: MarketingInteraction[], deal: MarketingDeal): MarketingInteraction[] {
  return visits
    .filter((v) => visitLinksDeal(v, deal))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, MAX_VISITS);
}

/* ------------------------------------------------------------------ shared mode */

async function existsAnywhere(entity: RemoteEntity, id: string): Promise<boolean> {
  const all = await listAll();
  return (all[entity] ?? []).some((r) => r.id === id);
}

async function readableOr404<T>(pv: PolicyViewer, entity: RemoteEntity, id: string, label: string): Promise<T> {
  const row = await getReadable(pv, entity, id);
  if (row) return row as unknown as T;
  if (await existsAnywhere(entity, id)) throw new AgentContextError("forbidden", 403, `That ${label} isn't available to you.`);
  throw new AgentContextError("not_found", 404, `That ${label} no longer exists.`);
}

async function loadShared(pv: PolicyViewer, key: AgentKey, req: AgentRunRequest, todayKey: string): Promise<AgentContext> {
  const settingsRows = await loadReadable(pv, "settings");
  const settings = normalizeSettings(settingsRows.find((r) => r.id === "settings") ?? settingsRows[0] ?? {});
  const ctx: AgentContext = { company: resolveCompany(settings.company), settings };
  const ref = req.ref;

  const enrich = async (deal: MarketingDeal, visits?: MarketingInteraction[]) => {
    const all = visits ?? ((await loadReadable(pv, "interactions")) as unknown as MarketingInteraction[]);
    return { deal: enrichDeal(deal, all, settings.stageProbabilities, todayKey), all };
  };

  if (ref?.type === "deal") {
    const raw = await readableOr404<MarketingDeal>(pv, "deals", ref.id, "deal");
    const { deal, all } = await enrich(raw);
    ctx.deal = deal;
    ctx.visits = recentVisits(all, deal);
  } else if (ref?.type === "visit") {
    const visit = await readableOr404<MarketingInteraction>(pv, "interactions", ref.id, "visit");
    ctx.visits = [visit];
    const deals = (await loadReadable(pv, "deals")) as unknown as MarketingDeal[];
    const linked = deals.find((d) => visitLinksDeal(visit, d));
    if (linked) ctx.deal = (await enrich(linked, [visit])).deal;
  } else if (ref?.type === "invoice") {
    ctx.invoice = await readableOr404<PaymentBillingRecord>(pv, "payments", ref.id, "invoice");
    const clients = (await loadReadable(pv, "clients")) as unknown as ClientMasterRecord[];
    ctx.client = clients.find((c) => c.clientId === ctx.invoice!.clientId);
  } else if (ref?.type === "campaign") {
    ctx.campaign = await readableOr404<Campaign>(pv, "campaigns", ref.id, "campaign");
  } else if (ref?.type === "client") {
    ctx.client = await readableOr404<ClientMasterRecord>(pv, "clients", ref.id, "client");
  }

  if (key === "pipeline_review") {
    const visits = (await loadReadable(pv, "interactions")) as unknown as MarketingInteraction[];
    const rep = typeof req.input.repName === "string" ? req.input.repName.trim() : "";
    const deals = ((await loadReadable(pv, "deals")) as unknown as MarketingDeal[])
      .map((d) => enrichDeal(d, visits, settings.stageProbabilities, todayKey))
      .filter((d) => (pv.category === "admin" && rep ? same(d.marketingPerson, rep) : true))
      .filter((d) => isStale(d, todayKey))
      .sort(staleOrder)
      .slice(0, MAX_REVIEW_DEALS);
    ctx.deals = deals;
  }
  return ctx;
}

/* ------------------------------------------------------------------ local mode */

function loadLocal(pv: PolicyViewer, key: AgentKey, req: AgentRunRequest, todayKey: string): AgentContext {
  const admin = pv.category === "admin";
  const c = req.context ?? {};
  const owns = (row: { marketingPerson?: unknown } | undefined) => !row || admin || same(row.marketingPerson, pv.name);

  if (c.deal && !owns(c.deal)) throw new AgentContextError("forbidden", 403, "That deal belongs to someone else.");
  for (const v of c.visits ?? []) if (!owns(v)) throw new AgentContextError("forbidden", 403, "One of those visits belongs to someone else.");
  for (const d of c.deals ?? []) if (!owns(d)) throw new AgentContextError("forbidden", 403, "Some of those deals belong to someone else.");
  if ((c.invoice || c.client) && !admin) throw new AgentContextError("forbidden", 403, "Only the administrator can draft from invoices and clients.");

  const settings: HubSettings = { ...DEFAULT_SETTINGS, company: resolveCompany(req.company) };
  const ctx: AgentContext = { company: settings.company, settings };
  if (c.deal) ctx.deal = c.deal;
  if (c.visits?.length) ctx.visits = c.visits.slice(0, MAX_VISITS);
  if (c.invoice) ctx.invoice = c.invoice;
  if (c.client) ctx.client = c.client;
  if (c.campaign) ctx.campaign = c.campaign;
  if (key === "pipeline_review") {
    const rep = typeof req.input.repName === "string" ? req.input.repName.trim() : "";
    ctx.deals = (c.deals ?? [])
      .filter((d) => (admin && rep ? same(d.marketingPerson, rep) : true))
      .filter((d) => isStale(d, todayKey))
      .sort(staleOrder)
      .slice(0, MAX_REVIEW_DEALS);
  }
  return ctx;
}

/** The records and company profile for one run. Throws AgentContextError (403, 404 or 502). */
export async function loadAgentContext(pv: PolicyViewer, key: AgentKey, req: AgentRunRequest): Promise<AgentContext> {
  const todayKey = todayKeyIST();
  const version = await getScriptVersion();
  if (version !== 2) return loadLocal(pv, key, req, todayKey);
  try {
    return await loadShared(pv, key, req, todayKey);
  } catch (e) {
    if (e instanceof AgentContextError) throw e;
    if (e instanceof SheetsError) throw new AgentContextError("upstream", 502, "Couldn't read the records from Google Sheets. Try again in a minute.");
    throw e;
  }
}
