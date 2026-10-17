// Period bucketing + metric rollups for the dashboards. Everything is derived from the live data
// (work logs, deals, interactions) — nothing here is hardcoded.
import type { DailyWorkLogEntry, MarketingDeal, MarketingInteraction, LeadStageStatus } from "./types";
import { parseDay, toDayKey } from "./format";

export type Granularity = "week" | "month" | "year";

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

function startOfWeek(d: Date) {
  const offset = (d.getDay() + 6) % 7; // Monday = 0
  return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -offset);
}

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
  const start = new Date(anchor.getFullYear(), 0, 1);
  const end = new Date(anchor.getFullYear() + 1, 0, 1);
  const buckets = Array.from({ length: 12 }, (_, i) => {
    const s = new Date(anchor.getFullYear(), i, 1);
    return {
      key: `${s.getFullYear()}-${i + 1}`,
      label: s.toLocaleDateString("en-GB", { month: "short" }),
      title: s.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
      start: s,
      end: new Date(anchor.getFullYear(), i + 1, 1),
    };
  });
  return { granularity, start, end, label: String(anchor.getFullYear()), buckets };
}

export function shiftAnchor(granularity: Granularity, anchor: Date, dir: -1 | 1): Date {
  if (granularity === "week") return addDays(anchor, 7 * dir);
  if (granularity === "month") return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
  return new Date(anchor.getFullYear() + dir, anchor.getMonth(), 1);
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
