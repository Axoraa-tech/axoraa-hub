import "server-only";

// Meta (Facebook Page, Instagram, Lead Ads, Marketing API) configuration, read from the environment.
// Never log or return the secrets themselves; callers only get `missing` (variable names) to show.

export interface MetaConfig {
  /** META_GRAPH_VERSION, default 'v27.0'. */
  graphVersion: string;
  appId: string;
  appSecret: string;
  businessId?: string;
  systemUserToken?: string;
  /** META_SYSTEM_USER_TOKEN_EXPIRES_AT, 'YYYY-MM-DD'. */
  tokenExpiresAt?: string;
  pageId: string;
  pageAccessToken?: string;
  igUserId?: string;
  adAccountId?: string;
  webhookVerifyToken?: string;
  /** META_LEADGEN_FORM_IDS, comma-separated. */
  leadgenFormIds: string[];
}

export const DEFAULT_META_GRAPH_VERSION = "v27.0";

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/**
 * Required: META_APP_ID, META_APP_SECRET, META_PAGE_ID, and one of META_SYSTEM_USER_TOKEN / META_PAGE_ACCESS_TOKEN.
 * config is null whenever anything required is missing.
 */
export function readMetaConfig(): { config: MetaConfig | null; missing: string[] } {
  const appId = env("META_APP_ID");
  const appSecret = env("META_APP_SECRET");
  const pageId = env("META_PAGE_ID");
  const systemUserToken = env("META_SYSTEM_USER_TOKEN");
  const pageAccessToken = env("META_PAGE_ACCESS_TOKEN");

  const missing: string[] = [];
  if (!appId) missing.push("META_APP_ID");
  if (!appSecret) missing.push("META_APP_SECRET");
  if (!pageId) missing.push("META_PAGE_ID");
  if (!systemUserToken && !pageAccessToken) missing.push("META_SYSTEM_USER_TOKEN or META_PAGE_ACCESS_TOKEN");

  if (!appId || !appSecret || !pageId || missing.length > 0) return { config: null, missing };

  const expires = env("META_SYSTEM_USER_TOKEN_EXPIRES_AT");
  const config: MetaConfig = {
    graphVersion: env("META_GRAPH_VERSION") ?? DEFAULT_META_GRAPH_VERSION,
    appId,
    appSecret,
    businessId: env("META_BUSINESS_ID"),
    systemUserToken,
    tokenExpiresAt: expires && /^\d{4}-\d{2}-\d{2}/.test(expires) ? expires.slice(0, 10) : undefined,
    pageId,
    pageAccessToken,
    igUserId: env("META_IG_USER_ID"),
    adAccountId: env("META_AD_ACCOUNT_ID"),
    webhookVerifyToken: env("META_WEBHOOK_VERIFY_TOKEN"),
    leadgenFormIds: (env("META_LEADGEN_FORM_IDS") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
  return { config, missing: [] };
}
