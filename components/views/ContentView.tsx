"use client";

import React, { useMemo } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { formatDateIST, formatDateTimeIST, todayKeyIST } from "@/lib/format";
import { useHub } from "@/lib/hub/context";
import { can } from "@/lib/hub/permissions";
import { CHANNEL_LABEL, type ChannelId } from "@/lib/integrations/types";
import { useNow } from "@/lib/prefs";
import type { ContentPost, ContentStatus } from "@/lib/types";
import { CONTENT_STATUS_LABEL, CONTENT_STATUSES, ContentCalendar, monthLabel, postDay, shiftMonth } from "@/components/studio/ContentCalendar";
import { istMorningIso } from "@/components/studio/AgentOutputView";
import { ChannelMark, channelMarkFor } from "@/components/ui/ChannelMark";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { Select } from "@/components/ui/form";
import { Avatar, EmptyState, Segmented, Toolbar } from "@/components/ui/primitives";
import { StatusDot, toneForContent } from "@/components/ui/Status";
import { SummaryBand } from "@/components/ui/SummaryBand";

const CHANNELS: ChannelId[] = ["facebook_page", "instagram", "linkedin"];
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function MetaStatusLine() {
  const { features, viewer, navigate } = useHub();
  const marks = (
    <span aria-hidden className="flex shrink-0 -space-x-1.5">
      {(["facebook", "instagram"] as const).map((c) => (
        <span key={c} className="flex size-8 items-center justify-center rounded-full bg-surface text-ink ring-2 ring-surface-2">
          <ChannelMark channel={c} size={15} />
        </span>
      ))}
    </span>
  );
  let text: string;
  if (!features.meta.configured) text = "Facebook and Instagram are not connected. Posts are planned here and published by hand.";
  else if (features.meta.publishEnabled) text = "Facebook Page publishing is on. Instagram and LinkedIn posts are copied and published by hand.";
  else text = "Meta is connected, but publishing from the hub is switched off. Posts are published by hand.";
  return (
    <div className="card-inset flex flex-wrap items-center gap-3 px-4 py-3">
      {marks}
      <p className="min-w-0 flex-1 text-[13px] text-ink-2">{text}</p>
      {viewer.privileged && !features.meta.publishEnabled && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate("integrations")}>
          Open integrations
        </button>
      )}
    </div>
  );
}

export function ContentView() {
  const { data, viewer, params, setParams, openOverlay, registerSearch } = useHub();
  const now = useNow();
  const todayKey = now ? todayKeyIST(now) : "";
  const currentMonth = todayKey ? todayKey.slice(0, 7) : "";
  const monthParam = params.get("month");
  const monthKey = monthParam && MONTH_RE.test(monthParam) ? monthParam : currentMonth;
  const layout = params.get("layout") === "list" ? "list" : "month";
  const channel = (CHANNELS as string[]).includes(params.get("channel") ?? "") ? (params.get("channel") as ChannelId) : "";
  const status = (CONTENT_STATUSES as string[]).includes(params.get("status") ?? "") ? (params.get("status") as ContentStatus) : "";
  const campaign = params.get("campaign") ?? "";
  const q = params.get("q") ?? "";
  const canEdit = can(viewer, "content.edit", { data });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.posts.filter(
      (p) =>
        (!channel || p.channel === channel) &&
        (!status || p.status === status) &&
        (!campaign || p.campaignId === campaign) &&
        (!needle || `${p.title} ${p.caption} ${p.hashtags.join(" ")} ${p.ownerName}`.toLowerCase().includes(needle))
    );
  }, [data.posts, channel, status, campaign, q]);

  const inMonth = filtered.filter((p) => postDay(p)?.startsWith(monthKey));
  const unscheduled = filtered.filter((p) => !postDay(p));
  const listRows = [...unscheduled, ...inMonth].sort((a, b) => String(postDay(a) ?? "").localeCompare(String(postDay(b) ?? "")));
  const campaignName = (id?: string) => (id ? data.campaigns.find((c) => c.id === id)?.name ?? "" : "");

  const monthAll = data.posts.filter((p) => postDay(p)?.startsWith(monthKey));
  const count = (s: ContentStatus[]) => monthAll.filter((p) => s.includes(p.status)).length;

  const open = (p: ContentPost) => openOverlay({ kind: "post", postId: p.id });
  const add = canEdit ? (day: string) => openOverlay({ kind: "post", prefill: { scheduledAt: istMorningIso(day) } }) : undefined;

  if (!monthKey) return null;

  const columns: TableColumn<ContentPost>[] = [
    {
      id: "date",
      header: "Date",
      cell: (p) => (p.publishedAt ? formatDateTimeIST(p.publishedAt) : p.scheduledAt ? formatDateTimeIST(p.scheduledAt) : <span className="text-ink-3">Not scheduled</span>),
      sortValue: (p) => p.publishedAt ?? p.scheduledAt,
      width: 150,
    },
    {
      id: "channel",
      header: "Channel",
      cell: (p) => (
        <span className="inline-flex items-center gap-2">
          <ChannelMark channel={channelMarkFor(p.channel)} size={15} />
          {CHANNEL_LABEL[p.channel]}
        </span>
      ),
      sortValue: (p) => p.channel,
      hideBelow: "lg",
    },
    { id: "title", header: "Post", cell: (p) => <span className="font-medium text-ink">{p.title || "Untitled"}</span>, sortValue: (p) => p.title, truncate: true },
    { id: "status", header: "Status", cell: (p) => <StatusDot tone={toneForContent(p.status)} label={CONTENT_STATUS_LABEL[p.status]} />, sortValue: (p) => CONTENT_STATUSES.indexOf(p.status), width: 130 },
    { id: "campaign", header: "Campaign", cell: (p) => campaignName(p.campaignId), truncate: true, hideBelow: "lg" },
    {
      id: "owner",
      header: "Owner",
      cell: (p) => (
        <span className="inline-flex items-center gap-2">
          <Avatar name={p.ownerName} size={24} />
          {p.ownerName}
        </span>
      ),
      sortValue: (p) => p.ownerName,
      hideBelow: "md",
    },
  ];

  const list = (
    <DataTable
      caption={`Posts for ${monthLabel(monthKey)}`}
      rows={listRows}
      columns={columns}
      rowKey={(p) => p.id}
      onRowClick={open}
      rowLabel={(p) => p.title || "post"}
      flashKey={data.lastSaved?.entity === "posts" ? `${data.lastSaved.id}:${data.lastSaved.at}` : undefined}
      rowStatus={(p) => (data.unsynced.some((u) => u.entity === "posts" && u.id === p.id) ? "unsynced" : undefined)}
      mobileCard={(p) => (
        <>
          <div className="flex items-start justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2 text-[14px] font-medium text-ink">
              <ChannelMark channel={channelMarkFor(p.channel)} size={15} className="text-ink-2" />
              <span className="truncate">{p.title || "Untitled"}</span>
            </span>
            <StatusDot tone={toneForContent(p.status)} label={CONTENT_STATUS_LABEL[p.status]} />
          </div>
          <p className="mt-1 text-[12.5px] text-ink-3">
            {postDay(p) ? formatDateIST(postDay(p), { weekday: true }) : "Not scheduled"}, {p.ownerName}
          </p>
        </>
      )}
      empty={
        <EmptyState
          icon={<CalendarDays />}
          title={filtered.length === data.posts.length ? `Nothing planned for ${monthLabel(monthKey)}` : "No posts match these filters"}
          body={canEdit ? "Add a post, or ask the assistant to plan a few weeks of posts." : undefined}
          action={
            canEdit ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => openOverlay({ kind: "post" })}>
                <Plus aria-hidden /> Add post
              </button>
            ) : undefined
          }
        />
      }
    />
  );

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-5">
      <SummaryBand
        hero
        ariaLabel={`Content for ${monthLabel(monthKey)}`}
        items={[
          { label: `Planned in ${monthLabel(monthKey).split(" ")[0]}`, value: monthAll.length, compare: { text: unscheduled.length ? `${unscheduled.length} not scheduled yet` : "Everything has a date" } },
          { label: "Scheduled", value: count(["scheduled"]) },
          { label: "Published", value: count(["published"]), compare: { text: monthAll.length ? `${Math.round((count(["published"]) / monthAll.length) * 100)}% of the month` : "–" } },
          { label: "Ideas and drafts", value: count(["idea", "draft", "in_review"]), compare: count(["in_review"]) ? { text: `${count(["in_review"])} waiting for review`, tone: "warning" } : undefined },
        ]}
      />

      <MetaStatusLine />

      <Toolbar className="justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Layout"
            className="hidden md:inline-grid"
            value={layout}
            onChange={(v) => setParams({ layout: v === "list" ? "list" : null })}
            options={[
              { value: "month", label: "Month" },
              { value: "list", label: "List" },
            ]}
          />
          <div className="inline-flex h-10 items-center rounded-full bg-surface px-1 shadow-[inset_0_0_0_1px_var(--color-line)]">
            <button type="button" aria-label="Previous month" onClick={() => setParams({ month: shiftMonth(monthKey, -1) })} className="flex size-8 items-center justify-center rounded-full hover:bg-surface-2">
              <ChevronLeft aria-hidden className="size-4" />
            </button>
            <button
              type="button"
              aria-label={`${monthLabel(monthKey)}. Go to this month`}
              onClick={() => setParams({ month: null })}
              className="h-8 min-w-[132px] rounded-full px-2 text-[13px] font-medium tabular-nums hover:bg-surface-2"
            >
              {monthLabel(monthKey)}
            </button>
            <button type="button" aria-label="Next month" onClick={() => setParams({ month: shiftMonth(monthKey, 1) })} className="flex size-8 items-center justify-center rounded-full hover:bg-surface-2">
              <ChevronRight aria-hidden className="size-4" />
            </button>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
          <label className="relative block min-w-0 flex-1 basis-[180px] lg:w-[200px] lg:flex-none">
            <span className="sr-only">Search posts</span>
            <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input ref={registerSearch} type="search" value={q} onChange={(e) => setParams({ q: e.target.value || null })} placeholder="Search posts" className="field pl-10" />
          </label>
          <Select aria-label="Channel" fieldSize="sm" value={channel} onChange={(e) => setParams({ channel: e.target.value || null })} className="min-w-[140px] flex-1 lg:flex-none">
            <option value="">All channels</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABEL[c]}
              </option>
            ))}
          </Select>
          <Select aria-label="Status" fieldSize="sm" value={status} onChange={(e) => setParams({ status: e.target.value || null })} className="min-w-[130px] flex-1 lg:flex-none">
            <option value="">All statuses</option>
            {CONTENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CONTENT_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          {data.campaigns.length > 0 && (
            <Select aria-label="Campaign" fieldSize="sm" value={campaign} onChange={(e) => setParams({ campaign: e.target.value || null })} className="min-w-[150px] flex-1 lg:flex-none">
              <option value="">All campaigns</option>
              {data.campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      </Toolbar>

      {layout === "month" ? (
        <>
          <div className="hidden space-y-3 md:block">
            <ContentCalendar monthKey={monthKey} posts={filtered} todayKey={todayKey} onOpen={open} onAdd={add} />
            {unscheduled.length > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setParams({ layout: "list" })}>
                {unscheduled.length} {unscheduled.length === 1 ? "post has" : "posts have"} no date yet. See the list
              </button>
            )}
          </div>
          <div className="md:hidden">{list}</div>
        </>
      ) : (
        list
      )}
    </div>
  );
}
