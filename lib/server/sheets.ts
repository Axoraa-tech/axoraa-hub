import "server-only";

// Server client for the Google Apps Script web app. The URL and token never leave the server and are
// never logged. v1 calls (work logs) behave exactly as the original /api/sheets route; v2 calls follow
// the wire protocol in lib/googleAppsScriptCode.ts.
import type { ActivityEvent, DailyWorkLogEntry } from "@/lib/types";
import { csvSafe } from "@/lib/format";
import {
  decodeRow,
  encodeRow,
  EncodeTooLargeError,
  ENTITIES,
  REMOTE_ENTITIES,
  type RemoteEntity,
} from "@/lib/data/entities";
import type { SequenceSpec } from "@/lib/data/sequences";

export function sheetsConfig(): { url: string; token: string } | null {
  const url = process.env.SHEETS_WEBAPP_URL;
  const token = process.env.SHEETS_API_TOKEN;
  return url && token && url.startsWith("https://") ? { url, token } : null;
}

export type SheetsErrorCode = "not_configured" | "script_outdated" | "upstream" | "too_large" | "timeout";

const STATUS_FOR: Record<SheetsErrorCode, number> = {
  not_configured: 503,
  script_outdated: 409,
  upstream: 502,
  too_large: 413,
  timeout: 504,
};

export class SheetsError extends Error {
  status: number;
  code: SheetsErrorCode;
  constructor(code: SheetsErrorCode, message?: string, status?: number) {
    super(message ?? code);
    this.name = "SheetsError";
    this.code = code;
    this.status = status ?? STATUS_FOR[code];
  }
}

const VERSION_TTL_MS = 60_000;
const LIST_TTL_MS = 30_000;
const VERSION_TIMEOUT_MS = 4_000;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_BULK_ROWS = 200;
const ACTIVITY_LIMIT = 500;

function requireConfig() {
  const cfg = sheetsConfig();
  if (!cfg) throw new SheetsError("not_configured", "Google Sheets is not configured on the server");
  return cfg;
}

function isTimeout(err: unknown) {
  return err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
}

/** GET with query params; the token is added here and never included in errors. */
async function getJson(params: Record<string, string>, timeoutMs = FETCH_TIMEOUT_MS): Promise<Record<string, unknown>> {
  const cfg = requireConfig();
  const q = new URLSearchParams({ ...params, token: cfg.token });
  let res: Response;
  try {
    res = await fetch(`${cfg.url}?${q.toString()}`, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    if (isTimeout(err)) throw new SheetsError("timeout", "Google Sheets took too long to answer");
    throw new SheetsError("upstream", "Could not reach Google Sheet");
  }
  return parseBody(res);
}

async function postJson(payload: object, timeoutMs = FETCH_TIMEOUT_MS): Promise<Record<string, unknown>> {
  const cfg = requireConfig();
  let res: Response;
  try {
    res = await fetch(cfg.url, {
      method: "POST",
      // text/plain keeps Apps Script from requiring a CORS preflight; it parses e.postData.contents.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...payload, token: cfg.token }),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (isTimeout(err)) throw new SheetsError("timeout", "Google Sheets took too long to answer");
    throw new SheetsError("upstream", "Could not reach Google Sheet");
  }
  return parseBody(res);
}

async function parseBody(res: Response): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object") return body as Record<string, unknown>;
  } catch {
    // Apps Script answers with an HTML page when the deployment is wrong.
  }
  throw new SheetsError("upstream", "Google Sheet returned an unreadable response");
}

/** Maps a v2 failure body to an error. A v1 script answers new actions with 'Unknown action'. */
function v2Failure(body: Record<string, unknown>): SheetsError {
  const msg = typeof body.error === "string" ? body.error : "Google Sheet request failed";
  if (/unknown action/i.test(msg)) return new SheetsError("script_outdated", "The Apps Script is version 1. Redeploy version 2.");
  if (/unauthorized/i.test(msg)) return new SheetsError("upstream", "Google Sheet rejected the server token");
  return new SheetsError("upstream", msg);
}

// ---------------------------------------------------------------- version

let versionCache: { value: 1 | 2 | null; at: number } | null = null;

/** 2 for the v2 script, 1 for the original script, null when not configured or unreachable. Cached 60s. */
export async function getScriptVersion(): Promise<1 | 2 | null> {
  if (!sheetsConfig()) return null;
  if (versionCache && Date.now() - versionCache.at < VERSION_TTL_MS) return versionCache.value;
  let value: 1 | 2 | null = null;
  try {
    const body = await getJson({ action: "VERSION" }, VERSION_TIMEOUT_MS);
    if (body.success === true && Number(body.version) >= 2) value = 2;
    else if (body.success === true && Array.isArray(body.rows)) value = 1; // v1 ignores the action
  } catch {
    value = null;
  }
  // A failed or timed-out probe is not cached: a cold Apps Script must not look unconfigured for a minute.
  if (value !== null) versionCache = { value, at: Date.now() };
  return value;
}

// ---------------------------------------------------------------- v1: work logs

const WORK_LOG_STRING_FIELDS: (keyof DailyWorkLogEntry)[] = [
  "date", "developerName", "project", "repository", "module", "workType", "taskDescription", "githubPr",
  "workStatus", "priority", "isBlocked", "blockerDetails", "reviewRequired", "reviewer", "deployment",
  "productionImpact", "notes", "lastUpdated",
];

function safeLog(row: DailyWorkLogEntry): DailyWorkLogEntry {
  const out = { ...row } as Record<string, unknown>;
  for (const f of WORK_LOG_STRING_FIELDS) if (typeof out[f] === "string") out[f] = csvSafe(out[f] as string);
  return out as unknown as DailyWorkLogEntry;
}

/** Every row of the 'Daily Work Log' tab (unfiltered; the route filters for members). */
export async function listWorkLogs(): Promise<DailyWorkLogEntry[]> {
  const body = await getJson({});
  if (body.success !== true || !Array.isArray(body.rows)) {
    throw new SheetsError("upstream", typeof body.error === "string" ? body.error : "Sheet returned no rows");
  }
  return body.rows as DailyWorkLogEntry[];
}

export interface V1Result {
  success: boolean;
  message?: string;
  error?: string;
  count?: number;
}

/** ADD_LOG: appends one row. Returns the script's answer as-is (success false is not thrown). */
export async function addWorkLog(row: DailyWorkLogEntry): Promise<V1Result> {
  return (await postJson({ action: "ADD_LOG", data: safeLog(row) })) as unknown as V1Result;
}

/** SYNC_ALL: overwrites every data row of the tab. Returns the script's answer as-is. */
export async function syncAllWorkLogs(rows: DailyWorkLogEntry[]): Promise<V1Result> {
  return (await postJson({ action: "SYNC_ALL", data: rows.map(safeLog) })) as unknown as V1Result;
}

// ---------------------------------------------------------------- v2: records

type ListAllData = Partial<Record<RemoteEntity, Record<string, unknown>[]>>;

let listCache: { data: ListAllData; at: number } | null = null;
let listInFlight: Promise<ListAllData> | null = null;
let cacheGeneration = 0;

export function invalidateCache(): void {
  listCache = null;
  listInFlight = null;
  cacheGeneration++;
}

function decodeTab(entity: RemoteEntity, rows: unknown): Record<string, unknown>[] {
  if (!Array.isArray(rows)) return [];
  const out: Record<string, unknown>[] = [];
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const decoded = decodeRow<Record<string, unknown>>(entity, r as Record<string, unknown>);
    if (typeof decoded.id === "string" && decoded.id) out.push(decoded);
  }
  return out;
}

async function fetchAll(): Promise<ListAllData> {
  const tabs = REMOTE_ENTITIES.map((e) => ENTITIES[e].sheetTab).join(",");
  const body = await getJson({ action: "LIST_ALL", tabs });
  if (body.success !== true) throw v2Failure(body);
  if (!body.tabs || typeof body.tabs !== "object") {
    throw new SheetsError("script_outdated", "The Apps Script is version 1. Redeploy version 2.");
  }
  const tabMap = body.tabs as Record<string, { rows?: unknown }>;
  const data: ListAllData = {};
  for (const entity of REMOTE_ENTITIES) {
    let rows = decodeTab(entity, tabMap[ENTITIES[entity].sheetTab]?.rows);
    if (entity === "activity" && rows.length > ACTIVITY_LIMIT) rows = rows.slice(-ACTIVITY_LIMIT);
    data[entity] = rows;
  }
  return data;
}

/** Every v2 tab, decoded. One shared 30s cache per server instance; activity holds the last 500 rows. */
export async function listAll(): Promise<ListAllData> {
  if (listCache && Date.now() - listCache.at < LIST_TTL_MS) return listCache.data;
  if (listInFlight) return listInFlight;
  const generation = cacheGeneration;
  const p = fetchAll()
    .then((data) => {
      if (generation === cacheGeneration) listCache = { data, at: Date.now() };
      return data;
    })
    .finally(() => {
      if (listInFlight === p) listInFlight = null;
    });
  listInFlight = p;
  return p;
}

/** One tab, decoded (served from the listAll cache when it is fresh). */
export async function listTab(entity: RemoteEntity): Promise<Record<string, unknown>[]> {
  if (listCache && Date.now() - listCache.at < LIST_TTL_MS) return listCache.data[entity] ?? [];
  const body = await getJson({ action: "LIST", tab: ENTITIES[entity].sheetTab });
  if (body.success !== true) throw v2Failure(body);
  if (!Array.isArray(body.rows)) throw new SheetsError("script_outdated", "The Apps Script is version 1. Redeploy version 2.");
  return decodeTab(entity, body.rows);
}

function encode(entity: RemoteEntity | "activity", row: object) {
  try {
    return encodeRow(entity, row);
  } catch (err) {
    if (err instanceof EncodeTooLargeError) throw new SheetsError("too_large", err.message);
    throw err;
  }
}

export async function upsertRow(
  entity: RemoteEntity,
  row: object,
  opts?: { mode?: "upsert" | "insert_only"; sequences?: SequenceSpec[]; activity?: ActivityEvent }
): Promise<{ row: Record<string, unknown>; created: boolean; skipped: boolean }> {
  const payload = {
    action: "UPSERT",
    tab: ENTITIES[entity].sheetTab,
    row: encode(entity, row),
    mode: opts?.mode ?? "upsert",
    sequences: opts?.sequences ?? [],
    activity: opts?.activity ? encode("activity", opts.activity) : undefined,
  };
  try {
    const body = await postJson(payload);
    if (body.success !== true) throw v2Failure(body);
    const raw = body.row && typeof body.row === "object" ? (body.row as Record<string, unknown>) : {};
    return {
      row: decodeRow<Record<string, unknown>>(entity, raw),
      created: body.created === true,
      skipped: body.skipped === true,
    };
  } finally {
    invalidateCache();
  }
}

export async function bulkUpsert(
  entity: RemoteEntity,
  rows: object[],
  mode: "upsert" | "insert_only" = "upsert"
): Promise<{ upserted: number; skipped: number }> {
  let upserted = 0;
  let skipped = 0;
  try {
    for (let i = 0; i < rows.length; i += MAX_BULK_ROWS) {
      const chunk = rows.slice(i, i + MAX_BULK_ROWS).map((r) => encode(entity, r));
      const body = await postJson({ action: "BULK_UPSERT", tab: ENTITIES[entity].sheetTab, rows: chunk, mode });
      if (body.success !== true) throw v2Failure(body);
      upserted += Number(body.upserted) || 0;
      skipped += Number(body.skipped) || 0;
    }
  } finally {
    invalidateCache();
  }
  return { upserted, skipped };
}

export async function deleteRow(entity: RemoteEntity, id: string, activity?: ActivityEvent): Promise<{ deleted: boolean }> {
  try {
    const body = await postJson({
      action: "DELETE",
      tab: ENTITIES[entity].sheetTab,
      id,
      activity: activity ? encode("activity", activity) : undefined,
    });
    if (body.success !== true) throw v2Failure(body);
    return { deleted: body.deleted === true };
  } finally {
    invalidateCache();
  }
}
