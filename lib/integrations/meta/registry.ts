import "server-only";

// One place that decides which Meta implementations are live. Without the required environment the
// callers get NotConnected null objects: status() reports what is missing and every action throws
// IntegrationNotConfiguredError.
import type { AdsReporter, ChannelId, IntegrationStatus, LeadSource, SocialChannel } from "@/lib/integrations/types";
import { MetaGraphError } from "../errors";
import { readMetaConfig } from "./config";
import { MetaAdsReporter, NotConnectedAdsReporter } from "./ads";
import { FacebookPageChannel, InstagramChannel, LINKEDIN_CHANNEL, NotConnectedChannel } from "./channels";
import { getPageToken, graphFetch } from "./graph";
import { MetaLeadSource, NotConnectedLeadSource } from "./leads";

export function getChannels(): Record<ChannelId, SocialChannel> {
  const { config, missing } = readMetaConfig();
  if (!config) {
    return {
      facebook_page: new NotConnectedChannel("facebook_page", missing, "The Facebook Page is not connected."),
      instagram: new NotConnectedChannel("instagram", missing, "Instagram is not connected."),
      linkedin: LINKEDIN_CHANNEL,
    };
  }
  return { facebook_page: new FacebookPageChannel(config), instagram: new InstagramChannel(config), linkedin: LINKEDIN_CHANNEL };
}

/** The Meta Lead Ads source, or a NotConnected one. Needs the base config and META_WEBHOOK_VERIFY_TOKEN. */
export function getMetaLeadSource(): LeadSource {
  const { config, missing } = readMetaConfig();
  if (!config) return new NotConnectedLeadSource(missing);
  if (!config.webhookVerifyToken) return new NotConnectedLeadSource(["META_WEBHOOK_VERIFY_TOKEN"]);
  return new MetaLeadSource(config);
}

export function getLeadSources(): LeadSource[] {
  return [getMetaLeadSource()];
}

export function getAdsReporter(): AdsReporter {
  const { config, missing } = readMetaConfig();
  return config ? new MetaAdsReporter(config) : new NotConnectedAdsReporter(missing);
}

export interface MetaStatuses {
  page: IntegrationStatus;
  instagram: IntegrationStatus;
  leads: IntegrationStatus;
  ads: IntegrationStatus;
}

function hideMissing(s: IntegrationStatus): IntegrationStatus {
  return s.state === "not_configured" ? { state: "not_configured", missing: [] } : s;
}

/**
 * Status of each Meta surface. Without `live` nothing is sent to Meta: a configured Page reads as
 * connected with an empty name. With `live`, one Page lookup (name and linked Instagram account) runs.
 * Non-admins never see variable names.
 */
export async function getIntegrationStatuses(opts: { live: boolean; isAdmin: boolean }): Promise<MetaStatuses> {
  const { config, missing } = readMetaConfig();
  let out: MetaStatuses;

  if (!config) {
    const nc: IntegrationStatus = { state: "not_configured", missing };
    out = { page: nc, instagram: nc, leads: { state: "not_configured", missing: [...missing, "META_WEBHOOK_VERIFY_TOKEN"] }, ads: nc };
  } else {
    const leads = await getMetaLeadSource().status();
    const ads = await getAdsReporter().status();
    const expiry = config.tokenExpiresAt ? { tokenExpiresAt: config.tokenExpiresAt } : {};

    if (!opts.live) {
      out = {
        page: { state: "connected", account: { id: config.pageId, name: "" }, ...expiry },
        instagram: config.igUserId ? { state: "connected", account: { id: config.igUserId, name: "" } } : { state: "not_configured", missing: ["META_IG_USER_ID"] },
        leads,
        ads,
      };
    } else {
      try {
        const token = await getPageToken();
        const { data } = await graphFetch<{ id?: string; name?: string; instagram_business_account?: { id?: string } }>(config.pageId, {
          params: { fields: "name,instagram_business_account" },
          token,
        });
        const igId = config.igUserId ?? data.instagram_business_account?.id ?? null;
        let instagram: IntegrationStatus = { state: "not_configured", missing: ["META_IG_USER_ID"] };
        if (igId) {
          let name = "";
          try {
            const ig = await graphFetch<{ username?: string }>(igId, { params: { fields: "username" }, token });
            name = ig.data.username ? `@${ig.data.username}` : "";
          } catch {
            name = "";
          }
          instagram = { state: "connected", account: { id: igId, name } };
        }
        out = {
          page: { state: "connected", account: { id: data.id ?? config.pageId, name: data.name ?? "" }, ...expiry },
          instagram,
          leads,
          ads,
        };
      } catch (err) {
        const at = new Date().toISOString();
        const failed: IntegrationStatus =
          err instanceof MetaGraphError
            ? { state: "error", code: err.code, message: err.message, at }
            : { state: "error", message: "Could not check the connection.", at };
        out = { page: failed, instagram: failed, leads, ads };
      }
    }
  }

  if (opts.isAdmin) return out;
  return { page: hideMissing(out.page), instagram: hideMissing(out.instagram), leads: hideMissing(out.leads), ads: hideMissing(out.ads) };
}
