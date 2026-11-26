// Period bucketing + metric rollups for the dashboards. Everything is derived from the live data
// (work logs, deals, interactions, invoices) — nothing here is hardcoded. Pure functions only.
import type {
  Campaign,
  ClientMasterRecord,
  ContentPost,
  ContentStatus,
  DailyWorkLogEntry,
  FounderMatrixStats,
  LeadStageStatus,
  MarketingDeal,
  MarketingInteraction,
  PaymentBillingRecord,
  ProjectProgressRecord,
} from "./types";
import type { ChannelId } from "./integrations/types";
import { addDaysKey, dayKeyOf, daysBetween, fyOf, parseDay, quarterLabel, toDayKey } from "./format";
import { FOUNDER_NAMES, personByName } from "./people";

/** Weeks start on Monday. Quarter and year follow the Indian financial year (April to March). */
export type Granularity = "week" | "month" | "quarter" | "year";

export interface Bucket {
  key: string;
  label: string; // short axis label
  title: string; // tooltip title
  start: Date;
  end: Date; // exclusive
}

export interface Range {
  granularity: Granularity;
  start: Date;
  end: Date; // exclusive
  label: string;
  buckets: Bucket[];
}

const DAY = 86_400_000;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function startOfWeek(d: Date) {
  const offset = (d.getDay() + 6) % 7; // Monday = 0
  return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -offset);
}

/** First month (0-based) of the Indian FY quarter containing d. */
function quarterStart(d: Date): Date {
  const fyMonth = (d.getMonth() + 9) % 12; // April = 0
  const qStartFyMonth = Math.floor(fyMonth / 3) * 3;
  const month = (qStartFyMonth + 3) % 12;
  const year = month > d.getMonth() ? d.getFullYear() - 1 : d.getFullYear();
  return new Date(year, month, 1);
}

function fyStart(d: Date): Date {
  return new Date(d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1, 3, 1);
}

const dayMonth = (d: Date) => `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;

export function getRange(granularity: Granularity, anchor: Date): Range {
  if (granularity === "week") {
    const start = startOfWeek(anchor);
    const end = addDays(start, 7);
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const s = addDays(start, i);
      return {
        key: toDayKey(s),
        label: s.toLocaleDateString("en-GB", { weekday: "short" }),
        title: s.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" }),
        start: s,
        end: addDays(s, 1),
      };
    });
    const last = addDays(end, -1);
    const label = `${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${last.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
    return { granularity, start, end, label, buckets };
  }
  if (granularity === "month") {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
    const days = Math.round((end.getTime() - start.getTime()) / DAY);
    const buckets = Array.from({ length: days }, (_, i) => {
      const s = addDays(start, i);
      return {
        key: toDayKey(s),
        label: String(s.getDate()),
        title: s.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
        start: s,
        end: addDays(s, 1),
      };
    });
    return { granularity, start, end, label: start.toLocaleDateString("en-GB", { month: "long", year: "numeric" }), buckets };
  }
  if (granularity === "quarter") {
    // Weekly buckets (Monday starts), clipped to the quarter.
    const start = quarterStart(anchor);
    const end = new Date(start.getFullYear(), start.getMonth() + 3, 1);
    const buckets: Bucket[] = [];
    let s = start;
    while (s < end) {
      const next = startOfWeek(addDays(s, 7));
      const e = next < end ? next : end;
      const last = addDays(e, -1);
      buckets.push({
        key: toDayKey(s),
        label: dayMonth(s),
        title: `${dayMonth(s)} – ${dayMonth(last)}`,
        start: s,
        end: e,
      });
      s = e;
    }
    return { granularity, start, end, label: quarterLabel(start), buckets };
  }
  // Indian financial year, April to March, one bucket per month.
  const start = fyStart(anchor);
  const end = new Date(start.getFullYear() + 1, 3, 1);
  const buckets = Array.from({ length: 12 }, (_, i) => {
    const s = new Date(start.getFullYear(), 3 + i, 1);
    return {
      key: `${s.getFullYear()}-${s.getMonth() + 1}`,
      label: MONTH_SHORT[s.getMonth()],
      title: `${MONTH_LONG[s.getMonth()]} ${s.getFullYear()}`,
      start: s,
      end: new Date(s.getFullYear(), s.getMonth() + 1, 1),
    };
  });
  return { granularity, start, end, label: fyOf(start).label, buckets };
}

export function shiftAnchor(granularity: Granularity, anchor: Date, dir: -1 | 1): Date {
  if (granularity === "week") return addDays(anchor, 7 * dir);
  if (granularity === "month") return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
  if (granularity === "quarter") {
    const q = quarterStart(anchor);
    return new Date(q.getFullYear(), q.getMonth() + 3 * dir, 1);
  }
  const fy = fyStart(anchor);
  return new Date(fy.getFullYear() + dir, 3, 1);
}

export function previousRange(range: Range): Range {
  return getRange(range.granularity, shiftAnchor(range.granularity, range.start, -1));
}

export function inRange(value: string | undefined, range: { start: Date; end: Date }): boolean {
  const d = parseDay(value);
  return !!d && d >= range.start && d < range.end;
}

function bucketIndex(value: string | undefined, range: Range): number {
  const d = parseDay(value);
  if (!d) return -1;
  return range.buckets.findIndex((b) => d >= b.start && d < b.end);
}

/** Most recent activity date that isn't in the future — used as the default period anchor. */
export function latestActivity(dates: (string | undefined)[], today = new Date()): Date {
  let best: Date | null = null;
  for (const v of dates) {
    const d = parseDay(v);
    if (d && d <= today && (!best || d > best)) best = d;
  }
  return best ?? today;
}

export function delta(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}

// ---------------------------------------------------------------- Engineering

export interface PersonRollup {
  name: string;
  entries: number;
  hours: number;
  completed: number;
  inProgress: number;
  blocked: number;
  review: number;
  series: number[]; // hours per bucket
}

export function engineeringRollup(logs: DailyWorkLogEntry[], range: Range) {
  const scoped = logs.filter((l) => inRange(l.date, range));
  const hoursSeries = range.buckets.map(() => 0);
  const entrySeries = range.buckets.map(() => 0);
  const people = new Map<string, PersonRollup>();
  const byType = new Map<string, number>();
  const byRepo = new Map<string, number>();

  for (const l of scoped) {
    const h = Number(l.hours) || 0;
    const i = bucketIndex(l.date, range);
    if (i >= 0) {
      hoursSeries[i] += h;
      entrySeries[i] += 1;
    }
    const p =
      people.get(l.developerName) ??
      { name: l.developerName, entries: 0, hours: 0, completed: 0, inProgress: 0, blocked: 0, review: 0, series: range.buckets.map(() => 0) };
    p.entries++;
    p.hours += h;
    if (l.workStatus === "Completed") p.completed++;
    else if (l.workStatus === "Blocked" || l.isBlocked === "Yes") p.blocked++;
    else p.inProgress++;
    if (l.reviewRequired === "Yes" && l.workStatus !== "Completed") p.review++;
    if (i >= 0) p.series[i] += h;
    people.set(l.developerName, p);
    byType.set(l.workType, (byType.get(l.workType) ?? 0) + h);
    byRepo.set(l.repository, (byRepo.get(l.repository) ?? 0) + 1);
  }

  const completed = scoped.filter((l) => l.workStatus === "Completed").length;
  const blocked = scoped.filter((l) => l.isBlocked === "Yes" || l.workStatus === "Blocked").length;
  return {
    entries: scoped,
    count: scoped.length,
    hours: scoped.reduce((s, l) => s + (Number(l.hours) || 0), 0),
    completed,
    blocked,
    inProgress: scoped.length - completed - blocked,
    review: scoped.filter((l) => l.reviewRequired === "Yes" && l.workStatus !== "Completed").length,
    shipped: scoped.filter((l) => l.deployment === "Production").length,
    hoursSeries,
    entrySeries,
    people: [...people.values()].sort((a, b) => b.hours - a.hours),
    byType: [...byType.entries()].sort((a, b) => b[1] - a[1]),
    byRepo: [...byRepo.entries()].sort((a, b) => b[1] - a[1]),
  };
}

// ---------------------------------------------------------------- Marketing

export const FUNNEL_STAGES: { label: string; stages: LeadStageStatus[] }[] = [
  { label: "Leads", stages: [] }, // every lead
  { label: "Contacted", stages: ["Contacted", "Meeting Scheduled", "Demo Completed", "Proposal Sent", "Negotiation", "Closed Won"] },
  { label: "Meetings", stages: ["Meeting Scheduled", "Demo Completed", "Proposal Sent", "Negotiation", "Closed Won"] },
  { label: "Demos", stages: ["Demo Completed", "Proposal Sent", "Negotiation", "Closed Won"] },
  { label: "Proposals", stages: ["Proposal Sent", "Negotiation", "Closed Won"] },
  { label: "Won", stages: ["Closed Won"] },
];

export function funnel(deals: MarketingDeal[]) {
  return FUNNEL_STAGES.map((f) => ({
    label: f.label,
    count: f.stages.length ? deals.filter((d) => f.stages.includes(d.leadStatus)).length : deals.length,
  }));
}

export function marketingRollup(deals: MarketingDeal[], interactions: MarketingInteraction[], range: Range) {
  const newLeads = deals.filter((d) => inRange(d.dateAdded, range));
  const touches = interactions.filter((i) => inRange(i.date, range));
  const touchSeries = range.buckets.map(() => 0);
  for (const t of touches) {
    const i = bucketIndex(t.date, range);
    if (i >= 0) touchSeries[i]++;
  }
  const won = deals.filter((d) => d.leadStatus === "Closed Won");
  const open = deals.filter((d) => d.leadStatus !== "Closed Won" && d.leadStatus !== "Closed Lost");
  const reps = [...new Set(deals.map((d) => d.marketingPerson).concat(interactions.map((i) => i.marketingPerson)))];
  return {
    newLeads,
    touches,
    touchSeries,
    visits: touches.filter((t) => t.meetingMode === "Physical (On-site)").length,
    pipeline: open.reduce((s, d) => s + (d.estimatedDealValue || 0), 0),
    weighted: open.reduce((s, d) => s + (d.weightedValue || 0), 0),
    wonValue: won.reduce((s, d) => s + (d.estimatedDealValue || 0), 0),
    wonCount: won.length,
    followUpsDue: open.filter((d) => d.dueStatus === "Overdue" || d.dueStatus === "Today").length,
    reps: reps.map((name) => {
      const rd = deals.filter((d) => d.marketingPerson === name);
      const rt = touches.filter((t) => t.marketingPerson === name);
      const rw = rd.filter((d) => d.leadStatus === "Closed Won");
      return {
        name,
        leads: rd.length,
        touches: rt.length,
        visits: rt.filter((t) => t.meetingMode === "Physical (On-site)").length,
        proposals: rd.filter((d) => d.proposalSent).length,
        won: rw.length,
        pipeline: rd
          .filter((d) => d.leadStatus !== "Closed Won" && d.leadStatus !== "Closed Lost")
          .reduce((s, d) => s + (d.estimatedDealValue || 0), 0),
        winRate: rd.length ? Math.round((rw.length / rd.length) * 100) : 0,
      };
    }),
  };
}

// ---------------------------------------------------------------- Pipeline stages and deals

export const STAGE_ORDER: LeadStageStatus[] = [
  "New Lead",
  "Contacted",
  "Meeting Scheduled",
  "Demo Completed",
  "Proposal Sent",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
  "On Hold",
];

const CLOSED_STAGES: LeadStageStatus[] = ["Closed Won", "Closed Lost"];
export const OPEN_STAGES: LeadStageStatus[] = STAGE_ORDER.filter((s) => !CLOSED_STAGES.includes(s));

const norm = (s: string | undefined | null) => (s ?? "").trim().toLowerCase();

/**
 * A visit belongs to a deal when its dealId points at it, or — for visits without a dealId —
 * when BOTH the lead ID and the company name match (case-insensitive, trimmed).
 */
export function visitLinksDeal(visit: MarketingInteraction, deal: MarketingDeal): boolean {
  if (visit.dealId) return visit.dealId === deal.id;
  const lead = norm(visit.leadId);
  const company = norm(visit.companyName);
  return !!lead && !!company && lead === norm(deal.leadId) && company === norm(deal.companyName);
}

/** Recomputes the derived deal fields from the deal, its linked visits and the stage probabilities. */
export function enrichDeal(
  deal: MarketingDeal,
  interactions: MarketingInteraction[],
  probs: Record<LeadStageStatus, number>,
  todayKey: string
): MarketingDeal {
  const value = Number(deal.estimatedDealValue) || 0;
  const prob = Number(probs[deal.leadStatus]);
  const weightedValue = Math.round(value * (Number.isFinite(prob) ? prob : 0));

  let last = dayKeyOf(deal.lastInteractionDate) ?? "";
  for (const v of interactions) {
    if (!visitLinksDeal(v, deal)) continue;
    const d = dayKeyOf(v.date);
    if (d && d <= todayKey && d > last) last = d;
  }
  const daysSinceLastVisit = last && todayKey ? Math.max(0, daysBetween(last, todayKey)) : Number(deal.daysSinceLastVisit) || 0;

  const closed = CLOSED_STAGES.includes(deal.leadStatus);
  const next = dayKeyOf(deal.nextFollowUpDate);
  let dueStatus: MarketingDeal["dueStatus"];
  if (closed) dueStatus = "Completed";
  else if (next && todayKey && next < todayKey) dueStatus = "Overdue";
  else if (next && next === todayKey) dueStatus = "Today";
  else dueStatus = "Upcoming";

  let followUpStatus: MarketingDeal["followUpStatus"];
  if (closed) followUpStatus = "Completed";
  else if (dueStatus === "Overdue") followUpStatus = "Overdue";
  else followUpStatus = deal.followUpStatus === "In Progress" ? "In Progress" : "Pending";

  return { ...deal, weightedValue, lastInteractionDate: last || deal.lastInteractionDate || "", daysSinceLastVisit, dueStatus, followUpStatus };
}

// ---------------------------------------------------------------- Invoices

/**
 * receivedAmount is the sum of receipts (or the stored figure when there are none), TDS is the sum of
 * tdsAmount, pending = invoiced − received − TDS. 'Fully Paid' when pending ≤ 0.50.
 */
export function computeInvoice(p: PaymentBillingRecord, todayKey: string): PaymentBillingRecord {
  const invoiced = Number(p.invoicedAmount) || 0;
  const receipts = Array.isArray(p.payments) ? p.payments : [];
  const received = receipts.length ? receipts.reduce((s, r) => s + (Number(r.amount) || 0), 0) : Number(p.receivedAmount) || 0;
  const tds = receipts.reduce((s, r) => s + (Number(r.tdsAmount) || 0), 0);
  const rawPending = Math.round((invoiced - received - tds) * 100) / 100;
  const pendingAmount = Math.max(0, rawPending);
  const due = dayKeyOf(p.dueDate);
  let status: PaymentBillingRecord["status"];
  if (pendingAmount <= 0.5) status = "Fully Paid";
  else if (due && todayKey && due < todayKey) status = "Overdue";
  else status = "Pending";
  return {
    ...p,
    receivedAmount: Math.round(received * 100) / 100,
    pendingAmount: status === "Fully Paid" ? 0 : pendingAmount,
    overdueAmount: status === "Overdue" ? pendingAmount : 0,
    status,
  };
}

/** TDS deducted on an invoice (sum of receipt tdsAmount). */
export function invoiceTds(p: PaymentBillingRecord): number {
  return (Array.isArray(p.payments) ? p.payments : []).reduce((s, r) => s + (Number(r.tdsAmount) || 0), 0);
}

// ---------------------------------------------------------------- Founders

const ACTIVE_DELIVERY: ProjectProgressRecord["status"][] = ["Development", "Testing", "Client Review"];

/** One row per founder, derived from clients, projects and (computed) invoices. */
export function deriveFounderMatrix(
  clients: ClientMasterRecord[],
  projects: ProjectProgressRecord[],
  payments: PaymentBillingRecord[]
): FounderMatrixStats[] {
  return FOUNDER_NAMES.map((founder) => {
    const own = clients.filter((c) => norm(c.salesOwner) === norm(founder));
    const ownIds = new Set(own.map((c) => c.clientId).filter(Boolean));
    const led = projects.filter((p) => norm(p.projectManager) === norm(founder));
    return {
      founder,
      role: personByName(founder)?.title ?? "Co-founder",
      clientsBrought: own.length,
      totalDealValue: own.reduce((s, c) => s + (Number(c.dealValue) || 0), 0),
      projectsLed: {
        total: led.length,
        active: led.filter((p) => ACTIVE_DELIVERY.includes(p.status)).length,
        completed: led.filter((p) => p.status === "Completed").length,
        onHold: led.filter((p) => p.status === "On Hold").length,
      },
      pendingCollection: payments.filter((p) => ownIds.has(p.clientId)).reduce((s, p) => s + (Number(p.pendingAmount) || 0), 0),
    };
  });
}

// ---------------------------------------------------------------- Heatmaps and gaps

/** Monday of the week that is `weeks - 1` weeks before the week containing todayKey. */
function heatmapStart(weeks: number, todayKey: string): string {
  const d = parseDay(todayKey) ?? new Date(0);
  const offset = (d.getDay() + 6) % 7;
  return addDaysKey(todayKey, -offset - 7 * (Math.max(1, Math.round(weeks)) - 1));
}

function heatmapCells(weeks: number, todayKey: string, valueOf: (day: string) => number): { date: string; value: number }[] {
  const start = heatmapStart(weeks, todayKey);
  const total = Math.max(1, Math.round(weeks)) * 7;
  return Array.from({ length: total }, (_, i) => {
    const date = addDaysKey(start, i);
    return { date, value: date > todayKey ? 0 : valueOf(date) };
  });
}

/** Hours logged per day over `weeks` whole weeks (Monday to Sunday) ending with the current week. */
export function workLogHeatmap(
  logs: DailyWorkLogEntry[],
  personName: string | null,
  weeks: number,
  todayKey: string
): { date: string; value: number }[] {
  const byDay = new Map<string, number>();
  for (const l of logs) {
    if (personName && norm(l.developerName) !== norm(personName)) continue;
    const d = dayKeyOf(l.date);
    if (d) byDay.set(d, (byDay.get(d) ?? 0) + (Number(l.hours) || 0));
  }
  return heatmapCells(weeks, todayKey, (day) => Math.round((byDay.get(day) ?? 0) * 10) / 10);
}

/** Count of dates per day over `weeks` whole weeks ending with the current week. */
export function activityHeatmap(dates: (string | undefined | null)[], weeks: number, todayKey: string): { date: string; value: number }[] {
  const byDay = new Map<string, number>();
  for (const v of dates) {
    const d = dayKeyOf(v ?? "");
    if (d) byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }
  return heatmapCells(weeks, todayKey, (day) => byDay.get(day) ?? 0);
}

/** Working days are Monday to Saturday. */
function isWorkingDay(day: string): boolean {
  const d = parseDay(day);
  return !!d && d.getDay() !== 0;
}

/**
 * For each person: the last day they logged work and how many working days (Mon–Sat) have passed
 * since then without a log, not counting today. With no log at all, the last 30 days are counted.
 */
export function logGaps<P extends { name: string }>(
  logs: DailyWorkLogEntry[],
  people: P[],
  todayKey: string
): { person: P; lastDate: string | null; workingDaysMissed: number }[] {
  const last = new Map<string, string>();
  for (const l of logs) {
    const d = dayKeyOf(l.date);
    if (!d || d > todayKey) continue;
    const k = norm(l.developerName);
    if (!last.has(k) || d > last.get(k)!) last.set(k, d);
  }
  return people.map((person) => {
    const lastDate = last.get(norm(person.name)) ?? null;
    const from = lastDate ? addDaysKey(lastDate, 1) : addDaysKey(todayKey, -30);
    let missed = 0;
    for (let d = from; d < todayKey; d = addDaysKey(d, 1)) if (isWorkingDay(d)) missed++;
    return { person, lastDate, workingDaysMissed: missed };
  });
}

// ---------------------------------------------------------------- Content and campaigns

const CONTENT_STATUSES: ContentStatus[] = ["idea", "draft", "in_review", "scheduled", "published"];

/** Posts dated in the range (published date, else scheduled date), with counts per status and channel. */
export function contentRollup(posts: ContentPost[], range: Range) {
  const dateOf = (p: ContentPost) => dayKeyOf(p.publishedAt ?? "") ?? dayKeyOf(p.scheduledAt ?? "") ?? undefined;
  const scoped = posts.filter((p) => inRange(dateOf(p), range));
  const byStatus = Object.fromEntries(CONTENT_STATUSES.map((s) => [s, 0])) as Record<ContentStatus, number>;
  const byChannel: Partial<Record<ChannelId, number>> = {};
  const series = range.buckets.map(() => 0);
  for (const p of scoped) {
    byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
    byChannel[p.channel] = (byChannel[p.channel] ?? 0) + 1;
    const i = bucketIndex(dateOf(p), range);
    if (i >= 0) series[i]++;
  }
  return {
    posts: scoped,
    total: scoped.length,
    published: byStatus.published,
    scheduled: byStatus.scheduled,
    byStatus,
    byChannel,
    series,
    reach: scoped.reduce((s, p) => s + (Number(p.metrics?.reach) || 0), 0),
    engagements: scoped.reduce((s, p) => s + (Number(p.metrics?.engagements) || 0), 0),
  };
}

/** Spend, leads, cost per lead (₹, rounded; 0 with no leads) and won deals for each campaign. */
export function campaignRollup(campaigns: Campaign[], deals: MarketingDeal[]): { id: string; name: string; spend: number; leads: number; cpl: number; won: number }[] {
  return campaigns.map((c) => {
    const linked = deals.filter((d) => d.campaignId === c.id);
    const leads = Math.max(Number(c.leads) || 0, linked.length);
    const spend = Number(c.spend) || 0;
    return {
      id: c.id,
      name: c.name,
      spend,
      leads,
      cpl: leads ? Math.round(spend / leads) : 0,
      won: linked.filter((d) => d.leadStatus === "Closed Won").length,
    };
  });
}
