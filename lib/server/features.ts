import "server-only";

import type { FeatureFlags } from "@/lib/features";
import { readMetaConfig } from "@/lib/integrations/meta/config";
import { getScriptVersion, sheetsConfig } from "@/lib/server/sheets";

/** What is configured on this server, safe to pass to the client. Secrets never leave this function. */
export async function getFeatureFlags(viewer: { isAdmin: boolean }): Promise<FeatureFlags> {
  const sheetsConfigured = sheetsConfig() !== null;
  let version: 1 | 2 | null = null;
  if (sheetsConfigured) {
    try {
      version = await getScriptVersion();
    } catch {
      version = null;
    }
  }

  const { config, missing } = readMetaConfig();
  const metaConfigured = config !== null;

  return {
    sheets: { configured: sheetsConfigured, version },
    assistant: { configured: !!process.env.ANTHROPIC_API_KEY?.trim(), model: "claude-opus-5-5" },
    meta: {
      configured: metaConfigured,
      publishEnabled: metaConfigured && process.env.META_PUBLISH_ENABLED === "true",
      leadsEnabled: metaConfigured && !!config?.webhookVerifyToken && version === 2,
      missing: viewer.isAdmin ? missing : [],
      tokenExpiresAt: config?.tokenExpiresAt ?? null,
    },
  };
}
