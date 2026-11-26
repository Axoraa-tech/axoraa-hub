"use client";

import React, { useMemo } from "react";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import type { AlertTone, HubAlert } from "@/lib/alerts";
import { formatDateIST } from "@/lib/format";
import { PREF, useLocalPref } from "@/lib/prefs";
import { Popover } from "@/components/ui/Menu";

const DOT: Record<AlertTone, string> = {
  negative: "bg-coral",
  warning: "bg-amber",
  accent: "bg-lime ring-1 ring-inset ring-ink/15",
  positive: "bg-good",
  neutral: "bg-ink-3",
};

function parseSeen(raw: string): Set<string> {
  try {
    const v: unknown = JSON.parse(raw);
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

/** Read/unread state of the derived alerts, kept per account in localStorage. */
export function useAlertsSeen(accountId: string, alerts: readonly HubAlert[]) {
  const [raw, setRaw] = useLocalPref<string>(PREF.alertsSeen(accountId), "[]");
  const seen = useMemo(() => parseSeen(raw), [raw]);
  const unread = useMemo(() => alerts.filter((a) => !seen.has(a.id)), [alerts, seen]);
  // Only ids that still exist are kept, so the stored list never grows without bound.
  const markRead = (ids: readonly string[]) => {
    const live = new Set(alerts.map((a) => a.id));
    const next = new Set([...seen].filter((id) => live.has(id)));
    ids.forEach((id) => next.add(id));
    setRaw(JSON.stringify([...next]));
  };
  return { seen, unread, markRead };
}

export function NotificationsMenu({
  alerts,
  accountId,
  onSelect,
}: {
  alerts: readonly HubAlert[];
  accountId: string;
  onSelect: (alert: HubAlert) => void;
}) {
  const { seen, unread, markRead } = useAlertsSeen(accountId, alerts);
  const count = unread.length;
  const label = `Notifications, ${count} unread`;

  return (
    <Popover
      label="Notifications"
      align="end"
      triggerClassName="icon-btn relative"
      panelClassName="w-[360px] p-2"
      trigger={
        <>
          <Bell aria-hidden />
          {count > 0 && (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-coral px-1 text-[11px] font-medium tabular-nums leading-none text-white ring-2 ring-canvas"
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
          <span className="sr-only">{label}</span>
        </>
      }
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
            <div>
              <div className="text-[15px] font-medium tracking-[-0.02em] text-ink">Notifications</div>
              <div className="text-[12px] text-ink-3">{count ? `${count} unread` : "You're all caught up"}</div>
            </div>
            {count > 0 && (
              <button type="button" className="btn btn-plain btn-sm" onClick={() => markRead(alerts.map((a) => a.id))}>
                <CheckCheck aria-hidden />
                Mark all as read
              </button>
            )}
          </div>

          {alerts.length === 0 ? (
            <div className="flex flex-col items-center px-4 pb-6 pt-4 text-center">
              <span aria-hidden className="hatch mb-3 flex h-12 w-12 items-center justify-center rounded-full text-ink-2">
                <BellOff className="h-4 w-4" />
              </span>
              <p className="text-[13.5px] text-ink">Nothing needs your attention.</p>
            </div>
          ) : (
            <ul className="max-h-[min(420px,60dvh)] space-y-0.5 overflow-y-auto">
              {alerts.map((a) => {
                const isUnread = !seen.has(a.id);
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => {
                        markRead([a.id]);
                        close();
                        onSelect(a);
                      }}
                      className={`flex w-full items-start gap-3 rounded-[14px] px-2.5 py-2.5 text-left transition-colors hover:bg-surface-2 ${
                        isUnread ? "" : "opacity-70"
                      }`}
                    >
                      <span aria-hidden className={`mt-[6px] h-2 w-2 shrink-0 rounded-full ${DOT[a.tone]}`} />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[13.5px] leading-[18px] text-ink ${isUnread ? "font-medium" : ""}`}>{a.title}</span>
                        {a.detail && <span className="mt-0.5 block text-[12px] leading-[16px] text-ink-3">{a.detail}</span>}
                      </span>
                      {a.date && <span className="shrink-0 pt-0.5 text-[12px] tabular-nums text-ink-3">{formatDateIST(a.date)}</span>}
                      {isUnread && <span className="sr-only">Unread</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Popover>
  );
}
