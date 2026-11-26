// Local storage schema migrations. Rules:
// - idempotent: running twice changes nothing the second time;
// - never deletes or renames a key (writes only replace an array with a repaired copy); the one
//   seed is the v1 built-in rows for an upgraded browser, written only where a key is missing;
// - only arrays that actually change are written back.
import {
  DEMO_CAMPAIGNS,
  DEMO_POSTS,
  INITIAL_CLIENT_MASTER,
  INITIAL_INTERACTIONS,
  INITIAL_MARKETING_DEALS,
  INITIAL_PAYMENT_BILLING,
  INITIAL_PROJECT_PROGRESS,
  INITIAL_REPOSITORIES,
  INITIAL_ROSTER,
  INITIAL_WORK_LOGS,
  MOCK_IDS,
} from "../mockData";
import { newId, nowISO, parseInstant } from "../format";
import { readRaw, writeCollection, writeRaw, STORAGE_KEYS } from "../storage";
import { ENTITIES, type EntityKey } from "./entities";

export const SCHEMA_VERSION = 2;

/** Array collections that existed in v1. */
const V1_ARRAY_ENTITIES: EntityKey[] = ["workLogs", "roster", "repositories", "deals", "interactions", "clients", "projects", "payments"];
/** Collections added in v2 (repaired the same way if present). */
const V2_ARRAY_ENTITIES: EntityKey[] = ["posts", "campaigns", "drafts"];

/** Data keys whose presence means this browser already has (or had) v1 data. */
const V1_DATA_KEYS = [...V1_ARRAY_ENTITIES.map((k) => ENTITIES[k].storageKey), STORAGE_KEYS.FOUNDER_MATRIX];

/** Set once the v1 built-in rows have been written for an upgraded browser (see runMigrations). */
const V1_DEFAULTS_KEY = "axoraa_v1_defaults_v1";

type Row = Record<string, unknown>;

function parseArray(raw: string | null): Row[] | null {
  if (raw === null) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? (v as Row[]) : null;
  } catch {
    return null;
  }
}

function isoFrom(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const ms = parseInstant(v);
  return ms === null ? null : new Date(ms).toISOString();
}

const norm = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : "");

/**
 * Pure v1→v2 repair of one collection: unique ids, createdAt/updatedAt backfilled, demo flag for mock ids.
 * Returns the new rows and whether anything changed. Non-object entries are kept untouched.
 */
export function migrateRows(entity: EntityKey, rows: Row[], now: string): { rows: Row[]; changed: boolean } {
  const seen = new Set<string>();
  let changed = false;
  const out = rows.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return row;
    const next: Row = { ...row };
    let id = typeof next.id === "string" ? next.id.trim() : typeof next.id === "number" ? String(next.id) : "";
    if (!id || seen.has(id)) {
      id = newId(ENTITIES[entity].idPrefix);
      next.id = id;
      changed = true;
    } else if (next.id !== id) {
      next.id = id;
      changed = true;
    }
    seen.add(id);

    if (typeof next.createdAt !== "string" || !next.createdAt) {
      next.createdAt = isoFrom(next.lastUpdated) ?? isoFrom(next.dateAdded) ?? isoFrom(next.date) ?? isoFrom(next.at) ?? now;
      changed = true;
    }
    if (typeof next.updatedAt !== "string" || !next.updatedAt) {
      next.updatedAt = isoFrom(next.lastUpdated) ?? (next.createdAt as string);
      changed = true;
    }
    if (MOCK_IDS.has(id) && next.demo !== true) {
      next.demo = true;
      changed = true;
    }
    return next;
  });
  return { rows: out, changed };
}

/**
 * Links visits without a dealId to a deal ONLY when exactly one deal matches on BOTH lead ID and
 * company name (case-insensitive, trimmed). Visits with no match, or several, stay unlinked.
 */
export function backfillVisitDeals(visits: Row[], deals: Row[]): { rows: Row[]; changed: boolean } {
  let changed = false;
  const out = visits.map((v) => {
    if (!v || typeof v !== "object" || v.dealId) return v;
    const lead = norm(v.leadId);
    const company = norm(v.companyName);
    if (!lead || !company) return v;
    const matches = deals.filter((d) => d && norm(d.leadId) === lead && norm(d.companyName) === company && typeof d.id === "string");
    if (matches.length !== 1) return v;
    changed = true;
    return { ...v, dealId: matches[0].id };
  });
  return { rows: out, changed };
}

/** Runs the v1→v2 local migration. Safe to call on every mount. */
export function runMigrations(): void {
  if (typeof window === "undefined") return;
  const now = nowISO();
  const firstV2Run = readRaw(STORAGE_KEYS.SCHEMA_VERSION) !== String(SCHEMA_VERSION);

  const anyV1 = V1_DATA_KEYS.some((k) => readRaw(k) !== null);
  if (anyV1 && readRaw(STORAGE_KEYS.SEEDED) !== "1") writeRaw(STORAGE_KEYS.SEEDED, "1");

  const loaded = new Map<EntityKey, Row[]>();
  for (const entity of [...V1_ARRAY_ENTITIES, ...V2_ARRAY_ENTITIES]) {
    const key = ENTITIES[entity].storageKey;
    const rows = parseArray(readRaw(key));
    if (!rows) continue; // missing or unreadable: leave the key exactly as it is
    const res = migrateRows(entity, rows, now);
    loaded.set(entity, res.rows);
    if (res.changed) writeRaw(key, JSON.stringify(res.rows));
  }

  // v1 showed the built-in rows for these collections without ever saving them. A browser upgrading
  // from v1 would otherwise find Clients, Projects, Invoices, Roster and Repositories empty, so write
  // those rows once (flagged demo, so they are never uploaded) wherever the key is still missing.
  if (anyV1 && readRaw(V1_DEFAULTS_KEY) !== "1") {
    const defaults: [EntityKey, object[]][] = [
      ["clients", INITIAL_CLIENT_MASTER],
      ["projects", INITIAL_PROJECT_PROGRESS],
      ["payments", INITIAL_PAYMENT_BILLING],
      ["roster", INITIAL_ROSTER],
      ["repositories", INITIAL_REPOSITORIES],
    ];
    for (const [entity, rows] of defaults) {
      const key = ENTITIES[entity].storageKey;
      if (readRaw(key) === null) writeRaw(key, JSON.stringify(demoRows(rows, now)));
    }
    writeRaw(V1_DEFAULTS_KEY, "1");
  }

  // The visit-to-deal backfill runs once, on the first v2 run only.
  if (firstV2Run) {
    const visits = loaded.get("interactions");
    const deals = loaded.get("deals");
    if (visits && deals) {
      const res = backfillVisitDeals(visits, deals);
      if (res.changed) writeRaw(ENTITIES.interactions.storageKey, JSON.stringify(res.rows));
    }
    writeRaw(STORAGE_KEYS.SCHEMA_VERSION, String(SCHEMA_VERSION));
  }
}

/** Marks this browser as seeded so demo data is never written later (used once shared mode is seen). */
export function markSeeded(): void {
  if (typeof window === "undefined") return;
  if (readRaw(STORAGE_KEYS.SEEDED) !== "1") writeRaw(STORAGE_KEYS.SEEDED, "1");
}

function demoRows<T extends object>(rows: T[], now: string): T[] {
  return rows.map((r) => ({ createdAt: now, updatedAt: now, ...r, demo: true }));
}

/** Writes the demo data set (demo: true) into every collection. Used by seeding and by resetLocalData('demo'). */
export function writeDemoData(): void {
  const now = nowISO();
  writeCollection(ENTITIES.workLogs.storageKey, demoRows(INITIAL_WORK_LOGS, now), ENTITIES.workLogs.event);
  writeCollection(ENTITIES.roster.storageKey, demoRows(INITIAL_ROSTER, now), ENTITIES.roster.event);
  writeCollection(ENTITIES.repositories.storageKey, demoRows(INITIAL_REPOSITORIES, now), ENTITIES.repositories.event);
  writeCollection(ENTITIES.deals.storageKey, demoRows(INITIAL_MARKETING_DEALS, now), ENTITIES.deals.event);
  writeCollection(ENTITIES.interactions.storageKey, demoRows(INITIAL_INTERACTIONS, now), ENTITIES.interactions.event);
  writeCollection(ENTITIES.clients.storageKey, demoRows(INITIAL_CLIENT_MASTER, now), ENTITIES.clients.event);
  writeCollection(ENTITIES.projects.storageKey, demoRows(INITIAL_PROJECT_PROGRESS, now), ENTITIES.projects.event);
  writeCollection(ENTITIES.payments.storageKey, demoRows(INITIAL_PAYMENT_BILLING, now), ENTITIES.payments.event);
  writeCollection(ENTITIES.posts.storageKey, demoRows(DEMO_POSTS, now), ENTITIES.posts.event);
  writeCollection(ENTITIES.campaigns.storageKey, demoRows(DEMO_CAMPAIGNS, now), ENTITIES.campaigns.event);
}

/**
 * Seeds demo data on a first-ever run only: no v1 key exists and the browser was never seeded.
 * Call ONLY after remoteStatus() has resolved with version !== 2. Returns true when it seeded.
 */
export function seedDemoIfFirstRun(): boolean {
  if (typeof window === "undefined") return false;
  if (readRaw(STORAGE_KEYS.SEEDED) === "1") return false;
  if (V1_DATA_KEYS.some((k) => readRaw(k) !== null)) {
    writeRaw(STORAGE_KEYS.SEEDED, "1");
    return false;
  }
  writeDemoData();
  writeRaw(STORAGE_KEYS.SEEDED, "1");
  writeRaw(STORAGE_KEYS.SCHEMA_VERSION, String(SCHEMA_VERSION));
  return true;
}
