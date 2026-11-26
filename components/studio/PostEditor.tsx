"use client";

import React, { useState } from "react";
import { Copy, ExternalLink, Send, CalendarClock, Trash2, Save } from "lucide-react";
import { nowISO, parseInstant } from "@/lib/format";
import { useHub } from "@/lib/hub/context";
import { can } from "@/lib/hub/permissions";
import { CHANNEL_LABEL, CHANNEL_LIMITS, type ChannelId, type PublishResult } from "@/lib/integrations/types";
import { MARKETING_NAMES } from "@/lib/people";
import { useNow } from "@/lib/prefs";
import type { ContentPost, ContentStatus } from "@/lib/types";
import type { Overlay } from "@/lib/views";
import { ChannelMark, channelMarkFor } from "@/components/ui/ChannelMark";
import { Sheet } from "@/components/ui/Dialog";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { ErrorSummary, Field, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState, Segmented } from "@/components/ui/primitives";
import { copyToClipboard } from "./AgentOutputView";
import { CONTENT_STATUS_LABEL, CONTENT_STATUSES } from "./ContentCalendar";

type PostOverlay = Extract<Overlay, { kind: "post" }>;
type FieldError = { field: string; message: string };

const CHANNELS: ChannelId[] = ["facebook_page", "instagram", "linkedin"];
const IST_MS = 330 * 60 * 1000;
const MIN_AHEAD_MS = 10 * 60 * 1000;
const MAX_AHEAD_MS = 30 * 24 * 60 * 60 * 1000;

/** ISO instant → 'YYYY-MM-DDTHH:mm' on the IST wall clock, for a datetime-local input. */
function toLocalIST(iso?: string): string {
  const ms = parseInstant(iso ?? "");
  return ms === null ? "" : new Date(ms + IST_MS).toISOString().slice(0, 16);
}
/** 'YYYY-MM-DDTHH:mm' read as IST → ISO instant. */
function fromLocalIST(v: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return undefined;
  const ms = Date.parse(`${v}:00+05:30`);
  return Number.isNaN(ms) ? undefined : new Date(ms).toISOString();
}

function parseTags(s: string): string[] {
  const out: string[] = [];
  for (const raw of s.split(/[,\n]/)) {
    const t = raw.trim().replace(/^#+/, "").replace(/\s+/g, "");
    if (t && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out;
}

function fullText(caption: string, tags: string[]): string {
  const t = tags.map((h) => `#${h}`).join(" ");
  return t ? `${caption.trim()}\n\n${t}` : caption.trim();
}

const PUBLISH_ERRORS: Record<string, string> = {
  not_configured: "Meta isn't connected yet. Ask the administrator to finish the setup in Integrations.",
  publish_disabled: "Publishing from the hub is switched off.",
  unsupported: "Facebook can't take this post as it is.",
  forbidden: "You don't have permission to publish.",
  unauthorized: "Your session has ended. Sign in again.",
};

interface Draft {
  channel: ChannelId;
  title: string;
  caption: string;
  hashtags: string;
  assetUrl: string;
  imageBrief: string;
  scheduledAt: string;
  status: ContentStatus;
  campaignId: string;
  ownerName: string;
}

function draftOf(p: Partial<ContentPost>, owner: string): Draft {
  return {
    channel: p.channel ?? "facebook_page",
    title: p.title ?? "",
    caption: p.caption ?? "",
    hashtags: (p.hashtags ?? []).join(", "),
    assetUrl: p.assetUrl ?? "",
    imageBrief: p.imageBrief ?? "",
    scheduledAt: toLocalIST(p.scheduledAt),
    status: p.status ?? "idea",
    campaignId: p.campaignId ?? "",
    ownerName: p.ownerName ?? owner,
  };
}

export function PostEditor({ overlay, onClose }: { overlay: PostOverlay; onClose: () => void }) {
  const { data, viewer, features } = useHub();
  const toast = useToast();
  const confirm = useConfirm();
  const now = useNow();
  const [savedId, setSavedId] = useState<string | null>(overlay.postId ?? null);
  const post = savedId ? data.posts.find((p) => p.id === savedId) ?? null : null;
  const [draft, setDraft] = useState<Draft>(() => draftOf(post ?? overlay.prefill ?? {}, viewer.name));
  const [baseline, setBaseline] = useState(() => JSON.stringify(draft));
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState<null | "save" | "publish" | "schedule">(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const canEdit = can(viewer, "content.edit", { data, record: post ?? undefined });
  const canPublish = can(viewer, "meta.publish", { data, features });
  const dirty = JSON.stringify(draft) !== baseline;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const errorFor = (f: string) => errors.find((e) => e.field === `post-${f}`)?.message;

  if (overlay.postId && !post) {
    return (
      <Sheet open onClose={onClose} title="Post" width="md">
        <EmptyState title="This post isn't available" body="It was deleted, or it is not in your workspace." />
      </Sheet>
    );
  }

  const limit = CHANNEL_LIMITS[draft.channel].captionMax;
  const tags = parseTags(draft.hashtags);
  const textLength = fullText(draft.caption, tags).length;
  const over = textLength > limit;
  const scheduledIso = fromLocalIST(draft.scheduledAt);
  const scheduledMs = scheduledIso ? Date.parse(scheduledIso) : null;
  const canSchedule = !!now && scheduledMs !== null && scheduledMs - now >= MIN_AHEAD_MS && scheduledMs - now <= MAX_AHEAD_MS;

  const validate = (): FieldError[] => {
    const errs: FieldError[] = [];
    if (!draft.title.trim()) errs.push({ field: "post-title", message: "Give the post a short title." });
    if (over) errs.push({ field: "post-caption", message: `${CHANNEL_LABEL[draft.channel]} allows ${limit.toLocaleString("en-IN")} characters including hashtags. Shorten the caption.` });
    if (draft.assetUrl.trim()) {
      let ok = false;
      try {
        ok = new URL(draft.assetUrl.trim()).protocol === "https:";
      } catch {
        ok = false;
      }
      if (!ok) errs.push({ field: "post-assetUrl", message: "The image link must start with https://" });
    }
    if (draft.scheduledAt && !scheduledIso) errs.push({ field: "post-scheduledAt", message: "Enter a full date and time." });
    if ((draft.status === "scheduled" || draft.status === "published") && !draft.scheduledAt && !post?.publishedAt) {
      errs.push({ field: "post-scheduledAt", message: "Scheduled and published posts need a date and time." });
    }
    return errs;
  };

  const patchOf = (): Partial<ContentPost> => ({
    channel: draft.channel,
    title: draft.title.trim(),
    caption: draft.caption,
    hashtags: tags,
    assetUrl: draft.assetUrl.trim() || undefined,
    imageBrief: draft.imageBrief.trim() || undefined,
    scheduledAt: scheduledIso,
    status: draft.status,
    campaignId: draft.campaignId || undefined,
    ownerName: draft.ownerName,
  });

  /** Saves and returns the post id, or null when validation failed. */
  const save = async (quiet = false): Promise<string | null> => {
    const errs = validate();
    setErrors(errs);
    if (errs.length) return null;
    setBusy("save");
    const res = await data.savePost(patchOf(), savedId ?? undefined);
    setBusy(null);
    setSavedId(res.record.id);
    setBaseline(JSON.stringify(draft));
    if (!quiet) toast({ message: res.ok ? (savedId ? "Post saved" : "Post added to the calendar") : "Saved on this device. Not saved to Google Sheets yet.", tone: res.ok ? "positive" : "negative" });
    return res.record.id;
  };

  const remove = async () => {
    if (!post) return;
    const ok = await confirm({ title: "Delete this post?", body: `“${post.title || "Untitled"}” will be removed from the calendar.`, confirmLabel: "Delete post", tone: "danger" });
    if (!ok) return;
    const res = await data.deletePost(post.id);
    if (res.ok) {
      toast({ message: "Post deleted" });
      onClose();
    } else toast({ message: res.error || "Couldn't delete the post.", tone: "negative" });
  };

  const copyCaption = async () => {
    const ok = await copyToClipboard(fullText(draft.caption, tags));
    toast(ok ? { message: "Caption copied" } : { message: "Couldn't copy. Select the text and copy it yourself.", tone: "negative" });
  };

  const publish = async (mode: "publish" | "schedule") => {
    setPublishError(null);
    const id = dirty || !savedId ? await save(true) : savedId;
    if (!id) return;
    setBusy(mode);
    try {
      const res = await fetch("/api/integrations/meta/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: id,
          channel: "facebook_page",
          text: fullText(draft.caption, tags),
          mediaUrls: draft.assetUrl.trim() ? [draft.assetUrl.trim()] : undefined,
          scheduledAt: mode === "schedule" ? scheduledIso : undefined,
        }),
      });
      let body: Record<string, unknown> = {};
      try {
        body = (await res.json()) as Record<string, unknown>;
      } catch {
        body = {};
      }
      if (!res.ok) {
        const code = typeof body.error === "string" ? body.error : res.status === 403 ? "forbidden" : res.status === 401 ? "unauthorized" : "";
        const base = PUBLISH_ERRORS[code] ?? (res.status >= 500 ? "Facebook didn't accept the post." : "The post couldn't be published.");
        const detail = typeof body.message === "string" && body.message ? ` ${body.message}` : "";
        setPublishError(`${base}${detail}`);
        return;
      }
      const result = body as unknown as PublishResult;
      const patch: Partial<ContentPost> = {
        status: result.state === "published" ? "published" : "scheduled",
        externalId: result.externalId,
        permalink: result.permalink,
        publishedAt: result.state === "published" ? nowISO() : undefined,
      };
      await data.savePost(patch, id);
      setDraft((d) => ({ ...d, status: patch.status! }));
      setBaseline(JSON.stringify({ ...draft, status: patch.status }));
      toast({ message: result.state === "published" ? "Published to the Facebook Page" : "Scheduled on the Facebook Page", tone: "positive" });
    } catch {
      setPublishError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  const owners = Array.from(new Set([...MARKETING_NAMES, viewer.name, draft.ownerName].filter(Boolean)));
  const isFacebook = draft.channel === "facebook_page";

  return (
    <Sheet
      open
      onClose={onClose}
      width="lg"
      title={post ? post.title || "Untitled post" : "Add post"}
      description={post ? `${CHANNEL_LABEL[post.channel]}, ${CONTENT_STATUS_LABEL[post.status]}` : "Plan a post for Facebook, Instagram or LinkedIn"}
      footer={
        <>
          {post && canEdit && (
            <button type="button" className="btn btn-plain mr-auto text-negative" onClick={remove} disabled={!!busy}>
              <Trash2 aria-hidden /> Delete
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={copyCaption} disabled={!draft.caption.trim()}>
            <Copy aria-hidden /> Copy caption
          </button>
          {canEdit && (
            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={!!busy || (!dirty && !!savedId)}>
              <Save aria-hidden /> {busy === "save" ? "Saving…" : "Save"}
            </button>
          )}
        </>
      }
    >
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (canEdit) void save();
        }}
      >
        <ErrorSummary errors={errors} />
        <fieldset disabled={!canEdit} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <span className="mb-1.5 block text-[12px] font-medium text-ink-2">Channel</span>
            <Segmented<ChannelId>
              label="Channel"
              value={draft.channel}
              onChange={(v) => set("channel", v)}
              options={CHANNELS.map((c) => ({
                value: c,
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <ChannelMark channel={channelMarkFor(c)} size={14} />
                    <span className="hidden sm:inline">{CHANNEL_LABEL[c]}</span>
                    <span className="sm:hidden">{c === "facebook_page" ? "Facebook" : CHANNEL_LABEL[c]}</span>
                  </span>
                ),
              }))}
            />
          </div>
          <Field label="Title" htmlFor="post-title" error={errorFor("title")} required className="md:col-span-2" hint={errorFor("title") ? undefined : "For the calendar only; it isn't posted"}>
            <Input id="post-title" value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="Billing software for kirana stores" />
          </Field>
          <Field
            label="Caption"
            htmlFor="post-caption"
            error={errorFor("caption")}
            className="md:col-span-2"
            hint={
              <span className={over ? "font-medium text-negative" : undefined}>
                {textLength.toLocaleString("en-IN")} of {limit.toLocaleString("en-IN")} characters with hashtags
                {over ? `, ${(textLength - limit).toLocaleString("en-IN")} over` : ""}
              </span>
            }
          >
            <Textarea id="post-caption" rows={8} value={draft.caption} onChange={(e) => set("caption", e.target.value)} invalid={over} />
          </Field>
          <Field label="Hashtags" htmlFor="post-hashtags" hint="Separate with commas; the # is added for you" className="md:col-span-2">
            <Input id="post-hashtags" value={draft.hashtags} onChange={(e) => set("hashtags", e.target.value)} placeholder="BengaluruBusiness, GSTBilling" />
          </Field>
          <Field
            label="Image link"
            htmlFor="post-assetUrl"
            error={errorFor("assetUrl")}
            hint={errorFor("assetUrl") ? undefined : draft.channel === "instagram" ? "Instagram needs a public JPEG link" : "A public https link to the image"}
          >
            <Input id="post-assetUrl" inputMode="url" value={draft.assetUrl} onChange={(e) => set("assetUrl", e.target.value)} placeholder="https://" />
          </Field>
          <Field label="Date and time (IST)" htmlFor="post-scheduledAt" error={errorFor("scheduledAt")}>
            <Input id="post-scheduledAt" type="datetime-local" value={draft.scheduledAt} onChange={(e) => set("scheduledAt", e.target.value)} className="tabular-nums" />
          </Field>
          <Field label="Image brief" htmlFor="post-imageBrief" className="md:col-span-2">
            <Textarea id="post-imageBrief" rows={2} value={draft.imageBrief} onChange={(e) => set("imageBrief", e.target.value)} placeholder="What the designer should show" />
          </Field>
          <Field label="Status" htmlFor="post-status">
            <Select id="post-status" value={draft.status} onChange={(e) => set("status", e.target.value as ContentStatus)}>
              {CONTENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CONTENT_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Owner" htmlFor="post-owner">
            <Select id="post-owner" value={draft.ownerName} onChange={(e) => set("ownerName", e.target.value)}>
              {owners.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Campaign" htmlFor="post-campaign" className="md:col-span-2">
            <Select id="post-campaign" value={draft.campaignId} onChange={(e) => set("campaignId", e.target.value)}>
              <option value="">None</option>
              {data.campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </fieldset>
      </form>

      <section className="card-inset mt-5 p-4 sm:p-5" aria-labelledby="post-publish-title">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-surface text-ink">
            <ChannelMark channel={channelMarkFor(draft.channel)} size={16} />
          </span>
          <h3 id="post-publish-title" className="text-[14px] font-medium text-ink">
            {isFacebook ? "Publish to the Facebook Page" : `Post on ${CHANNEL_LABEL[draft.channel]}`}
          </h3>
        </div>

        {post?.permalink && /^https:\/\//.test(post.permalink) && (
          <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm mt-3">
            <ExternalLink aria-hidden /> View on Facebook
          </a>
        )}

        {isFacebook ? (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary btn-sm" disabled={!canPublish || !!busy || !draft.caption.trim()} onClick={() => void publish("publish")}>
                <Send aria-hidden /> {busy === "publish" ? "Publishing…" : "Publish to Facebook"}
              </button>
              {canSchedule && (
                <button type="button" className="btn btn-ghost btn-sm" disabled={!canPublish || !!busy || !draft.caption.trim()} onClick={() => void publish("schedule")}>
                  <CalendarClock aria-hidden /> {busy === "schedule" ? "Scheduling…" : "Schedule on Facebook"}
                </button>
              )}
            </div>
            <p className="mt-2.5 text-[12.5px] text-ink-3">
              {!canPublish
                ? "Connect Meta in Integrations to publish from the hub."
                : canSchedule
                ? "Scheduling uses the date and time above. Nothing is posted until you press a button."
                : "To schedule, set a time between 10 minutes and 30 days from now. Nothing is posted until you press a button."}
            </p>
            {publishError && (
              <p role="alert" className="mt-3 rounded-[14px] bg-coral-soft px-3 py-2 text-[13px] text-ink">
                {publishError}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="mt-2.5 text-[13px] text-ink-2">
              {draft.channel === "instagram"
                ? "Copy the caption and post from the Instagram app, then mark the post as published."
                : "Copy the caption and post it on LinkedIn, then mark the post as published."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary btn-sm" onClick={copyCaption} disabled={!draft.caption.trim()}>
                <Copy aria-hidden /> Copy caption
              </button>
              {draft.channel === "linkedin" && (
                <a href="https://www.linkedin.com/feed/" target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                  <ExternalLink aria-hidden /> Open LinkedIn
                </a>
              )}
            </div>
          </>
        )}
      </section>
    </Sheet>
  );
}
