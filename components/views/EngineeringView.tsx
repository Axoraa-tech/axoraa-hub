"use client";

import React, { useMemo } from "react";
import {
  AlertOctagon,
  ArrowUpRight,
  Boxes,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GitBranch,
  Layers,
  Mail,
  Timer,
  UserRoundX,
} from "lucide-react";
import type { DailyWorkLogEntry } from "@/lib/types";
import { delta, engineeringRollup, logGaps, workLogHeatmap, type Range } from "@/lib/analytics";
import { usePeriod } from "@/lib/usePeriod";
import { addDaysKey, formatDateIST, formatNumber, pct, todayKeyIST } from "@/lib/format";
import { composeHref } from "@/lib/company";
import { DEVELOPER_NAMES, FOUNDER_NAMES, personByName } from "@/lib/people";
import { useComposePref, useNow } from "@/lib/prefs";
import { useHub } from "@/lib/hub/context";
import { can } from "@/lib/hub/permissions";
import { Avatar, CardHeader, Delta, EmptyState, PeriodPicker, SectionHeader, StatusPill } from "@/components/ui/primitives";
import { ColumnChart, Heatmap, RankedBars, SegmentMeter, SplitBar } from "@/components/charts/Charts";
import { BlockerList, isOpenBlocker } from "@/components/engineering/BlockerList";
import { WeeklySummary, entriesInWeek, istWeekStart } from "@/components/engineering/WeeklySummary";

const DAY_MS = 86_400_000;

/** Weeks covered by a period (a month is about 4.3). */
function weeksIn(range: Range): number {
  return Math.max(1, Math.round((range.end.getTime() - range.start.getTime()) / DAY_MS)) / 7;
}

/** Capacity for one chart bucket: a working day (Mon–Sat), a week, or a month. */
function bucketCapacity(range: Range, weekly: number): { value: number; label: string } {
  if (range.granularity === "week" || range.granularity === "month") return { value: weekly / 6, label: "Daily capacity" };
  if (range.granularity === "quarter") return { value: weekly, label: "Weekly capacity" };
  return { value: (weekly * 52) / 12, label: "Monthly capacity" };
}

const fmtH = (v: number) => `${formatNumber(v, 1)}h`;

/** Next working day (Mon–Sat) after a day key. */
function nextWorkingDay(day: string): string {
  let d = addDaysKey(day, 1);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (m && new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay() === 0) d = addDaysKey(d, 1);
  return d;
}

/**
 * Engineering dashboard. Team mode on 'eng' (admin): hours against capacity, output, blockers, log
 * gaps and repositories. Personal mode on 'today' (founders and developers, or the admin looking at
 * a member's page): the same bento for one person, plus the 26-week heatmap and the weekly summary.
 */
export function EngineeringView() {
  const { data, viewer, view, navigate, openOverlay } = useHub();
  const personal = view !== "eng";
  const name = viewer.person?.name ?? viewer.name;
  const logs = data.workLogs;
  const now = useNow();
  const todayKey = now ? todayKeyIST(now) : "";
  const weekly = Math.max(0, Number(data.settings.weeklyHoursTarget) || 0);

  const dates = useMemo(() => logs.map((l) => l.date), [logs]);
  const period = usePeriod(dates, "week");
  const { range, prev } = period;
  const cur = useMemo(() => engineeringRollup(logs, range), [logs, range]);
  const before = useMemo(() => engineeringRollup(logs, prev), [logs, prev]);

  const activeRoster = data.roster.filter((r) => r.active === "Yes");
  const activePeople = personal ? 1 : data.roster.length ? activeRoster.length : FOUNDER_NAMES.length + DEVELOPER_NAMES.length;
  const capacity = Math.round(weekly * activePeople * weeksIn(range));
  const perBucket = bucketCapacity(range, weekly * activePeople);

  const blockers = useMemo(() => logs.filter(isOpenBlocker), [logs]);
  const recent = useMemo(
    () =>
      (personal ? [...logs] : [...cur.entries])
        .sort((a, b) => (b.date + (b.updatedAt ?? b.lastUpdated)).localeCompare(a.date + (a.updatedAt ?? a.lastUpdated)))
        .slice(0, personal ? 8 : 6),
    [logs, cur.entries, personal]
  );
  const activeDays = cur.hoursSeries.filter((h) => h > 0).length;
  const canLog = can(viewer, "worklog.edit", { data });

  const openEntry = (l: DailyWorkLogEntry) => openOverlay({ kind: "worklog", entry: l });

  const facts: { k: string; v: number; icon: React.ReactNode; alert?: boolean; go?: () => void }[] = [
    { k: personal ? "Awaiting review" : "In review", v: cur.review, icon: <GitBranch />, go: personal ? undefined : () => navigate("eng_log") },
    { k: personal ? "Shipped to prod" : "Shipped to production", v: cur.shipped, icon: <Boxes /> },
    { k: "Open blockers", v: blockers.length, icon: <AlertOctagon />, alert: blockers.length > 0, go: personal ? undefined : () => navigate("eng_blockers") },
    personal
      ? { k: "Active days", v: activeDays, icon: <CalendarDays /> }
      : { k: "Contributors", v: cur.people.length, icon: <Layers />, go: () => navigate("people") },
  ];

  return (
    <div className="space-y-4 lg:space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <PeriodPicker granularity={period.granularity} onGranularity={period.setGranularity} range={range} onShift={period.shift} onToday={period.reset} />
        {!personal && (
          <p className="px-1 text-[12.5px] text-ink-3">
            Capacity is {formatNumber(weekly, 1)} h a week for {activePeople} {activePeople === 1 ? "person" : "people"}
            {data.roster.length ? " on the roster" : ""}.
          </p>
        )}
      </div>

      {/* Bento: hours against capacity, completion, quick facts */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-5 xl:grid-cols-12">
        <section className="card-ink flex min-h-[250px] flex-col justify-between p-5 animate-rise sm:p-6 xl:col-span-4" aria-label={personal ? "My hours" : "Hours against capacity"}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lime">
                <Timer className="h-[18px] w-[18px]" />
              </span>
              <span className="text-[15px]">{personal ? "My hours" : "Hours vs capacity"}</span>
            </div>
            <Delta value={delta(cur.hours, before.hours)} dark />
          </div>
          <div className="mt-6">
            <div className="flex flex-wrap items-end gap-x-2">
              <span className="num text-[56px] sm:text-[64px]">{formatNumber(cur.hours, 1)}</span>
              <span className="mb-2 text-[14px] text-white/55">h of {capacity ? `${formatNumber(capacity)} h` : "no capacity set"}</span>
              {capacity > 0 && <span className="chip chip-lime mb-3 ml-1">{pct(cur.hours, capacity)}%</span>}
            </div>
            <div className="mt-5">
              <SegmentMeter value={cur.hours} total={Math.max(capacity, 1)} slots={9} dark ariaLabel={`${formatNumber(cur.hours, 1)} of ${formatNumber(capacity)} hours`} />
            </div>
          </div>
        </section>

        <section className="card flex min-h-[250px] flex-col justify-between p-5 animate-rise sm:p-6 xl:col-span-4" style={{ animationDelay: "60ms" }} aria-label="Completed">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2">
                <CheckCircle2 className="h-[18px] w-[18px]" />
              </span>
              <span className="text-[15px]">{personal ? "Completed" : "Tasks completed"}</span>
            </div>
            <Delta value={delta(cur.completed, before.completed)} />
          </div>
          <div className="mt-6">
            <div className="flex items-end gap-2">
              <span className="num text-[56px] sm:text-[64px]">{cur.completed}</span>
              <span className="mb-2 text-[14px] text-ink-3">
                of {cur.count} {cur.count === 1 ? "entry" : "entries"}
              </span>
            </div>
            <div className="mt-5">
              <SplitBar
                height={14}
                parts={[
                  { key: "c", value: cur.completed, className: "bg-ink dark:bg-lime", label: "Completed" },
                  { key: "p", value: cur.inProgress, className: "bg-lime dark:bg-white/35", label: "In progress" },
                  { key: "b", value: cur.blocked, className: "bg-coral", label: "Blocked" },
                ]}
              />
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-3">
                <Dot className="bg-ink dark:bg-lime" label={`${cur.completed} done`} />
                <Dot className="bg-lime dark:bg-white/35" label={`${cur.inProgress} in progress`} />
                <Dot className="bg-coral" label={`${cur.blocked} blocked`} />
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4 md:col-span-2 lg:gap-5 xl:col-span-4" aria-label="Quick facts">
          {facts.map((s, i) => {
            const cls = `${s.alert ? "rounded-[var(--radius-card)] bg-coral text-white" : "card"} flex min-h-[117px] flex-col justify-between p-4 text-left animate-rise sm:p-5`;
            const inner = (
              <>
                <span className="flex items-center justify-between gap-2">
                  <span className={`text-[12.5px] ${s.alert ? "text-white/85" : "text-ink-3"}`}>{s.k}</span>
                  <span aria-hidden className={`[&>svg]:h-4 [&>svg]:w-4 ${s.alert ? "text-white" : "text-ink-2"}`}>
                    {s.go ? <ArrowUpRight /> : s.icon}
                  </span>
                </span>
                <span className="num text-[36px]">{s.v}</span>
              </>
            );
            return s.go ? (
              <button key={s.k} type="button" onClick={s.go} className={`${cls} card-interactive`} style={{ animationDelay: `${120 + i * 40}ms` }}>
                {inner}
              </button>
            ) : (
              <div key={s.k} className={cls} style={{ animationDelay: `${120 + i * 40}ms` }}>
                {inner}
              </div>
            );
          })}
        </section>
      </div>

      {/* Daily effort and where time went */}
      <div className="grid grid-cols-1 gap-4 lg:gap-5 xl:grid-cols-12">
        <section className="card p-5 sm:p-6 xl:col-span-8">
          <CardHeader
            icon={<Clock3 />}
            title="Daily effort"
            subtitle={`${range.label}, hours per ${range.granularity === "year" ? "month" : range.granularity === "quarter" ? "week" : "day"} against the previous period`}
          />
          <div className="mt-7">
            {cur.count === 0 && before.count === 0 ? (
              <EmptyState
                icon={<Clock3 />}
                title="Nothing logged in this period"
                body="Use the arrows to look at another period, or log today's work."
                action={
                  canLog ? (
                    <button type="button" className="btn btn-ink btn-sm" onClick={() => openOverlay({ kind: "worklog", entry: null })}>
                      Log work
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <ColumnChart
                ariaLabel={personal ? `Hours ${name} logged, ${range.label}` : `Hours the team logged, ${range.label}`}
                data={range.buckets.map((b, i) => ({
                  key: b.key,
                  label: b.label,
                  title: b.title,
                  value: cur.hoursSeries[i],
                  detail: `${cur.entrySeries[i]} ${cur.entrySeries[i] === 1 ? "entry" : "entries"}`,
                }))}
                compare={before.hoursSeries.slice(0, range.buckets.length)}
                target={perBucket.value > 0 ? Math.round(perBucket.value * 10) / 10 : undefined}
                seriesLabel="Hours"
                compareLabel="Previous period"
                targetLabel={perBucket.label}
                format={fmtH}
              />
            )}
          </div>
        </section>

        <section className="card p-5 sm:p-6 xl:col-span-4">
          <CardHeader title="Where time went" subtitle="Hours by work type" />
          <div className="mt-6">
            <RankedBars
              ariaLabel="Hours by work type"
              emptyLabel="No hours logged in this period."
              items={cur.byType.slice(0, 6).map(([label, value]) => ({ label: label || "Other", value }))}
              format={fmtH}
            />
          </div>
          {cur.byRepo.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
              {cur.byRepo.map(([repo, n]) => (
                <button
                  key={repo}
                  type="button"
                  onClick={() => navigate("eng_log", { q: repo })}
                  className="chip font-mono text-[11.5px] transition-colors hover:bg-lime hover:text-on-lime"
                  title={`Show ${repo} in the work log`}
                >
                  {repo || "No repository"} <span className="text-ink-3">{n}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {personal && (
        <PersonalWeek name={name} logs={logs} todayKey={todayKey} weekly={weekly} />
      )}

      {/* Latest entries and blockers */}
      <div className="grid grid-cols-1 gap-4 lg:gap-5 xl:grid-cols-12">
        <section className="card p-5 sm:p-6 xl:col-span-7">
          <CardHeader
            title="Latest entries"
            subtitle={personal ? "Your last 8 entries" : range.label}
            action={
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate("eng_log")}>
                Open work log <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
              </button>
            }
          />
          {recent.length === 0 ? (
            <EmptyState
              className="py-8!"
              icon={<Clock3 />}
              title={personal ? "You haven't logged any work yet" : "No entries in this period"}
              action={
                canLog ? (
                  <button type="button" className="btn btn-ink btn-sm" onClick={() => openOverlay({ kind: "worklog", entry: null })}>
                    Log work
                  </button>
                ) : undefined
              }
            />
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {recent.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => openEntry(l)}
                    className="-mx-2 flex w-[calc(100%+16px)] items-start gap-3 rounded-xl px-2 py-3.5 text-left transition-colors hover:bg-surface-2"
                  >
                    {!personal && <Avatar name={l.developerName} size={34} />}
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-[14px] font-medium text-ink">{l.module || l.project || "Untitled task"}</span>
                        {l.githubPr && !/^https?:\/\//i.test(l.githubPr) && <span className="shrink-0 font-mono text-[11px] text-ink-3">{l.githubPr}</span>}
                      </span>
                      <span className="mt-0.5 block truncate text-[12.5px] text-ink-3">
                        {!personal && `${l.developerName}, `}
                        {l.taskDescription || l.workType}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <StatusPill status={isOpenBlocker(l) ? "Blocked" : l.workStatus} />
                      <span className="text-[12px] tabular-nums text-ink-3">
                        {formatDateIST(l.date)}, {formatNumber(Number(l.hours) || 0, 2)} h
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="xl:col-span-5">
          <BlockerList logs={blockers} showPerson={!personal} title={personal ? "My blockers" : "Blockers"} limit={5} onShowAll={personal ? undefined : () => navigate("eng_blockers")} />
        </div>
      </div>

      {!personal && <TeamFooter todayKey={todayKey} range={range} byRepo={cur.byRepo} />}
    </div>
  );
}

/* ------------------------------------------------------------------ Personal: heatmap and summary */

function PersonalWeek({ name, logs, todayKey, weekly }: { name: string; logs: DailyWorkLogEntry[]; todayKey: string; weekly: number }) {
  const cells = useMemo(() => (todayKey ? workLogHeatmap(logs, null, 26, todayKey) : []), [logs, todayKey]);
  const weekHours = useMemo(
    () => (todayKey ? entriesInWeek(logs, istWeekStart(todayKey)).reduce((s, l) => s + (Number(l.hours) || 0), 0) : 0),
    [logs, todayKey]
  );
  return (
    <section aria-labelledby="your-week" className="space-y-4">
      <SectionHeader
        id="your-week"
        title="Your week"
        description={todayKey ? `${formatNumber(weekHours, 1)} h this week of ${formatNumber(weekly, 1)} h` : "Hours you logged over the last six months"}
      />
      <div className="grid grid-cols-1 gap-4 lg:gap-5 xl:grid-cols-12">
        <div className="card min-w-0 p-5 sm:p-6 xl:col-span-7">
          <CardHeader icon={<CalendarDays />} title="Last 26 weeks" subtitle="Hours logged each day, darker means more" />
          <div className="mt-6">
            <Heatmap cells={cells} ariaLabel={`Hours ${name} logged each day over the last 26 weeks`} unit="h" emptyLabel="Nothing logged yet." />
          </div>
          <div className="mt-5 flex items-center gap-3 rounded-[var(--radius-inset)] bg-surface-2 px-4 py-3">
            <span className="num text-[28px]">{formatNumber(weekHours, 1)}</span>
            <span className="min-w-0 text-[13px] text-ink-2">
              h this week of {formatNumber(weekly, 1)} h
              {weekly > 0 && <span className="text-ink-3">, {pct(weekHours, weekly)}% of your target</span>}
            </span>
          </div>
        </div>
        <div className="min-w-0 xl:col-span-5">
          <WeeklySummary name={name} logs={logs} todayKey={todayKey} weeklyTarget={weekly} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Team: log gaps and repositories */

function TeamFooter({ todayKey, range, byRepo }: { todayKey: string; range: Range; byRepo: [string, number][] }) {
  const { data, viewer, navigate } = useHub();
  const [pref] = useComposePref();

  const people = useMemo(() => {
    const names = data.roster.length
      ? data.roster.filter((r) => r.active === "Yes").map((r) => r.developerName)
      : [...FOUNDER_NAMES, ...DEVELOPER_NAMES];
    return [...new Set(names.filter(Boolean))].map((n) => ({ name: n, email: personByName(n)?.email }));
  }, [data.roster]);

  const gaps = useMemo(
    () =>
      todayKey
        ? logGaps(data.workLogs, people, todayKey)
            .filter((g) => g.workingDaysMissed > 0)
            .sort((a, b) => b.workingDaysMissed - a.workingDaysMissed)
        : [],
    [data.workLogs, people, todayKey]
  );
  const repoCount = new Map(byRepo);

  return (
    <div className="grid grid-cols-1 gap-4 lg:gap-5 xl:grid-cols-12">
      <section className="card p-5 sm:p-6 xl:col-span-7" aria-labelledby="log-gaps-title">
        <CardHeader
          icon={<UserRoundX />}
          title={<span id="log-gaps-title">Log gaps</span>}
          subtitle={gaps.length ? `${gaps.length} ${gaps.length === 1 ? "person has" : "people have"} missed a working day` : "Monday to Saturday, not counting today"}
        />
        {!todayKey ? (
          <div aria-hidden className="mt-4 space-y-2">
            <span className="skeleton block h-14 rounded-[18px]" />
            <span className="skeleton block h-14 rounded-[18px]" />
          </div>
        ) : gaps.length === 0 ? (
          <EmptyState className="py-8!" icon={<CheckCircle2 />} title="Everyone is up to date" body="Each active person has logged work for every working day." />
        ) : (
          <ul className="mt-4 space-y-2.5">
            {gaps.map((g) => {
              const first = g.lastDate ? nextWorkingDay(g.lastDate) : todayKey;
              const sentence = g.lastDate
                ? `${g.person.name} has not logged work since ${formatDateIST(g.lastDate, { weekday: true })}.`
                : `${g.person.name} has not logged any work in the last 30 days.`;
              const subject = `Work log for ${formatDateIST(first, { weekday: true })}`;
              const body = `Hi ${g.person.name},\n\nThe hub has no work log from you ${
                g.lastDate ? `since ${formatDateIST(g.lastDate, { weekday: true })}` : "in the last 30 days"
              }. Please add the missing days today.\n\nThanks`;
              return (
                <li key={g.person.name} className="card-inset flex items-center gap-3 p-4">
                  <Avatar name={g.person.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] text-ink">{sentence}</p>
                    <p className="mt-0.5 text-[12px] text-ink-3">
                      {g.workingDaysMissed} working {g.workingDaysMissed === 1 ? "day" : "days"} without a log
                    </p>
                  </div>
                  {g.person.email && (
                    <a
                      href={composeHref({ to: g.person.email, subject, body }, pref)}
                      target={pref === "mailto" ? undefined : "_blank"}
                      rel={pref === "mailto" ? undefined : "noopener noreferrer"}
                      className="btn btn-ghost btn-sm shrink-0"
                      aria-label={`Email ${g.person.name} about the missing work log`}
                    >
                      <Mail aria-hidden className="size-3.5" />
                      Email
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card p-5 sm:p-6 xl:col-span-5" aria-labelledby="repos-title">
        <CardHeader
          icon={<GitBranch />}
          title={<span id="repos-title">Repositories</span>}
          subtitle={`Entries in ${range.label}`}
          action={
            can(viewer, "roster.edit") ? (
              <button type="button" className="icon-btn" aria-label="Manage repositories in the roster" onClick={() => navigate("eng_roster")}>
                <ArrowUpRight aria-hidden />
              </button>
            ) : undefined
          }
        />
        {data.repositories.length === 0 ? (
          <EmptyState
            className="py-8!"
            icon={<GitBranch />}
            title="No repositories yet"
            action={
              can(viewer, "roster.edit") ? (
                <button type="button" className="btn btn-ink btn-sm" onClick={() => navigate("eng_roster")}>
                  Add a repository
                </button>
              ) : undefined
            }
          />
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {data.repositories.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => navigate("eng_log", { q: r.repository })}
                    className="block max-w-full truncate font-mono text-[13px] text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
                  >
                    {r.repository}
                  </button>
                  <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                    {r.projectName}
                    {r.type ? `, ${r.type}` : ""}
                  </span>
                </div>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-[12px] tabular-nums text-ink-3">{repoCount.get(r.repository) ?? 0} entries</span>
                  <span className={`chip ${r.status === "Active" ? "chip-good" : r.status === "Maintenance" ? "chip-amber" : ""}`}>{r.status}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Dot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={`h-2 w-2 rounded-full ${className}`} />
      {label}
    </span>
  );
}
