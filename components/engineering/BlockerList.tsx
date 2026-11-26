"use client";

import React from "react";
import { AlertOctagon, CheckCircle2 } from "lucide-react";
import type { DailyWorkLogEntry } from "@/lib/types";
import { useHub } from "@/lib/hub/context";
import { can } from "@/lib/hub/permissions";
import { useNow } from "@/lib/prefs";
import { daysBetween, formatDateIST, parseInstant, todayKeyIST } from "@/lib/format";
import { Avatar, CardHeader, EmptyState } from "@/components/ui/primitives";
import { useConfirm, useToast } from "@/components/ui/feedback";

/** Open blocker: flagged as blocked (or in the Blocked status) and not completed. */
export function isOpenBlocker(l: DailyWorkLogEntry): boolean {
  return (l.isBlocked === "Yes" || l.workStatus === "Blocked") && l.workStatus !== "Completed";
}

/** Hours since the blocker was raised: createdAt when known, otherwise the start of its day in IST. */
function ageHours(l: DailyWorkLogEntry, now: number): number | null {
  if (!now) return null;
  const at = parseInstant(l.createdAt ?? "") ?? parseInstant(l.date);
  if (at === null) return null;
  return Math.max(0, (now - at) / 3_600_000);
}

function ageText(l: DailyWorkLogEntry, todayKey: string): string {
  if (!todayKey) return formatDateIST(l.date, { weekday: true });
  const days = Math.max(0, daysBetween(l.date, todayKey));
  if (days === 0) return "Raised today";
  if (days === 1) return "Open 1 day";
  return `Open ${days} days`;
}

/** Resolve a blocker: confirm, set it back to In Progress, then a toast with Undo. */
export function useResolveBlocker(): (l: DailyWorkLogEntry) => Promise<void> {
  const { data } = useHub();
  const confirm = useConfirm();
  const toast = useToast();
  const now = useNow();
  return async (l: DailyWorkLogEntry) => {
    const ok = await confirm({
      title: "Resolve this blocker?",
      body: `${l.module || l.project || "This entry"} for ${l.developerName} goes back to In Progress.`,
      confirmLabel: "Resolve",
    });
    if (!ok) return;
    const before = { isBlocked: l.isBlocked, workStatus: l.workStatus, blockerDetails: l.blockerDetails };
    const stamp = formatDateIST(now ? todayKeyIST(now) : l.date, { year: true });
    await data.updateWorkLogStatus(l.id, {
      isBlocked: "No",
      workStatus: "In Progress",
      blockerDetails: l.blockerDetails ? `Resolved on ${stamp}: ${l.blockerDetails}` : `Resolved on ${stamp}`,
    });
    toast({
      message: "Blocker resolved",
      tone: "positive",
      action: { label: "Undo", onClick: () => void data.updateWorkLogStatus(l.id, before) },
    });
  };
}

/**
 * Open blockers as inset rows: who, which module, the blocker and how long it has been open.
 * Older than 24 hours turns coral (the SOP escalation point). Resolve asks first, then offers Undo.
 */
export function BlockerList({
  logs,
  showPerson = true,
  title = "Blockers",
  limit,
  onShowAll,
}: {
  logs: DailyWorkLogEntry[];
  showPerson?: boolean;
  title?: string;
  limit?: number;
  onShowAll?: () => void;
}) {
  const { data, viewer } = useHub();
  const resolve = useResolveBlocker();
  const now = useNow();
  const todayKey = now ? todayKeyIST(now) : "";

  const open = logs
    .filter(isOpenBlocker)
    .sort((a, b) => (a.date + (a.createdAt ?? "")).localeCompare(b.date + (b.createdAt ?? "")));
  const shown = limit ? open.slice(0, limit) : open;
  const aged = open.filter((l) => (ageHours(l, now) ?? 0) > 24).length;

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="blockers-title">
      <CardHeader
        icon={<AlertOctagon />}
        title={<span id="blockers-title">{title}</span>}
        subtitle={
          open.length === 0
            ? "Nothing blocked"
            : aged > 0
            ? `${open.length} open, ${aged} older than a day`
            : `${open.length} need unblocking`
        }
        action={
          onShowAll && open.length > 0 ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onShowAll}>
              All blockers
            </button>
          ) : undefined
        }
      />
      {open.length === 0 ? (
        <EmptyState
          className="py-8!"
          icon={<CheckCircle2 />}
          title="All clear"
          body="Turn on Blocked when you log work and it shows up here for the team."
        />
      ) : (
        <ul className="mt-4 space-y-2.5">
          {shown.map((b) => {
            const hours = ageHours(b, now);
            const late = hours !== null && hours > 24;
            const allowed = can(viewer, "worklog.edit", { data, record: b });
            return (
              <li key={b.id} className="card-inset p-4">
                <div className="flex items-start gap-3">
                  {showPerson && <Avatar name={b.developerName} size={32} className="mt-0.5" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-[13.5px] font-medium text-ink">{b.module || b.project || "Untitled task"}</span>
                      <span className={`chip ${late ? "chip-coral" : "chip-amber"}`}>
                        <span aria-hidden className={`dot ${late ? "dot-negative" : "dot-warning"}`} />
                        {ageText(b, todayKey)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12.5px] text-negative">{b.blockerDetails || "No details given yet."}</p>
                    <p className="mt-1.5 text-[12px] text-ink-3">
                      {showPerson ? `${b.developerName}, ` : ""}
                      {formatDateIST(b.date, { weekday: true })}, {b.priority} priority
                    </p>
                  </div>
                  {allowed && (
                    <button type="button" onClick={() => void resolve(b)} className="btn btn-ink btn-sm shrink-0" aria-label={`Resolve blocker on ${b.module || "this task"}`}>
                      Resolve
                    </button>
                  )}
                </div>
              </li>
            );
          })}
          {limit && open.length > limit && onShowAll && (
            <li>
              <button type="button" onClick={onShowAll} className="w-full rounded-full py-2 text-center text-[12.5px] font-medium text-ink-2 hover:bg-surface-2">
                {open.length - limit} more
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
