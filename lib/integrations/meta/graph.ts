import "server-only";

// Minimal Graph API client. Every call is pinned to META_GRAPH_VERSION and carries appsecret_proof
// (HMAC-SHA256 keyed by the app secret over the access token). URLs, tokens and bodies are never logged.
import { createHmac } from "node:crypto";
import { IntegrationNotConfiguredError, MetaGraphError } from "../errors";
import { readMetaConfig, type MetaConfig } from "./config";

const GRAPH_ORIGIN = "https://graph.facebook.com";
const TIMEOUT_MS = 15_000;
const PAGE_TOKEN_TTL_MS = 60 * 60 * 1000;
const MAX_MESSAGE = 300;

export type GraphParams = Record<string, string | number | boolean | undefined | null>;

export interface GraphDebug {
  /** Raw x-app-usage header (call-count percentages), when Meta sent one. */
  appUsage?: string;
  /** Raw x-business-use-case-usage header, when Meta sent one. */
  businessUseCaseUsage?: string;
}

export interface GraphResult<T> {
  data: T;
  debug: GraphDebug;
}

/** Graph ids are digits (pages, forms, leads, posts) or digits joined by '_' (post ids) or 'act_<digits>'. */
const GRAPH_ID = /^(act_)?\d{1,40}(_\d{1,40})?$/;

export function isGraphId(v: unknown): v is string {
  return typeof v === "string" && GRAPH_ID.test(v);
}

export function requireMetaConfig(): MetaConfig {
  const { config, missing } = readMetaConfig();
  if (!config) throw new IntegrationNotConfiguredError(missing, "Meta is not connected on the server yet.");
  return config;
}

export function appSecretProof(appSecret: string, accessToken: string): string {
  return createHmac("sha256", appSecret).update(accessToken).digest("hex");
}

function cleanMessage(raw: unknown, fallback: string): string {
  const text = typeof raw === "string" && raw.trim() ? raw.trim() : fallback;
  // Graph messages do not carry tokens, but trim anything long or token-shaped to be safe.
  return text.replace(/EAA[A-Za-z0-9]{20,}/g, "[token]").slice(0, MAX_MESSAGE);
}

function toParams(params: GraphParams | undefined): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v === undefined || v === null) continue;
    out.set(k, String(v));
  }
  return out;
}

/**
 * Calls https://graph.facebook.com/<version>/<path>. GET sends the params in the query; POST and DELETE
 * send params plus body as a form. Errors become MetaGraphError (code 190: the token is invalid).
 */
export async function graphFetch<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "DELETE"; params?: GraphParams; token: string; body?: GraphParams }
): Promise<GraphResult<T>> {
  const config = requireMetaConfig();
  const method = opts.method ?? "GET";
  const cleanPath = path.replace(/^\/+/, "");
  if (!/^[A-Za-z0-9_/]+$/.test(cleanPath)) throw new MetaGraphError(100, null, "client", "Invalid Graph path", 400);

  const auth = { access_token: opts.token, appsecret_proof: appSecretProof(config.appSecret, opts.token) };
  const url = new URL(`${GRAPH_ORIGIN}/${config.graphVersion}/${cleanPath}`);
  let body: URLSearchParams | undefined;
  if (method === "GET") {
    url.search = toParams({ ...opts.params, ...auth }).toString();
  } else {
    url.search = toParams(opts.params).toString();
    body = toParams({ ...opts.body, ...auth });
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      body,
      headers: body ? { "Content-Type": "application/x-www-form-urlencoded" } : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    throw new MetaGraphError(
      -1,
      null,
      timeout ? "timeout" : "network",
      timeout ? "Meta took too long to answer." : "Could not reach Meta.",
      timeout ? 504 : 502
    );
  }

  const debug: GraphDebug = {};
  const appUsage = res.headers.get("x-app-usage");
  const bucUsage = res.headers.get("x-business-use-case-usage");
  if (appUsage) debug.appUsage = appUsage;
  if (bucUsage) debug.businessUseCaseUsage = bucUsage;

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  const errObj =
    json && typeof json === "object" && "error" in json && (json as { error: unknown }).error && typeof (json as { error: unknown }).error === "object"
      ? ((json as { error: Record<string, unknown> }).error as Record<string, unknown>)
      : null;

  if (!res.ok || errObj) {
    const code = typeof errObj?.code === "number" ? errObj.code : res.status;
    const subcode = typeof errObj?.error_subcode === "number" ? errObj.error_subcode : null;
    const type = typeof errObj?.type === "string" ? errObj.type : "unknown";
    const message = code === 190 ? "The Meta access token is invalid or has expired." : cleanMessage(errObj?.message, `Meta answered with status ${res.status}.`);
    throw new MetaGraphError(code, subcode, type, message, res.status >= 400 ? res.status : 502);
  }
  if (json === null || typeof json !== "object") {
    throw new MetaGraphError(-1, null, "parse", "Meta returned an unreadable response.", 502);
  }
  return { data: json as T, debug };
}

let pageTokenCache: { pageId: string; token: string; at: number } | null = null;

/** META_PAGE_ACCESS_TOKEN when set; otherwise derived from the system-user token and cached for 1 hour. */
export async function getPageToken(): Promise<string> {
  const config = requireMetaConfig();
  if (config.pageAccessToken) return config.pageAccessToken;
  if (!config.systemUserToken) {
    throw new IntegrationNotConfiguredError(["META_SYSTEM_USER_TOKEN or META_PAGE_ACCESS_TOKEN"]);
  }
  if (pageTokenCache && pageTokenCache.pageId === config.pageId && Date.now() - pageTokenCache.at < PAGE_TOKEN_TTL_MS) {
    return pageTokenCache.token;
  }
  const { data } = await graphFetch<{ access_token?: string }>(config.pageId, {
    params: { fields: "access_token" },
    token: config.systemUserToken,
  });
  if (!data.access_token) {
    throw new MetaGraphError(10, null, "permission", "The system user cannot get a token for this Page. Give it access to the Page in Business Settings.", 403);
  }
  pageTokenCache = { pageId: config.pageId, token: data.access_token, at: Date.now() };
  return data.access_token;
}

/** Drops the cached Page token (after Meta reports it invalid). */
export function forgetPageToken(): void {
  pageTokenCache = null;
}
