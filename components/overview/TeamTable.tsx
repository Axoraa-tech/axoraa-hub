"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, Users } from "lucide-react";
import type { TableColumn } from "@/components/ui/DataTable";
import { Avatar, CardHeader, EmptyState } from "@/components/ui/primitives";
import { Sparkline, SplitBar } from "@/components/charts/Charts";
import { inRange, type Range } from "@/lib/analytics";
import { formatNumber, parseInstant, relativeTime } from "@/lib/format";
import { PEOPLE, type Person } from "@/lib/people";
import type { UserRoleCategory } from "@/lib/types";
import type { HubData } from "@/lib/useHubData";

export type MemberCategory = Exclude<UserRoleCategory, "admin">;

/** Every member, never the administrator account. */
export const MEMBERS: Person[] = PEOPLE.filter((p) => p.role === "member");

export const CATEGORY_LABEL: Record<MemberCategory, string> = {
  founder: "Founder",
  developer: "Developer",
  marketing: "Marketing",
};

const CATEGORY_ORDER: Record<MemberCategory, number> = { founder: 0, developer: 1, marketing: 2 };

/** One member's figures for a period. Engineering people are measured in hours; marketing in visits. */
export interface TeamRow {
  person: Person;
  category: MemberCategory;
  /** Founders and developers log work; marketing logs visits. */
  engineering: boolean;
  hours: number;
  /** Work-log entries (engineering) in the period. */
  entries: number;
  /** Visits and calls (marketing) in the period. */
  visits: number;
  onSite: number;
  /** Deals added (marketing) in the period. */
  leads: number;
  completed: number;
  inProgress: number;
  blocked: number;
  /** Hours (engineering) or visits (marketing) per bucket of the period. */
  series: number[];
  /** ISO instant of the person's latest record, any date. */
  lastActivity: string | null;
  lastMs: number;
  /** Blocked work-log entries that are not completed, any date. */
  openBlockers: number;
}

const same = (a: string | undefined | null, b: string | undefined | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

function bucketOf(value: string | undefined, range: Range): number {
  if (!value) return -1;
  return range.buckets.findIndex((b) => inRange(value, b));
}

/** Derives one row per member from the data; nothing is hard-coded. */
export function buildTeamRows(data: HubData, range: Range, people: Person[] = MEMBERS): TeamRow[] {
  const rows = people.map((person): TeamRow => {
    const category = (person.category === "admin" ? "founder" : person.category) as MemberCategory;
    const engineering = category !== "marketing";
    const logs = data.workLogs.filter((l) => same(l.developerName, person.name));
    const visits = data.interactions.filter((i) => same(i.marketingPerson, person.name));
    const deals = data.deals.filter((d) => same(d.marketingPerson, person.name));
    const series = range.buckets.map(() => 0);

    let hours = 0;
    let entries = 0;
    let completed = 0;
    let inProgress = 0;
    let blocked = 0;
    for (const l of logs) {
      if (!inRange(l.date, range)) continue;
      const h = Number(l.hours) || 0;
      hours += h;
      entries++;
      if (l.workStatus === "Completed") completed++;
      else if (l.workStatus === "Blocked" || l.isBlocked === "Yes") blocked++;
      else inProgress++;
      const i = bucketOf(l.date, range);
      if (engineering && i >= 0) series[i] += h;
    }

    const visitsIn = visits.filter((v) => inRange(v.date, range));
    if (!engineering) {
      for (const v of visitsIn) {
        const i = bucketOf(v.date, range);
        if (i >= 0) series[i]++;
      }
    }

    // Latest record of any kind, any date.
    let lastMs = 0;
    const consider = (v: string | undefined | null) => {
      const ms = parseInstant(v ?? "");
      if (ms !== null && ms > lastMs) lastMs = ms;
    };
    for (const l of logs) consider(l.updatedAt || l.createdAt || l.lastUpdated || l.date);
    for (const v of visits) consider(v.updatedAt || v.createdAt || v.date);
    for (const d of deals) consider(d.updatedAt || d.createdAt || d.dateAdded);
    for (const e of data.activity) if (e.actorId === person.id || same(e.actorName, person.name)) consider(e.at);

    return {
      person,
      category,
      engineering,
      hours: Math.round(hours * 10) / 10,
      entries,
      visits: visitsIn.length,
      onSite: visitsIn.filter((v) => v.meetingMode === "Physical (On-site)").length,
      leads: deals.filter((d) => inRange(d.dateAdded, range)).length,
      completed,
      inProgress,
      blocked,
      series,
      lastActivity: lastMs ? new Date(lastMs).toISOString() : null,
      lastMs,
      openBlockers: logs.filter((l) => (l.isBlocked === "Yes" || l.workStatus === "Blocked") && l.workStatus !== "Completed").length,
    };
  });

  return rows.sort(
    (a, b) =>
      CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] ||
      (a.engineering ? b.hours - a.hours : b.visits - a.visits) ||
      a.person.name.localeCompare(b.person.name)
  );
}

export function outputValue(r: TeamRow): number {
  return r.engineering ? r.hours : r.visits;
}

/** '12.5 h' or '8 visits'. */
export function outputText(r: TeamRow): string {
  if (r.engineering) return `${formatNumber(r.hours, 1)} h`;
  return `${r.visits} ${r.visits === 1 ? "visit" : "visits"}`;
}

/** '14 entries' or '3 new leads'. */
export function entriesText(r: TeamRow): string {
  if (r.engineering) return `${r.entries} ${r.entries === 1 ? "entry" : "entries"}`;
  return `${r.leads} new ${r.leads === 1 ? "lead" : "leads"}`;
}

export function lastActivityText(r: TeamRow, now: number): string {
  return r.lastActivity ? relativeTime(r.lastActivity, now) : "No activity yet";
}

function PersonCell({ person, size = 20 }: { person: Person; size?: number }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar name={person.name} size={size} />
      <div className="min-w-0">
        <Link
          href={`/u/${person.id}`}
          onClick={(e) => e.stopPropagation()}
          className="block truncate font-medium text-ink underline-offset-2 hover:underline"
        >
          {person.name}
        </Link>
        <div className="truncate text-[12px] text-ink-3">{person.title}</div>
      </div>
    </div>
  );
}

function BlockerCount({ n }: { n: number }) {
  if (!n) return <span className="text-ink-3">0</span>;
  return <span className="font-medium text-negative">{n}</span>;
}

/** The team columns shared by the Command Center and People tables (DataTable). */
export function teamColumns(now: number): TableColumn<TeamRow>[] {
  return [
    {
      id: "person",
      header: "Person",
      cell: (r) => <PersonCell person={r.person} />,
      sortValue: (r) => r.person.name,
    },
    {
      id: "category",
      header: "Category",
      cell: (r) => CATEGORY_LABEL[r.category],
      sortValue: (r) => CATEGORY_ORDER[r.category],
      hideBelow: "lg",
    },
    {
      id: "output",
      header: "Hours or visits",
      cell: (r) => <span className="font-medium">{outputText(r)}</span>,
      sortValue: (r) => outputValue(r),
      align: "right",
    },
    {
      id: "entries",
      header: "Entries",
      cell: (r) => entriesText(r),
      sortValue: (r) => (r.engineering ? r.entries : r.leads),
      align: "right",
    },
    {
      id: "last",
      header: "Last activity",
      cell: (r) => lastActivityText(r, now),
      sortValue: (r) => r.lastMs || null,
    },
    {
      id: "blockers",
      header: "Open blockers",
      cell: (r) => <BlockerCount n={r.openBlockers} />,
      sortValue: (r) => r.openBlockers,
      align: "right",
    },
  ];
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}

function StatusSplit({ r, height }: { r: TeamRow; height?: number }) {
  if (!r.engineering) {
    return (
      <span className="text-[12.5px] text-ink-3">
        {r.visits ? `${r.onSite} on-site, ${r.visits - r.onSite} calls or video` : "No visits"}
      </span>
    );
  }
  return (
    <SplitBar
      height={height}
      parts={[
        { key: "c", value: r.completed, className: "bg-ink", label: "Completed" },
        { key: "p", value: r.inProgress, className: "bg-lime", label: "In progress" },
        { key: "b", value: r.blocked, className: "bg-coral", label: "Blocked" },
      ]}
    />
  );
}

/**
 * "Who did what": the original Command Center team card, with last activity and open blockers.
 * No heatmaps here; People has those.
 */
export function TeamTable({
  rows,
  now,
  subtitle,
  onShowAll,
  onLogWork,
}: {
  rows: TeamRow[];
  now: number;
  subtitle: string;
  onShowAll?: () => void;
  onLogWork?: () => void;
}) {
  const router = useRouter();
  const anyActivity = rows.some((r) => r.entries > 0 || r.visits > 0 || r.leads > 0);

  return (
    <section className="card min-w-0 p-5 sm:p-6">
      <CardHeader
        icon={<Users />}
        title="Who did what"
        subtitle={subtitle}
        action={
          onShowAll && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onShowAll}>
              All people <ArrowRight aria-hidden className="h-3.5 w-3.5" />
            </button>
          )
        }
      />

      {!anyActivity ? (
        <EmptyState
          icon={<Users />}
          title="Nobody logged work or visits in this period"
          body="Use the arrows above to look at another period."
          action={
            onLogWork && (
              <button type="button" className="btn btn-ink btn-sm" onClick={onLogWork}>
                Log work
              </button>
            )
          }
        />
      ) : (
        <>
          {/* Tablet and desktop */}
          <div className="-mx-2 mt-5 hidden overflow-x-auto md:block">
            <table className="table-clean">
              <caption className="sr-only">Hours, visits, last activity and open blockers per person, {subtitle}</caption>
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  <th scope="col" className="hidden xl:table-cell">
                    Category
                  </th>
                  <th scope="col" className="text-right">
                    Hours or visits
                  </th>
                  <th scope="col" className="hidden text-right lg:table-cell">
                    Entries
                  </th>
                  <th scope="col" className="hidden w-[18%] xl:table-cell">
                    Status split
                  </th>
                  <th scope="col" className="hidden lg:table-cell">
                    Trend
                  </th>
                  <th scope="col">Last activity</th>
                  <th scope="col" className="text-right">
                    Blockers
                  </th>
                  <th scope="col">
                    <span className="sr-only">Open dashboard</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.person.id} className="cursor-pointer" onClick={() => router.push(`/u/${r.person.id}`)}>
                    <td>
                      <PersonCell person={r.person} size={32} />
                    </td>
                    <td className="hidden text-ink-2 xl:table-cell">{CATEGORY_LABEL[r.category]}</td>
                    <td className="text-right font-medium tabular-nums">{outputText(r)}</td>
                    <td className="hidden text-right tabular-nums text-ink-2 lg:table-cell">{entriesText(r)}</td>
                    <td className="hidden xl:table-cell">
                      <StatusSplit r={r} />
                    </td>
                    <td className="hidden lg:table-cell">
                      <Sparkline
                        values={r.series}
                        width={88}
                        height={26}
                        ariaLabel={`${r.person.name}, ${r.engineering ? "hours" : "visits"} across the period`}
                      />
                    </td>
                    <td className="whitespace-nowrap text-ink-2">{lastActivityText(r, now)}</td>
                    <td className="text-right tabular-nums">
                      <BlockerCount n={r.openBlockers} />
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/u/${r.person.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="icon-btn icon-btn-sm inline-flex"
                        aria-label={`Open ${r.person.name}'s dashboard`}
                      >
                        <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="hidden flex-wrap items-center gap-4 px-2 pt-4 text-[12px] text-ink-3 xl:flex">
              <Legend className="bg-ink" label="Completed" />
              <Legend className="bg-lime" label="In progress" />
              <Legend className="bg-coral" label="Blocked" />
            </div>
          </div>

          {/* Phones: stacked rounded rows */}
          <ul aria-label="Who did what" className="mt-5 space-y-2 md:hidden">
            {rows.map((r) => (
              <li key={r.person.id}>
                <Link
                  href={`/u/${r.person.id}`}
                  className="card-interactive block rounded-[18px] bg-surface-2 px-4 py-3.5"
                  aria-label={`${r.person.name}, ${outputText(r)}, last activity ${lastActivityText(r, now)}. Open dashboard`}
                >
                  <span className="flex items-center gap-3">
                    <Avatar name={r.person.name} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{r.person.name}</span>
                      <span className="block truncate text-[12px] text-ink-3">
                        {lastActivityText(r, now)}
                        {r.openBlockers > 0 && <span className="text-negative">, {r.openBlockers} blocked</span>}
                      </span>
                    </span>
                    <span className="num shrink-0 text-[22px]">
                      {r.engineering ? formatNumber(r.hours, 1) : r.visits}
                      <span className="ml-0.5 text-[12px] tracking-normal text-ink-3">{r.engineering ? "h" : r.visits === 1 ? " visit" : " visits"}</span>
                    </span>
                  </span>
                  {r.engineering && r.entries > 0 && (
                    <span className="mt-3 block">
                      <StatusSplit r={r} height={8} />
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
