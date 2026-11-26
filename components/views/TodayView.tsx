"use client";

import React, { useMemo, useState } from "react";
import {
  BadgeIndianRupee,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Eye,
  MapPin,
  PenLine,
  Plus,
  TriangleAlert,
  UserPlus,
  Building2,
} from "lucide-react";
import { useHub } from "@/lib/hub/context";
import { can } from "@/lib/hub/permissions";
import { useNow } from "@/lib/prefs";
import { deriveAlerts, type HubAlert } from "@/lib/alerts";
import { canAccessView } from "@/lib/views";
import { daysBetween, dayKeyOf, formatDateIST, formatInr, todayKeyIST } from "@/lib/format";
import type { DailyWorkLogEntry, MarketingDeal } from "@/lib/types";
import { dueText, StatusDot, toneForStage, type Tone } from "@/components/ui/Status";
import { EmptyState } from "@/components/ui/primitives";
import { DelayedSkeleton } from "@/components/ui/Skeleton";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { dayPhrase } from "@/components/overview/AttentionList";
import { LocalUploadNotice, UnsyncedNotice } from "@/components/overview/LocalUploadNotice";

const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CLOSED = new Set(["Closed Won", "Closed Lost"]);

/** 'Tuesday, 25 Nov' for an IST day key. */
function longDate(key: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `${WEEKDAY_LONG[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function isOpenBlocker(l: DailyWorkLogEntry): boolean {
  return (l.isBlocked === "Yes" || l.workStatus === "Blocked") && l.workStatus !== "Completed";
}

interface RowAction {
  label: string;
  aria?: string;
  icon?: React.ReactNode;
  primary?: boolean;
  onClick: () => void;
}

interface Row {
  id: string;
  tone: Tone;
  title: React.ReactNode;
  meta?: React.ReactNode;
  actions: RowAction[];
}

interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
  rows: Row[];
}

/**
 * Today: what needs the viewer now. Admin gets the whole team as section cards; members get one
 * "Today" card above their personal dashboard (the shell renders that dashboard below).
 */
export function TodayView() {
  const { data, all, viewer, features, navigate, openOverlay } = useHub();
  const now = useNow();
  const todayKey = useMemo(() => (now ? todayKeyIST(now) : ""), [now]);
  const toast = useToast();
  const confirm = useConfirm();
  const [resolving, setResolving] = useState<string | null>(null);
  const isAdmin = viewer.category === "admin";

  const alerts = useMemo<HubAlert[]>(
    () => (todayKey ? deriveAlerts(data, viewer, { todayKey, features }) : []),
    [data, viewer, todayKey, features]
  );

  const lists = useMemo(() => {
    const seesDeals = canAccessView(viewer.category, "mkt_deals");
    const openDeals = seesDeals ? data.deals.filter((d) => !CLOSED.has(d.leadStatus) && d.followUpStatus !== "Completed") : [];
    const dueKey = (d: MarketingDeal) => dayKeyOf(d.nextFollowUpDate) ?? "";
    const overdue = openDeals.filter((d) => dueKey(d) && dueKey(d) < todayKey).sort((a, b) => dueKey(a).localeCompare(dueKey(b)));
    const dueToday = openDeals.filter((d) => dueKey(d) === todayKey).sort((a, b) => a.companyName.localeCompare(b.companyName));
    const blockers = (isAdmin ? all.workLogs : data.workLogs).filter(isOpenBlocker).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    const reviews = all.workLogs
      .filter((l) => l.reviewer && l.reviewer === viewer.name && l.workStatus !== "Completed")
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    const ofKind = (...kinds: HubAlert["kind"][]) => alerts.filter((a) => kinds.includes(a.kind));
    return {
      overdue,
      dueToday,
      blockers,
      reviews,
      missing: ofKind("missing_log"),
      won: isAdmin ? ofKind("deal_won") : [],
      invoices: isAdmin ? ofKind("invoice_overdue", "invoice_due") : [],
      metaLeads: isAdmin ? ofKind("meta_lead") : [],
    };
  }, [data.deals, data.workLogs, all.workLogs, alerts, todayKey, isAdmin, viewer.category, viewer.name]);

  const teamSummary = useMemo(() => {
    if (!isAdmin) return "";
    const blockers = all.workLogs.filter(isOpenBlocker).length;
    const followUps = all.deals.filter((d) => {
      const k = dayKeyOf(d.nextFollowUpDate);
      return !CLOSED.has(d.leadStatus) && d.followUpStatus !== "Completed" && !!k && !!todayKey && k < todayKey;
    }).length;
    const overdue = all.payments.reduce((s, p) => s + (Number(p.overdueAmount) || 0), 0);
    const parts = [
      blockers ? plural(blockers, "open blocker", "open blockers") : "",
      followUps ? `${plural(followUps, "follow-up", "follow-ups")} overdue` : "",
      overdue > 0 ? `${formatInr(overdue)} overdue` : "",
    ].filter(Boolean);
    if (!parts.length) return "No open blockers, overdue follow-ups or overdue invoices.";
    const s = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
    return `${s[0].toUpperCase()}${s.slice(1)} across the team.`;
  }, [isAdmin, all.workLogs, all.deals, all.payments, todayKey]);

  if (!data.ready || !todayKey) return <DelayedSkeleton label="Loading today" />;

  const canDraft = features.assistant.configured && can(viewer, "agent.run", { agentKey: "follow_up", data });
  const canLogVisit = can(viewer, "visit.edit", { data });

  const dealRow = (d: MarketingDeal, tone: Tone): Row => {
    const actions: RowAction[] = [
      { label: "Open", aria: `Open ${d.companyName}`, onClick: () => openOverlay({ kind: "deal", dealId: d.id }) },
    ];
    if (canLogVisit && can(viewer, "visit.edit", { data, record: { marketingPerson: d.marketingPerson } })) {
      actions.push({
        label: "Log visit",
        aria: `Log visit for ${d.companyName}`,
        icon: <MapPin aria-hidden className="h-3.5 w-3.5" />,
        onClick: () => openOverlay({ kind: "visit", visitId: null, dealId: d.id }),
      });
    }
    if (canDraft) {
      actions.push({
        label: "Draft follow-up",
        aria: `Draft follow-up for ${d.companyName}`,
        icon: <PenLine aria-hidden className="h-3.5 w-3.5" />,
        onClick: () => openOverlay({ kind: "agent", agentKey: "follow_up", ref: { type: "deal", id: d.id } }),
      });
    }
    return {
      id: `deal:${d.id}`,
      tone,
      title: (
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{d.companyName || "Untitled deal"}</span>
          <StatusDot tone={toneForStage(d.leadStatus)} label={d.leadStatus} />
        </span>
      ),
      meta: [d.followUpAction?.trim(), dueText(d, todayKey), isAdmin && d.marketingPerson ? `Owner ${d.marketingPerson}` : ""].filter(Boolean).join(". "),
      actions,
    };
  };

  const resolve = async (log: DailyWorkLogEntry) => {
    const where = log.module || log.project || "this task";
    const ok = await confirm({
      title: `Resolve the blocker on ${where}?`,
      body: "The entry moves back to In progress and the blocker note records today's date.",
      confirmLabel: "Resolve",
    });
    if (!ok) return;
    const previous: Partial<DailyWorkLogEntry> = { isBlocked: log.isBlocked, workStatus: log.workStatus, blockerDetails: log.blockerDetails };
    setResolving(log.id);
    try {
      await data.updateWorkLogStatus(log.id, {
        isBlocked: "No",
        workStatus: "In Progress",
        blockerDetails: `Resolved on ${formatDateIST(todayKeyIST())}`,
      });
      toast({
        message: "Blocker resolved",
        tone: "positive",
        action: { label: "Undo", onClick: () => void data.updateWorkLogStatus(log.id, previous) },
      });
    } catch {
      toast({ message: "Could not resolve the blocker. Try again.", tone: "negative" });
    } finally {
      setResolving(null);
    }
  };

  const blockerRow = (l: DailyWorkLogEntry): Row => {
    const where = l.module || l.project || "a task";
    const age = l.date ? Math.max(0, daysBetween(l.date, todayKey)) : 0;
    const actions: RowAction[] = [{ label: "Open", aria: `Open the entry for ${where}`, onClick: () => openOverlay({ kind: "worklog", entry: l }) }];
    if (can(viewer, "worklog.edit", { data, record: l })) {
      actions.push({
        label: resolving === l.id ? "Resolving" : "Resolve",
        aria: `Resolve the blocker on ${where}`,
        icon: <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />,
        primary: true,
        onClick: () => void resolve(l),
      });
    }
    return {
      id: `blocker:${l.id}`,
      tone: "negative",
      title: `${isAdmin || l.developerName !== viewer.name ? `${l.developerName}: ` : ""}blocked on ${where}`,
      meta: [l.blockerDetails?.trim(), age === 0 ? "Raised today" : `Open ${plural(age, "day", "days")}`].filter(Boolean).join(". "),
      actions,
    };
  };

  const alertRow = (a: HubAlert, actions: RowAction[]): Row => ({
    id: a.id,
    tone: a.tone,
    title: a.title,
    meta: [a.detail, a.date ? dayPhrase(a.date, todayKey).replace(/^./, (c) => c.toUpperCase()) : ""].filter(Boolean).join(". "),
    actions,
  });

  const sections: Section[] = [
    {
      id: "overdue",
      title: "Follow-ups overdue",
      icon: <TriangleAlert />,
      rows: lists.overdue.map((d) => dealRow(d, "negative")),
    },
    {
      id: "due-today",
      title: "Due today",
      icon: <CalendarClock />,
      rows: lists.dueToday.map((d) => dealRow(d, "warning")),
    },
    {
      id: "blockers",
      title: isAdmin ? "Blockers" : "Your blockers",
      icon: <TriangleAlert />,
      rows: lists.blockers.map(blockerRow),
    },
    {
      id: "reviews",
      title: "Reviews waiting on you",
      icon: <Eye />,
      rows: lists.reviews.map((l) => {
        const where = l.module || l.project || "a task";
        return {
          id: `review:${l.id}`,
          tone: "accent" as Tone,
          title: `${l.developerName} asked you to review ${where}`,
          meta: [l.taskDescription?.trim(), l.date ? dayPhrase(dayKeyOf(l.date) ?? "", todayKey).replace(/^./, (c) => c.toUpperCase()) : ""]
            .filter(Boolean)
            .join(". "),
          actions: [{ label: "Open", aria: `Open ${l.developerName}'s entry for ${where}`, onClick: () => openOverlay({ kind: "worklog", entry: l }) }],
        };
      }),
    },
    {
      id: "missing",
      title: "Missing work log",
      icon: <Clock3 />,
      rows: lists.missing.map((a) => ({
        id: a.id,
        tone: "warning" as Tone,
        title: a.title,
        meta: "Add what you worked on so the team dashboard stays accurate.",
        actions: [
          {
            label: "Log work",
            icon: <Plus aria-hidden className="h-3.5 w-3.5" />,
            primary: true,
            onClick: () => openOverlay(a.overlay ?? { kind: "worklog", entry: null, prefill: { date: a.date } }),
          },
        ],
      })),
    },
    {
      id: "won",
      title: "Won deals without a client record",
      icon: <Building2 />,
      rows: lists.won.map((a) =>
        alertRow(a, [
          {
            label: "Create client",
            icon: <Plus aria-hidden className="h-3.5 w-3.5" />,
            primary: true,
            onClick: () => (a.overlay ? openOverlay(a.overlay) : navigate("clients")),
          },
        ])
      ),
    },
    {
      id: "invoices",
      title: "Invoices due or overdue",
      icon: <BadgeIndianRupee />,
      rows: lists.invoices.map((a) => {
        const recordId = a.overlay?.kind === "invoice" ? a.overlay.invoiceId : null;
        const inv = recordId ? data.payments.find((p) => p.id === recordId) : undefined;
        return alertRow(a, [
          {
            label: "Open",
            aria: `Open invoice ${inv?.invoiceId ?? ""}`.trim(),
            onClick: () => navigate("billing", { q: inv?.invoiceId || null }),
          },
        ]);
      }),
    },
    {
      id: "meta",
      title: "New Meta leads with no owner",
      icon: <UserPlus />,
      rows: lists.metaLeads.map((a) =>
        alertRow(a, [
          {
            label: "Assign",
            icon: <UserPlus aria-hidden className="h-3.5 w-3.5" />,
            primary: true,
            onClick: () => (a.overlay ? openOverlay(a.overlay) : navigate("mkt_deals")),
          },
        ])
      ),
    },
  ];
  const visible = sections.filter((s) => s.rows.length > 0);
  const total = visible.reduce((s, x) => s + x.rows.length, 0);
  const dateLine = longDate(todayKey);

  if (isAdmin) {
    return (
      <div className="space-y-4 lg:space-y-5">
        <div className="px-1">
          <p className="text-[20px] font-medium leading-tight tracking-[-0.03em] text-ink">{dateLine}</p>
          <p className="mt-1 text-[13.5px] text-ink-2">{teamSummary}</p>
        </div>
        <LocalUploadNotice />
        <UnsyncedNotice />
        {visible.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<CalendarCheck />}
              title="Nothing due today."
              body="No overdue follow-ups, blockers, reviews or invoices due this week."
              action={
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate("overview")}>
                  Open the Command Center
                </button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-5">
            {visible.map((s) => (
              <section key={s.id} aria-labelledby={`today-${s.id}`} className="card min-w-0 p-5 sm:p-6">
                <SectionTitle id={`today-${s.id}`} icon={s.icon} title={s.title} count={s.rows.length} large />
                <Rows rows={s.rows} />
              </section>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-5">
      <LocalUploadNotice />
      <UnsyncedNotice />
      {visible.length === 0 ? (
        <p className="flex items-center gap-2 px-1 text-[13.5px] text-ink-3">
          <CheckCircle2 aria-hidden className="h-4 w-4 text-positive" />
          Nothing due today.
        </p>
      ) : (
        <section aria-labelledby="today-card-title" className="card min-w-0 animate-rise p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lime text-on-lime">
                <CalendarCheck className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <h2 id="today-card-title" className="truncate text-[17px] font-medium leading-tight tracking-[-0.02em]">
                  Today
                </h2>
                <p className="mt-1 truncate text-[12.5px] text-ink-3">
                  {dateLine} · {plural(total, "thing", "things")} to do
                </p>
              </div>
            </div>
            {visible.some((s) => s.rows.some((r) => r.tone === "negative")) && (
              <span className="chip chip-coral shrink-0">
                <span aria-hidden className="dot dot-negative" />
                {visible.reduce((n, s) => n + s.rows.filter((r) => r.tone === "negative").length, 0)} urgent
              </span>
            )}
          </div>
          <div className={`mt-5 grid grid-cols-1 gap-x-8 gap-y-6 ${visible.length > 1 ? "lg:grid-cols-2" : ""}`}>
            {visible.map((s) => (
              <div key={s.id} className="min-w-0">
                <SectionTitle id={`today-${s.id}`} icon={s.icon} title={s.title} count={s.rows.length} />
                <Rows rows={s.rows} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionTitle({ id, icon, title, count, large = false }: { id: string; icon: React.ReactNode; title: string; count: number; large?: boolean }) {
  if (large) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink [&>svg]:h-[18px] [&>svg]:w-[18px]">
            {icon}
          </span>
          <h2 id={id} className="truncate text-[17px] font-medium leading-tight tracking-[-0.02em]">
            {title}
          </h2>
        </div>
        <span className="chip chip-outline shrink-0 tabular-nums">{count}</span>
      </div>
    );
  }
  return (
    <h3 id={id} className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
      <span aria-hidden className="text-ink-3 [&>svg]:h-3.5 [&>svg]:w-3.5">
        {icon}
      </span>
      {title}
      <span className="chip chip-outline h-5! px-2! text-[11px]! tabular-nums">{count}</span>
    </h3>
  );
}

function Rows({ rows }: { rows: Row[] }) {
  return (
    <ul className="@container mt-3 divide-y divide-line">
      {rows.map((r) => (
        <li key={r.id} className="flex min-h-11 flex-col gap-2.5 py-3 @lg:flex-row @lg:items-center @lg:gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span aria-hidden className={`dot dot-${r.tone} mt-[7px] shrink-0`} />
            <div className="min-w-0">
              <div className="text-[13.5px] font-medium leading-snug text-ink">{r.title}</div>
              {r.meta && <div className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{r.meta}</div>}
            </div>
          </div>
          {r.actions.length > 0 && (
            <div className="flex flex-wrap gap-2 pl-[18px] @lg:shrink-0 @lg:pl-0">
              {r.actions.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={a.onClick}
                  aria-label={a.aria}
                  className={`btn btn-sm min-h-9 ${a.primary ? "btn-ink" : "btn-ghost"}`}
                >
                  {a.icon}
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
