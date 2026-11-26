// What the server has configured. Computed on the server (lib/server/features.ts) and passed to the client.
// Isomorphic: no directive, no secrets, no browser globals.

export interface FeatureFlags {
  sheets: { configured: boolean; version: 1 | 2 | null };
  assistant: { configured: boolean; model: "claude-opus-5-5" };
  meta: {
    configured: boolean;
    publishEnabled: boolean;
    leadsEnabled: boolean;
    /** Names of the missing environment variables. Always [] for non-admins. */
    missing: string[];
    /** 'YYYY-MM-DD' expiry of the system-user token, when set. */
    tokenExpiresAt: string | null;
  };
}

/** Everything off. Used before the server answers, in dev harnesses and in tests. */
export const NO_FEATURES: FeatureFlags = {
  sheets: { configured: false, version: null },
  assistant: { configured: false, model: "claude-opus-5-5" },
  meta: {
    configured: false,
    publishEnabled: false,
    leadsEnabled: false,
    missing: [],
    tokenExpiresAt: null,
  },
};
