import "server-only";

// Social channels. Facebook Page publishing and scheduling are real; Instagram is a typed stub that only
// reports its status; LinkedIn is a not-configured null object. Media URLs are passed to Meta as-is and
// never fetched by this server.
import type {
  ChannelCapabilities,
  ChannelId,
  InsightPoint,
  IntegrationStatus,
  PostDraft,
  PublishResult,
  SocialChannel,
} from "@/lib/integrations/types";
import { IntegrationNotConfiguredError, MetaGraphError, UnsupportedOperationError } from "../errors";
import type { MetaConfig } from "./config";
import { getPageToken, graphFetch } from "./graph";

const MIN_SCHEDULE_MS = 10 * 60 * 1000;
const MAX_SCHEDULE_MS = 30 * 24 * 60 * 60 * 1000;

export const INSTAGRAM_NOT_BUILT =
  "Instagram publishing from the hub is not built yet. Copy the caption and post from the Instagram app.";
export const LINKEDIN_NOT_BUILT = "LinkedIn publishing from the hub is not built yet. Copy the post and share it from LinkedIn.";

function errorStatus(err: unknown): IntegrationStatus {
  if (err instanceof MetaGraphError) return { state: "error", code: err.code, message: err.message, at: new Date().toISOString() };
  if (err instanceof IntegrationNotConfiguredError) return { state: "not_configured", missing: err.missing };
  return { state: "error", message: "Could not check the connection.", at: new Date().toISOString() };
}

/** Unix seconds for a scheduled time, or a plain-language error when it is outside Meta's window. */
export function scheduleTime(scheduledAt: string, now = Date.now()): number {
  const ms = Date.parse(scheduledAt);
  if (Number.isNaN(ms)) throw new UnsupportedOperationError("The scheduled time is not a valid date.");
  if (ms - now < MIN_SCHEDULE_MS) throw new UnsupportedOperationError("Schedule the post at least 10 minutes from now.");
  if (ms - now > MAX_SCHEDULE_MS) throw new UnsupportedOperationError("Facebook can schedule posts up to 30 days ahead. Pick an earlier date.");
  return Math.floor(ms / 1000);
}

export class FacebookPageChannel implements SocialChannel {
  readonly id: ChannelId = "facebook_page";
  constructor(private readonly config: MetaConfig) {}

  async status(): Promise<IntegrationStatus> {
    try {
      const token = await getPageToken();
      const { data } = await graphFetch<{ id?: string; name?: string }>(this.config.pageId, { params: { fields: "name" }, token });
      return {
        state: "connected",
        account: { id: data.id ?? this.config.pageId, name: data.name ?? "" },
        ...(this.config.tokenExpiresAt ? { tokenExpiresAt: this.config.tokenExpiresAt } : {}),
      };
    } catch (err) {
      return errorStatus(err);
    }
  }

  capabilities(): ChannelCapabilities {
    return { nativeSchedule: true, imageFormats: ["image/jpeg", "image/png"] };
  }

  private async post(d: PostDraft, extra: Record<string, string | number | boolean>): Promise<{ id: string; postId?: string }> {
    const token = await getPageToken();
    const image = d.mediaUrls?.[0];
    if (image) {
      const { data } = await graphFetch<{ id?: string; post_id?: string }>(`${this.config.pageId}/photos`, {
        method: "POST",
        token,
        body: { url: image, message: d.text, ...extra },
      });
      if (!data.id) throw new MetaGraphError(-1, null, "parse", "Meta did not return a post id.", 502);
      return { id: data.id, postId: data.post_id };
    }
    const { data } = await graphFetch<{ id?: string }>(`${this.config.pageId}/feed`, {
      method: "POST",
      token,
      body: { message: d.text, link: d.link, ...extra },
    });
    if (!data.id) throw new MetaGraphError(-1, null, "parse", "Meta did not return a post id.", 502);
    return { id: data.id };
  }

  async publish(d: PostDraft): Promise<PublishResult> {
    const { id, postId } = await this.post(d, {});
    const externalId = postId ?? id;
    return { channel: this.id, externalId, permalink: `https://www.facebook.com/${externalId}`, state: "published" };
  }

  async schedule(d: PostDraft & { scheduledAt: string }): Promise<PublishResult> {
    const when = scheduleTime(d.scheduledAt);
    const { id, postId } = await this.post(d, { published: false, scheduled_publish_time: when });
    return { channel: this.id, externalId: postId ?? id, state: "scheduled" };
  }

  async insights(): Promise<InsightPoint[]> {
    throw new UnsupportedOperationError("Insights are not built yet");
  }
}

/** Instagram: status only. Publishing, scheduling and insights are not built. */
export class InstagramChannel implements SocialChannel {
  readonly id: ChannelId = "instagram";
  constructor(private readonly config: MetaConfig) {}

  /** The Instagram professional account id: META_IG_USER_ID, else the one linked to the Page. */
  async accountId(): Promise<string | null> {
    if (this.config.igUserId) return this.config.igUserId;
    const token = await getPageToken();
    const { data } = await graphFetch<{ instagram_business_account?: { id?: string } }>(this.config.pageId, {
      params: { fields: "instagram_business_account" },
      token,
    });
    return data.instagram_business_account?.id ?? null;
  }

  async status(): Promise<IntegrationStatus> {
    try {
      const id = await this.accountId();
      if (!id) return { state: "not_configured", missing: ["META_IG_USER_ID"] };
      let name = "";
      try {
        const token = await getPageToken();
        const { data } = await graphFetch<{ username?: string }>(id, { params: { fields: "username" }, token });
        name = data.username ? `@${data.username}` : "";
      } catch {
        name = "";
      }
      return { state: "connected", account: { id, name } };
    } catch (err) {
      return errorStatus(err);
    }
  }

  capabilities(): ChannelCapabilities {
    return { nativeSchedule: false, imageFormats: ["image/jpeg"] };
  }

  async publish(): Promise<PublishResult> {
    throw new UnsupportedOperationError(INSTAGRAM_NOT_BUILT);
  }

  async schedule(): Promise<PublishResult> {
    throw new UnsupportedOperationError(INSTAGRAM_NOT_BUILT);
  }

  async insights(): Promise<InsightPoint[]> {
    throw new UnsupportedOperationError(INSTAGRAM_NOT_BUILT);
  }
}

/** A channel that is not connected: status() says so and every action throws. */
export class NotConnectedChannel implements SocialChannel {
  constructor(
    readonly id: ChannelId,
    private readonly missing: string[],
    private readonly message = "This channel is not connected."
  ) {}

  async status(): Promise<IntegrationStatus> {
    return { state: "not_configured", missing: this.missing };
  }

  capabilities(): ChannelCapabilities {
    return { nativeSchedule: false, imageFormats: [] };
  }

  async publish(): Promise<PublishResult> {
    throw new IntegrationNotConfiguredError(this.missing, this.message);
  }

  async schedule(): Promise<PublishResult> {
    throw new IntegrationNotConfiguredError(this.missing, this.message);
  }

  async insights(): Promise<InsightPoint[]> {
    throw new IntegrationNotConfiguredError(this.missing, this.message);
  }
}

/** LinkedIn has no integration yet. */
export const LINKEDIN_CHANNEL = new NotConnectedChannel("linkedin", [], LINKEDIN_NOT_BUILT);
