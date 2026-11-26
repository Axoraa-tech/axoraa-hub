"use client";

import React, { useMemo } from "react";
import { ClipboardList, MessageCircle } from "lucide-react";
import type { DailyWorkLogEntry } from "@/lib/types";
import { COMPANY_EMAIL } from "@/lib/company";
import { addDaysKey, dayKeyOf, formatDateIST, formatNumber } from "@/lib/format";
import { CardHeader } from "@/components/ui/primitives";
import { ComposeActions } from "@/components/ui/ComposeActions";
import { useToast } from "@/components/ui/feedback";
import { isOpenBlocker } from "./BlockerList";

/** Monday of the IST week that contains `dayKey`. */
export function istWeekStart(dayKey: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!m) return dayKey;
  const dow = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay(); // Sunday = 0
  return addDaysKey(dayKey, -((dow + 6) % 7));
}

/** Entries dated in the Monday-to-Sunday week starting at `weekStart`. */
export function entriesInWeek(logs: DailyWorkLogEntry[], weekStart: string): DailyWorkLogEntry[] {
  const end = addDaysKey(weekStart, 7);
  return logs.filter((l) => {
    const d = dayKeyOf(l.date);
    return !!d && d >= weekStart && d < end;
  });
}

const label = (l: DailyWorkLogEntry) => {
  const what = l.module || l.project || "Untitled task";
  return l.taskDescription ? `${what}: ${l.taskDescription}` : what;
};

interface Summary {
  hours: number;
  completed: DailyWorkLogEntry[];
  inProgress: DailyWorkLogEntry[];
  blockers: DailyWorkLogEntry[];
}

function summarise(week: DailyWorkLogEntry[]): Summary {
  return {
    hours: week.reduce((s, l) => s + (Number(l.hours) || 0), 0),
    completed: week.filter((l) => l.workStatus === "Completed"),
    inProgress: week.filter((l) => l.workStatus !== "Completed" && !isOpenBlocker(l)),
    blockers: week.filter(isOpenBlocker),
  };
}

function list(items: string[], bullet: string): string {
  return items.length ? items.map((t) => `${bullet} ${t}`).join("\n") : `${bullet} None`;
}

/** The plain-text summary. `whatsapp` adds *bold* headings, which WhatsApp renders. */
function summaryText(name: string, weekStart: string, target: number, s: Summary, whatsapp: boolean): string {
  const b = (t: string) => (whatsapp ? `*${t}*` : t);
  const next = s.inProgress.map((l) => l.module || l.project || "Untitled task");
  const blockerNext = s.blockers.map((l) => `Unblock ${l.module || l.project || "task"}`);
  return [
    b(`Weekly summary for ${name}, week of ${formatDateIST(weekStart)}`),
    "",
    `${b("Hours")}: ${formatNumber(s.hours, 2)} h of ${formatNumber(target, 1)} h`,
    "",
    b(`Completed (${s.completed.length})`),
    list(s.completed.map(label), "-"),
    "",
    b(`In progress (${s.inProgress.length})`),
    list(s.inProgress.map(label), "-"),
    "",
    b(`Blockers (${s.blockers.length})`),
    list(
      s.blockers.map((l) => `${l.module || l.project || "Task"}: ${l.blockerDetails || "no details"}`),
      "-"
    ),
    "",
    b("Next"),
    list([...new Set([...blockerNext, ...next])], "-"),
  ].join("\n");
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * The current IST week in plain words: hours, completed, in progress, blockers and what's next.
 * Copy it for the WhatsApp group, or open it as an email to the team inbox.
 */
export function WeeklySummary({
  name,
  logs,
  todayKey,
  weeklyTarget,
}: {
  name: string;
  logs: DailyWorkLogEntry[];
  /** IST day key; empty while the clock is unknown (server render). */
  todayKey: string;
  weeklyTarget: number;
}) {
  const toast = useToast();
  const weekStart = todayKey ? istWeekStart(todayKey) : "";
  const s = useMemo(() => summarise(weekStart ? entriesInWeek(logs, weekStart) : []), [logs, weekStart]);
  const plain = weekStart ? summaryText(name, weekStart, weeklyTarget, s, false) : "";

  const rows: { k: string; v: React.ReactNode; tone?: string }[] = [
    { k: "Hours", v: `${formatNumber(s.hours, 1)} of ${formatNumber(weeklyTarget, 1)} h` },
    { k: "Completed", v: s.completed.length },
    { k: "In progress", v: s.inProgress.length },
    { k: "Blockers", v: s.blockers.length, tone: s.blockers.length ? "text-negative" : undefined },
  ];

  return (
    <section className="card flex flex-col p-5 sm:p-6" aria-labelledby="weekly-summary-title">
      <CardHeader
        icon={<ClipboardList />}
        title={<span id="weekly-summary-title">Weekly summary</span>}
        subtitle={weekStart ? `Week of ${formatDateIST(weekStart, { weekday: true })}` : "This week"}
      />
      <dl className="mt-5 grid grid-cols-2 gap-2.5">
        {rows.map((r) => (
          <div key={r.k} className="card-inset px-4 py-3">
            <dt className="text-[12px] text-ink-3">{r.k}</dt>
            <dd className={`num mt-1.5 text-[22px] ${r.tone ?? ""}`}>{r.v}</dd>
          </div>
        ))}
      </dl>
      {s.inProgress.length + s.blockers.length > 0 && (
        <div className="mt-4">
          <p className="text-[12px] font-medium text-ink-2">Next</p>
          <ul className="mt-1.5 space-y-1 text-[13px] text-ink">
            {s.blockers.slice(0, 2).map((l) => (
              <li key={l.id} className="flex gap-2">
                <span aria-hidden className="dot dot-negative mt-[7px] shrink-0" />
                <span className="min-w-0 truncate">Unblock {l.module || l.project || "task"}</span>
              </li>
            ))}
            {s.inProgress.slice(0, 3).map((l) => (
              <li key={l.id} className="flex gap-2">
                <span aria-hidden className="dot dot-accent mt-[7px] shrink-0" />
                <span className="min-w-0 truncate">{label(l)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
        <button
          type="button"
          className="btn btn-lime btn-sm"
          disabled={!weekStart}
          onClick={async () => {
            const ok = await copy(summaryText(name, weekStart, weeklyTarget, s, true));
            toast(ok ? { message: "Summary copied", tone: "positive" } : { message: "Couldn't copy. Try again from a secure page.", tone: "negative" });
          }}
        >
          <MessageCircle aria-hidden className="size-4" />
          Copy for WhatsApp
        </button>
        {weekStart && (
          <ComposeActions
            size="sm"
            email={{
              to: COMPANY_EMAIL,
              subject: `Weekly summary for ${name}, week of ${formatDateIST(weekStart)}`,
              body: plain,
            }}
          />
        )}
      </div>
    </section>
  );
}
