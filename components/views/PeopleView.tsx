"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, LayoutGrid, Mail, Rows3, Search, Users } from "lucide-react";
import { useHub } from "@/lib/hub/context";
import { useLocalPref, useNow } from "@/lib/prefs";
import { activityHeatmap, logGaps, workLogHeatmap } from "@/lib/analytics";
import { usePeriod } from "@/lib/usePeriod";
import { formatDateIST, formatNumber, todayKeyIST } from "@/lib/format";
import { mailtoHref } from "@/lib/company";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { SummaryBand } from "@/components/ui/SummaryBand";
import { Avatar, EmptyState, PeriodPicker, Segmented } from "@/components/ui/primitives";
import { DelayedSkeleton } from "@/components/ui/Skeleton";
import { Heatmap, Sparkline, SplitBar } from "@/components/charts/Charts";
import {
  buildTeamRows,
  CATEGORY_LABEL,
  entriesText,
  lastActivityText,
  MEMBERS,
  outputText,
  teamColumns,
  type MemberCategory,
  type TeamRow,
} from "@/components/overview/TeamTable";

type Filter = "all" | MemberCategory;
type Layout = "cards" | "table";
const LAYOUTS = ["cards", "table"] as const;
const HEAT_WEEKS = 26;

interface Gap {
  lastDate: string | null;
  workingDaysMissed: number;
}

const same = (a: string | undefined | null, b: string) => !!a && a.trim().toLowerCase() === b.trim().toLowerCase();

/** 'No log since Tue 18 Nov', or null when the person is up to date (or is in marketing). */
function gapText(g: Gap | undefined): string | null {
  if (!g || g.workingDaysMissed < 1) return null;
  if (!g.lastDate) return "No log in the last 30 days";
  return `No log since ${formatDateIST(g.lastDate, { weekday: true })}`;
}

function GapChip({ gap }: { gap: Gap | undefined }) {
  const text = gapText(gap);
  if (!text) return null;
  const severe = !gap!.lastDate || gap!.workingDaysMissed >= 3;
  return (
    <span className={`chip ${severe ? "chip-coral" : "chip-amber"}`}>
      <span aria-hidden className={`dot ${severe ? "dot-negative" : "dot-warning"}`} />
      {text}
    </span>
  );
}

export function PeopleView() {
  const { data, registerSearch } = useHub();
  const router = useRouter();
  const now = useNow();
  const todayKey = useMemo(() => (now ? todayKeyIST(now) : ""), [now]);

  const dates = useMemo(() => [...data.workLogs.map((l) => l.date), ...data.interactions.map((i) => i.date)], [data.workLogs, data.interactions]);
  const period = usePeriod(dates, "month");
  const { range } = period;
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useLocalPref<Layout>("axoraa:people-layout", "cards", LAYOUTS);

  const rows = useMemo(() => buildTeamRows(data, range), [data, range]);

  const gaps = useMemo(() => {
    const map = new Map<string, Gap>();
    if (!todayKey) return map;
    const loggers = MEMBERS.filter((p) => p.category !== "marketing");
    for (const g of logGaps(data.workLogs, loggers, todayKey)) map.set(g.person.id, { lastDate: g.lastDate, workingDaysMissed: g.workingDaysMissed });
    return map;
  }, [data.workLogs, todayKey]);

  const heat = useMemo(() => {
    const map = new Map<string, { date: string; value: number }[]>();
    if (!todayKey) return map;
    for (const p of MEMBERS) {
      map.set(
        p.id,
        p.category === "marketing"
          ? activityHeatmap(
              data.interactions.filter((i) => same(i.marketingPerson, p.name)).map((i) => i.date),
              HEAT_WEEKS,
              todayKey
            )
          : workLogHeatmap(data.workLogs, p.name, HEAT_WEEKS, todayKey)
      );
    }
    return map;
  }, [data.workLogs, data.interactions, todayKey]);

  const needle = query.trim().toLowerCase();
  const shown = rows.filter(
    (r) =>
      (filter === "all" || r.category === filter) &&
      (!needle || [r.person.name, r.person.title, r.person.email ?? "", CATEGORY_LABEL[r.category]].some((s) => s.toLowerCase().includes(needle)))
  );

  const columns = useMemo<TableColumn<TeamRow>[]>(() => {
    const base = teamColumns(now);
    const email: TableColumn<TeamRow> = {
      id: "email",
      header: "Email",
      hideBelow: "lg",
      truncate: true,
      cell: (r) =>
        r.person.email ? (
          <a href={mailtoHref({ to: r.person.email })} onClick={(e) => e.stopPropagation()} className="text-ink-2 underline-offset-2 hover:text-ink hover:underline">
            {r.person.email}
          </a>
        ) : null,
      sortValue: (r) => r.person.email ?? "",
    };
    const gap: TableColumn<TeamRow> = {
      id: "gap",
      header: "Log gaps",
      cell: (r) =>
        r.engineering ? (
          gapText(gaps.get(r.person.id)) ? (
            <GapChip gap={gaps.get(r.person.id)} />
          ) : (
            <span className="text-ink-3">Up to date</span>
          )
        ) : null,
      sortValue: (r) => (r.engineering ? gaps.get(r.person.id)?.workingDaysMissed ?? 0 : null),
      hideBelow: "md",
    };
    const heatCol: TableColumn<TeamRow> = {
      id: "heat",
      header: `Last ${HEAT_WEEKS} weeks`,
      hideBelow: "lg",
      cell: (r) => (
        <Heatmap
          size="sm"
          cells={heat.get(r.person.id) ?? []}
          unit={r.engineering ? "hours" : "visits"}
          ariaLabel={`${r.person.name}, ${r.engineering ? "hours logged" : "visits"} per day over the last ${HEAT_WEEKS} weeks`}
        />
      ),
    };
    const [person, category, ...rest] = base;
    return [person, category, email, ...rest, gap, heatCol];
  }, [now, gaps, heat]);

  if (!data.ready || !todayKey) return <DelayedSkeleton label="Loading people" />;

  const eng = shown.filter((r) => r.engineering);
  const mkt = shown.filter((r) => !r.engineering);
  const hours = eng.reduce((s, r) => s + r.hours, 0);
  const visits = mkt.reduce((s, r) => s + r.visits, 0);
  const active = shown.filter((r) => r.entries > 0 || r.visits > 0).length;
  const withGaps = eng.filter((r) => gapText(gaps.get(r.person.id)));
  const worst = [...withGaps].sort((a, b) => (gaps.get(b.person.id)?.workingDaysMissed ?? 0) - (gaps.get(a.person.id)?.workingDaysMissed ?? 0))[0];

  const clear = () => {
    setQuery("");
    setFilter("all");
  };

  return (
    <div className="space-y-4 lg:space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Category"
            value={filter}
            onChange={setFilter}
            className="max-w-full overflow-x-auto no-scrollbar"
            options={[
              { value: "all", label: "All" },
              { value: "founder", label: "Founders" },
              { value: "marketing", label: "Marketing" },
              { value: "developer", label: "Developers" },
            ]}
          />
          <label className="relative w-full sm:w-64">
            <span className="sr-only">Search people</span>
            <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input
              ref={registerSearch}
              type="search"
              aria-label="Search people"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, role or email"
              className="field pl-10"
            />
          </label>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="-mx-1 min-w-0 max-w-full overflow-x-auto px-1 py-0.5 no-scrollbar">
            <PeriodPicker granularity={period.granularity} onGranularity={period.setGranularity} range={range} onShift={period.shift} onToday={period.reset} />
          </div>
          <Segmented
            label="Layout"
            value={layout}
            onChange={setLayout}
            options={[
              { value: "cards", label: (
                  <>
                    <LayoutGrid aria-hidden className="h-4 w-4" />
                    <span className="sr-only">Cards</span>
                  </>
                ), title: "Cards" },
              { value: "table", label: (
                  <>
                    <Rows3 aria-hidden className="h-4 w-4" />
                    <span className="sr-only">Table</span>
                  </>
                ), title: "Table" },
            ]}
          />
        </div>
      </div>

      <SummaryBand
        hero
        ariaLabel={`People summary, ${range.label}`}
        items={[
          { label: "People", value: String(shown.length), compare: { text: `${active} active in ${range.label}` } },
          { label: "Hours logged", value: formatNumber(hours, 1), compare: { text: `${eng.reduce((s, r) => s + r.entries, 0)} entries` } },
          { label: "Visits logged", value: String(visits), compare: { text: `${mkt.reduce((s, r) => s + r.onSite, 0)} on-site` } },
          {
            label: "Log gaps",
            value: String(withGaps.length),
            compare: worst
              ? { text: `${worst.person.name}: ${gapText(gaps.get(worst.person.id))}`, tone: "negative" }
              : { text: "Everyone is up to date", tone: "positive" },
          },
        ]}
      />

      {shown.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Users />}
            title={needle ? `Nobody matches "${query.trim()}"` : "Nobody in this category"}
            body="Try another name or category."
            action={
              <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>
                Show everyone
              </button>
            }
          />
        </div>
      ) : layout === "table" ? (
        <DataTable
          caption={`People, ${range.label}: hours or visits, entries, last activity, blockers, log gaps and the last ${HEAT_WEEKS} weeks`}
          rows={shown}
          columns={columns}
          rowKey={(r) => r.person.id}
          onRowClick={(r) => router.push(`/u/${r.person.id}`)}
          rowLabel={(r) => r.person.name}
          mobileCard={(r) => (
            <div className="flex items-center gap-3">
              <Avatar name={r.person.name} size={32} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium text-ink">{r.person.name}</div>
                <div className="truncate text-[12px] text-ink-3">{lastActivityText(r, now)}</div>
                {r.engineering && (
                  <div className="mt-1.5">
                    <GapChip gap={gaps.get(r.person.id)} />
                  </div>
                )}
              </div>
              <span className="shrink-0 text-[14px] font-medium tabular-nums text-ink">{outputText(r)}</span>
            </div>
          )}
          footer={`${shown.length} ${shown.length === 1 ? "person" : "people"}. Open a row for that person's dashboard.`}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5 2xl:grid-cols-3">
          {shown.map((r, i) => (
            <PersonCard key={r.person.id} r={r} now={now} gap={gaps.get(r.person.id)} cells={heat.get(r.person.id) ?? []} delay={i * 35} />
          ))}
        </div>
      )}
    </div>
  );
}

function PersonCard({
  r,
  now,
  gap,
  cells,
  delay,
}: {
  r: TeamRow;
  now: number;
  gap: Gap | undefined;
  cells: { date: string; value: number }[];
  delay: number;
}) {
  const { person } = r;
  return (
    <section aria-labelledby={`person-${person.id}`} className="card flex min-w-0 animate-rise flex-col p-5 sm:p-6" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={person.name} size={46} />
          <div className="min-w-0">
            <h3 id={`person-${person.id}`} className="truncate text-[16px] font-medium">
              <Link href={`/u/${person.id}`} className="underline-offset-2 hover:underline">
                {person.name}
              </Link>
            </h3>
            <div className="truncate text-[12.5px] text-ink-3">{person.title}</div>
          </div>
        </div>
        <Link href={`/u/${person.id}`} className="icon-btn shrink-0" aria-label={`Open ${person.name}'s dashboard`}>
          <ArrowUpRight aria-hidden className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 text-[12.5px]">
        <span className="chip chip-outline">{CATEGORY_LABEL[r.category]}</span>
        {person.email && (
          <a href={mailtoHref({ to: person.email })} className="inline-flex min-w-0 items-center gap-1.5 text-ink-2 underline-offset-2 hover:text-ink hover:underline">
            <Mail aria-hidden className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{person.email}</span>
          </a>
        )}
      </div>

      {r.engineering ? (
        <>
          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <div className="num text-[40px]">
                {formatNumber(r.hours, 1)}
                <span className="ml-1 text-[15px] tracking-normal text-ink-3">h</span>
              </div>
              <div className="mt-1 text-[12px] text-ink-3">
                {entriesText(r)} · {r.completed} done
              </div>
            </div>
            <Sparkline values={r.series} width={110} height={40} ariaLabel={`${person.name}, hours across the period`} />
          </div>
          <div className="mt-4">
            <SplitBar
              parts={[
                { key: "c", value: r.completed, className: "bg-ink", label: "Completed" },
                { key: "p", value: r.inProgress, className: "bg-lime", label: "In progress" },
                { key: "b", value: r.blocked, className: "bg-coral", label: "Blocked" },
              ]}
            />
          </div>
        </>
      ) : (
        <div className="mt-5 grid grid-cols-3 gap-2">
          <Mini k="Visits" v={r.visits} />
          <Mini k="On-site" v={r.onSite} />
          <Mini k="New leads" v={r.leads} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="chip">Last activity {lastActivityText(r, now).replace(/^No activity yet$/, "none yet")}</span>
        {r.openBlockers > 0 && (
          <span className="chip chip-coral">
            <span aria-hidden className="dot dot-negative" />
            {r.openBlockers} open {r.openBlockers === 1 ? "blocker" : "blockers"}
          </span>
        )}
        {r.engineering && <GapChip gap={gap} />}
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <div className="mb-2 text-[12px] text-ink-3">
          {r.engineering ? "Hours logged" : "Visits"}, last {HEAT_WEEKS} weeks
        </div>
        <Heatmap
          size="sm"
          cells={cells}
          unit={r.engineering ? "hours" : "visits"}
          ariaLabel={`${person.name}, ${r.engineering ? "hours logged" : "visits"} per day over the last ${HEAT_WEEKS} weeks`}
        />
      </div>
    </section>
  );
}

function Mini({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="card-inset min-w-0 px-3 py-3">
      <div className="truncate text-[11.5px] text-ink-3">{k}</div>
      <div className="mt-0.5 text-[20px] font-medium tabular-nums">{v}</div>
    </div>
  );
}
