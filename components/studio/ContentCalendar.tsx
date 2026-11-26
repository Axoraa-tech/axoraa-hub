"use client";

import React from "react";
import { Plus } from "lucide-react";
import { addDaysKey, dayKeyOf, formatDateIST } from "@/lib/format";
import { CHANNEL_LABEL } from "@/lib/integrations/types";
import type { ContentPost, ContentStatus } from "@/lib/types";
import { ChannelMark, channelMarkFor } from "@/components/ui/ChannelMark";
import { Popover } from "@/components/ui/Menu";
import { toneForContent } from "@/components/ui/Status";

export const CONTENT_STATUS_LABEL: Record<ContentStatus, string> = {
  idea: "Idea",
  draft: "Draft",
  in_review: "In review",
  scheduled: "Scheduled",
  published: "Published",
};

export const CONTENT_STATUSES: ContentStatus[] = ["idea", "draft", "in_review", "scheduled", "published"];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** 'November 2026' for '2026-11'. */
export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return `${MONTHS[(m || 1) - 1]} ${y}`;
}

/** The month key n months after monthKey. */
export function shiftMonth(monthKey: string, n: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_IN_CELL = 3;

/** IST day a post sits on: published date, else scheduled date. */
export function postDay(p: ContentPost): string | null {
  return dayKeyOf(p.publishedAt ?? "") ?? dayKeyOf(p.scheduledAt ?? "");
}

/** Every day shown for a month ('YYYY-MM'), Monday first, padded to whole weeks. */
export function monthGrid(monthKey: string): string[] {
  const first = `${monthKey}-01`;
  const [y, m] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const weeks = Math.ceil((offset + daysInMonth) / 7);
  const start = addDaysKey(first, -offset);
  return Array.from({ length: weeks * 7 }, (_, i) => addDaysKey(start, i));
}

function PostChip({ post, onOpen }: { post: ContentPost; onOpen: (p: ContentPost) => void }) {
  const tone = toneForContent(post.status);
  return (
    <button
      type="button"
      onClick={() => onOpen(post)}
      title={`${CHANNEL_LABEL[post.channel]}: ${post.title || "Untitled"} (${CONTENT_STATUS_LABEL[post.status]})`}
      className="flex w-full min-w-0 items-center gap-1.5 rounded-[10px] bg-surface px-2 py-1 text-left text-[12px] text-ink shadow-[var(--shadow-card)] transition-colors hover:bg-lime-soft"
    >
      <ChannelMark channel={channelMarkFor(post.channel)} size={12} className="text-ink-2" />
      <span className="min-w-0 flex-1 truncate">{post.title || "Untitled"}</span>
      <span aria-hidden className={`dot dot-${tone}`} />
      <span className="sr-only">
        {CHANNEL_LABEL[post.channel]}, {CONTENT_STATUS_LABEL[post.status]}
      </span>
    </button>
  );
}

export function ContentCalendar({
  monthKey,
  posts,
  todayKey,
  onOpen,
  onAdd,
}: {
  monthKey: string;
  posts: ContentPost[];
  todayKey: string;
  onOpen: (p: ContentPost) => void;
  /** Absent when the viewer may not add posts. */
  onAdd?: (day: string) => void;
}) {
  const days = monthGrid(monthKey);
  const byDay = new Map<string, ContentPost[]>();
  for (const p of posts) {
    const d = postDay(p);
    if (!d) continue;
    const list = byDay.get(d) ?? [];
    list.push(p);
    byDay.set(d, list);
  }
  for (const list of byDay.values()) list.sort((a, b) => String(a.scheduledAt ?? a.publishedAt ?? "").localeCompare(String(b.scheduledAt ?? b.publishedAt ?? "")));

  return (
    <section className="card min-w-0 p-3 sm:p-4" aria-label={`Content calendar, ${monthLabel(monthKey)}`}>
      <div className="grid grid-cols-7 gap-1.5 px-0.5 pb-2" aria-hidden>
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 text-[12px] font-medium text-ink-3">
            {d}
          </div>
        ))}
      </div>
      <ol className="grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const inMonth = day.startsWith(monthKey);
          const isToday = day === todayKey;
          const list = byDay.get(day) ?? [];
          const shown = list.slice(0, MAX_IN_CELL);
          const more = list.length - shown.length;
          const label = formatDateIST(day);
          return (
            <li
              key={day}
              aria-label={`${formatDateIST(day, { weekday: true })}${list.length ? `, ${list.length} ${list.length === 1 ? "post" : "posts"}` : ""}${isToday ? ", today" : ""}`}
              className={`group relative flex min-h-[124px] min-w-0 flex-col gap-1 rounded-[18px] p-1.5 ${inMonth ? "bg-surface-2" : "bg-transparent shadow-[inset_0_0_0_1px_var(--color-line)]"} ${
                isToday ? "ring-2 ring-accent" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-1 px-1 pt-0.5">
                <span
                  className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12.5px] font-medium tabular-nums ${
                    isToday ? "bg-accent text-on-accent" : inMonth ? "text-ink" : "text-ink-3"
                  }`}
                >
                  {Number(day.slice(8, 10))}
                </span>
                {onAdd && (
                  <button
                    type="button"
                    aria-label={`Add post on ${label}`}
                    onClick={() => onAdd(day)}
                    className="flex size-6 items-center justify-center rounded-full text-ink-3 opacity-60 transition hover:bg-surface hover:text-ink hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Plus aria-hidden className="size-3.5" />
                  </button>
                )}
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                {shown.map((p) => (
                  <PostChip key={p.id} post={p} onOpen={onOpen} />
                ))}
                {more > 0 && (
                  <Popover
                    label={`All posts on ${label}`}
                    trigger={<span>+{more} more</span>}
                    triggerClassName="rounded-full px-2 py-0.5 text-left text-[12px] font-medium text-ink-2 hover:bg-surface hover:text-ink"
                    panelClassName="w-[280px] p-2"
                  >
                    {(close) => (
                      <div>
                        <p className="px-2 pb-1.5 pt-1 text-[12px] font-medium text-ink-3">{formatDateIST(day, { weekday: true })}</p>
                        <div className="space-y-1">
                          {list.map((p) => (
                            <PostChip
                              key={p.id}
                              post={p}
                              onOpen={(x) => {
                                close();
                                onOpen(x);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </Popover>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
