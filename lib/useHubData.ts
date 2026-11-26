"use client";

// Single source of truth for the hub screens.
// - Work logs keep the v1 flow: the Google Sheet through /api/sheets when the server has it configured
//   (members only append; the admin rewrites with SYNC_ALL), otherwise this browser's storage.
// - Every other record lives in this browser's storage, and is shared through /api/data when the
//   Apps Script is version 2 ("shared mode"). Shared writes are optimistic; a failed write keeps the
//   row on this device and lists it in `unsynced` until retrySync() succeeds.
// State lives in a small external store read with useSyncExternalStore, so effects never call setState.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { GoogleSheetsService } from "./googleSheetsService";
import { readCollection, readJson, readSettings, STORAGE_KEYS, writeCollection, writeJson, writeRaw, writeSettings } from "./storage";
import { computeInvoice, deriveFounderMatrix, enrichDeal } from "./analytics";
import { newId, nowISO, todayKeyIST } from "./format";
import { MOCK_IDS } from "./mockData";
import { DEFAULT_SETTINGS, normalizeSettings, type HubSettings } from "./settings";
import { ENTITIES, REMOTE_ENTITIES, type EntityKey, type RemoteEntity } from "./data/entities";
import { applySequences, sequencesFor } from "./data/sequences";
import { canCreate, canUpdate, type PolicyViewer } from "./data/policy";
import { markSeeded, runMigrations, seedDemoIfFirstRun, writeDemoData } from "./data/migrations";
import { remoteAppendActivity, remoteBulkUpsert, remoteDelete, remoteListAll, remoteStatus, remoteUpsert } from "./data/remote";
import type { ViewerCategory } from "./hub/types";
import type {
  ActivityEvent,
  AgentDraft,
  Campaign,
  ClientMasterRecord,
  ContentPost,
  DailyWorkLogEntry,
  DeveloperRosterMember,
  FounderMatrixStats,
  HubBackup,
  MarketingDeal,
  MarketingInteraction,
  PaymentBillingRecord,
  ProjectProgressRecord,
  RepositoryMapping,
} from "./types";

// ---------------------------------------------------------------- public types

export type DataSource = "sheet" | "local";

export interface SyncState {
  busy: boolean;
  message?: string;
  error?: boolean;
  lastSyncedAt?: string | null;
}

export interface UnsyncedOp {
  entity: RemoteEntity;
  id: string;
  op: "upsert" | "delete";
  error: string;
  at: string;
}

/** On ok:false the record is KEPT locally and listed in unsynced. */
export type SaveResult<T> = { ok: true; record: T } | { ok: false; record: T; error: string };
/** On a failed delete the row is restored and the error is reported. */
export type DeleteResult = { ok: true } | { ok: false; error: string };

export interface LocalOnlySummary {
  total: number;
  byEntity: Partial<Record<RemoteEntity, number>>;
  excludedDemo: number;
}

export interface HubData {
  // Status
  ready: boolean;
  /** Where work logs come from; same meaning as before. */
  source: DataSource;
  /** The Apps Script is version 2: every record is shared through Google Sheets. */
  sharedMode: boolean;
  remoteVersion: 1 | 2 | null;
  syncState: SyncState;
  hasDemoData: boolean;
  unsynced: UnsyncedOp[];
  lastSaved: { entity: EntityKey; id: string; at: number } | null;

  // Sync actions
  retrySync(id?: string): Promise<void>;
  pullFromSheet(): Promise<unknown>;
  pushAll(): Promise<unknown>;
  localOnly: LocalOnlySummary;
  pushLocalToShared(): Promise<{ pushed: number; skipped: number; failed: number; skippedDemo: number }>;
  dismissLocalOnly(): void;

  // Work logs
  workLogs: DailyWorkLogEntry[];
  saveWorkLog(data: Partial<DailyWorkLogEntry>, editingId?: string): Promise<SaveResult<DailyWorkLogEntry>>;
  deleteWorkLog(id: string): Promise<DeleteResult>;
  updateWorkLogStatus(id: string, patch: Partial<DailyWorkLogEntry>): Promise<SaveResult<DailyWorkLogEntry>>;

  // Roster and repositories
  roster: DeveloperRosterMember[];
  setRoster(rows: DeveloperRosterMember[]): void;
  saveRosterMember(m: Partial<DeveloperRosterMember>, editingId?: string): Promise<SaveResult<DeveloperRosterMember>>;
  deleteRosterMember(id: string): Promise<DeleteResult>;
  repositories: RepositoryMapping[];
  saveRepository(r: Partial<RepositoryMapping>, editingId?: string): Promise<SaveResult<RepositoryMapping>>;
  deleteRepository(id: string): Promise<DeleteResult>;

  // Records
  deals: MarketingDeal[];
  saveDeal(d: Partial<MarketingDeal>, editingId?: string): Promise<SaveResult<MarketingDeal>>;
  deleteDeal(id: string): Promise<DeleteResult>;
  interactions: MarketingInteraction[];
  saveInteraction(i: Partial<MarketingInteraction>, editingId?: string): Promise<SaveResult<MarketingInteraction>>;
  deleteInteraction(id: string): Promise<DeleteResult>;
  clients: ClientMasterRecord[];
  saveClient(c: Partial<ClientMasterRecord>, editingId?: string): Promise<SaveResult<ClientMasterRecord>>;
  deleteClient(id: string): Promise<DeleteResult>;
  projects: ProjectProgressRecord[];
  saveProject(p: Partial<ProjectProgressRecord>, editingId?: string): Promise<SaveResult<ProjectProgressRecord>>;
  deleteProject(id: string): Promise<DeleteResult>;
  payments: PaymentBillingRecord[];
  savePayment(p: Partial<PaymentBillingRecord>, editingId?: string): Promise<SaveResult<PaymentBillingRecord>>;
  deletePayment(id: string): Promise<DeleteResult>;
  posts: ContentPost[];
  savePost(p: Partial<ContentPost>, editingId?: string): Promise<SaveResult<ContentPost>>;
  deletePost(id: string): Promise<DeleteResult>;
  campaigns: Campaign[];
  saveCampaign(c: Partial<Campaign>, editingId?: string): Promise<SaveResult<Campaign>>;
  deleteCampaign(id: string): Promise<DeleteResult>;
  drafts: AgentDraft[];
  saveDraft(d: Partial<AgentDraft>, editingId?: string): Promise<SaveResult<AgentDraft>>;
  deleteDraft(id: string): Promise<DeleteResult>;

  // Derived and settings
  founderMatrix: FounderMatrixStats[];
  /** Newest first. */
  activity: ActivityEvent[];
  logActivity(e: Omit<ActivityEvent, "id" | "at" | "actorId" | "actorName">): void;
  settings: HubSettings;
  saveSettings(patch: Partial<HubSettings>): Promise<SaveResult<HubSettings>>;

  // Backup and reset
  exportBackup(): HubBackup;
  importBackup(b: HubBackup, mode: "replace" | "merge"): Promise<{ imported: number }>;
  resetLocalData(mode: "empty" | "demo"): void;
}

// ---------------------------------------------------------------- internal state

interface Collections {
  workLogs: DailyWorkLogEntry[];
  roster: DeveloperRosterMember[];
  repositories: RepositoryMapping[];
  deals: MarketingDeal[];
  interactions: MarketingInteraction[];
  clients: ClientMasterRecord[];
  projects: ProjectProgressRecord[];
  payments: PaymentBillingRecord[];
  posts: ContentPost[];
  campaigns: Campaign[];
  drafts: AgentDraft[];
  activity: ActivityEvent[];
}
type CollectionKey = keyof Collections;
/** Collections edited through save<X>/delete<X>. */
type RecordEntity = Exclude<CollectionKey, "workLogs" | "activity">;
type RowOf<K extends CollectionKey> = Collections[K][number];
type Row = Record<string, unknown>;

const COLLECTION_KEYS: CollectionKey[] = [
  "workLogs", "roster", "repositories", "deals", "interactions", "clients", "projects", "payments", "posts", "campaigns", "drafts", "activity",
];
/** Entities that can be uploaded from the pre-shared snapshot. */
const UPLOADABLE: RecordEntity[] = ["roster", "repositories", "deals", "interactions", "clients", "projects", "payments", "posts", "campaigns", "drafts"];

interface PresharedSnapshot {
  takenAt: string;
  rows: Partial<Record<RemoteEntity, Row[]>>;
  /** Demo rows left out when the snapshot was taken. */
  demoCount: number;
  dismissed?: boolean;
}

interface HubState {
  ready: boolean;
  source: DataSource;
  sharedMode: boolean;
  remoteVersion: 1 | 2 | null;
  syncState: SyncState;
  cols: Collections;
  settings: HubSettings;
  unsynced: UnsyncedOp[];
  lastSaved: HubData["lastSaved"];
  preshared: PresharedSnapshot | null;
  /** Sheets is configured but its version could not be read: writes are blocked until a retry succeeds. */
  modeUnavailable: boolean;
  /** True once the work logs of this session came from the sheet (admin rewrites are unsafe before). */
  workLogsLoaded: boolean;
  /** Work logs appended while the sheet was unreachable; kept on this device until retried. */
  pendingLogs: DailyWorkLogEntry[];
  /** Ids per entity from the last successful listAll; null until one has loaded. */
  remoteIds: Partial<Record<RemoteEntity, string[]>> | null;
  /** IST day key used for derived fields; refreshed every minute. */
  dayKey: string;
}

const EMPTY_COLLECTIONS: Collections = {
  workLogs: [], roster: [], repositories: [], deals: [], interactions: [], clients: [], projects: [], payments: [],
  posts: [], campaigns: [], drafts: [], activity: [],
};

const INITIAL_STATE: HubState = {
  ready: false,
  source: "local",
  sharedMode: false,
  remoteVersion: null,
  syncState: { busy: false, lastSyncedAt: null },
  cols: EMPTY_COLLECTIONS,
  settings: DEFAULT_SETTINGS,
  unsynced: [],
  lastSaved: null,
  preshared: null,
  modeUnavailable: false,
  workLogsLoaded: false,
  pendingLogs: [],
  remoteIds: null,
  dayKey: "",
};

interface Store {
  get(): HubState;
  getServer(): HubState;
  set(patch: Partial<HubState> | ((s: HubState) => Partial<HubState>)): void;
  subscribe(listener: () => void): () => void;
}

function createStore(): Store {
  let state = INITIAL_STATE;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    getServer: () => INITIAL_STATE,
    set(patch) {
      const p = typeof patch === "function" ? patch(state) : patch;
      state = { ...state, ...p };
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const ACTIVITY_CAP = 500;
const BATCH = 200;
const legacyStamp = () => new Date().toISOString().replace("T", " ").substring(0, 19);
const isDemoRow = (r: object) => (r as unknown as Row).demo === true || MOCK_IDS.has(String((r as unknown as Row).id ?? ""));
const stripDemo = <T extends object>(r: T): T => {
  const { demo: _demo, ...rest } = r as Row;
  void _demo;
  return rest as T;
};
const byNewest = (a: ActivityEvent, b: ActivityEvent) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0);

/** Returns false when the device storage write failed (quota or blocked storage). */
function setCollection<K extends CollectionKey>(store: Store, key: K, rows: Collections[K], persist = true): boolean {
  store.set((s) => ({ cols: { ...s.cols, [key]: rows } }));
  return persist ? writeCollection(ENTITIES[key].storageKey, rows as unknown[], ENTITIES[key].event) : true;
}

const STORAGE_FULL = "Couldn't save on this device (storage full)";
const UNAVAILABLE = "Google Sheets can't be reached right now, so nothing was saved. Use Retry sync.";
const WL_PENDING_KEY = "axoraa_worklog_pending_v1";
const REMOTE_KNOWN_KEY = "axoraa_remote_known_v1";

function readPendingLogs(): DailyWorkLogEntry[] {
  const v = readJson<unknown>(WL_PENDING_KEY, []);
  return Array.isArray(v) ? (v.filter((o) => o && typeof o === "object" && typeof (o as Row).id === "string") as DailyWorkLogEntry[]) : [];
}

function setPendingLogs(store: Store, next: DailyWorkLogEntry[]) {
  writeJson(WL_PENDING_KEY, next);
  const n = next.length;
  store.set((s) => ({
    pendingLogs: next,
    syncState: n
      ? { ...s.syncState, busy: false, error: true, message: `${n} work log${n === 1 ? "" : "s"} not saved to Google Sheets` }
      : s.syncState.error && /not saved to Google Sheets/.test(s.syncState.message ?? "") && s.unsynced.length === 0
        ? { ...s.syncState, busy: false, error: false, message: undefined }
        : s.syncState,
  }));
}

function unsyncedMessage(n: number) {
  return n === 1 ? "1 change not saved to Google Sheets" : `${n} changes not saved to Google Sheets`;
}

function setUnsynced(store: Store, next: UnsyncedOp[]) {
  writeJson(STORAGE_KEYS.UNSYNCED, next);
  store.set((s) => ({
    unsynced: next,
    syncState: next.length
      ? { ...s.syncState, busy: false, error: true, message: unsyncedMessage(next.length) }
      : s.syncState.error && /not saved to Google Sheets/.test(s.syncState.message ?? "")
        ? { ...s.syncState, busy: false, error: false, message: undefined }
        : s.syncState,
  }));
}

function addUnsynced(store: Store, op: UnsyncedOp) {
  const rest = store.get().unsynced.filter((o) => !(o.entity === op.entity && o.id === op.id));
  setUnsynced(store, [...rest, op]);
}

function clearUnsynced(store: Store, entity: RemoteEntity, id: string) {
  const cur = store.get().unsynced;
  if (cur.some((o) => o.entity === entity && o.id === id)) setUnsynced(store, cur.filter((o) => !(o.entity === entity && o.id === id)));
}

function readUnsynced(): UnsyncedOp[] {
  const v = readJson<unknown>(STORAGE_KEYS.UNSYNCED, []);
  return Array.isArray(v) ? (v.filter((o) => o && typeof o === "object" && typeof (o as Row).id === "string") as UnsyncedOp[]) : [];
}

function readPreshared(): PresharedSnapshot | null {
  const v = readJson<PresharedSnapshot | null>(STORAGE_KEYS.PRESHARED, null);
  return v && typeof v === "object" && v.rows && typeof v.rows === "object" ? v : null;
}

/** Collection as this device should show it. In shared mode, entities the server did not return are empty. */
function localRows<K extends CollectionKey>(store: Store, key: K): Collections[K] {
  const s = store.get();
  if (s.sharedMode && key !== "workLogs" && s.remoteIds && !s.remoteIds[key as RemoteEntity]) return [] as unknown as Collections[K];
  const rows = readCollection<RowOf<K>>(ENTITIES[key].storageKey) as Collections[K];
  if (key === "activity") return [...(rows as ActivityEvent[])].sort(byNewest) as Collections[K];
  return rows;
}

function reloadEntity(store: Store, key: CollectionKey) {
  if (key === "workLogs" && store.get().source === "sheet") return; // sheet rows are not cached locally
  setCollection(store, key, localRows(store, key), false);
}

function loadLocal(store: Store) {
  const cols = { ...store.get().cols };
  for (const key of COLLECTION_KEYS) {
    if (key === "workLogs" && store.get().source === "sheet") continue;
    (cols as Record<CollectionKey, unknown>)[key] = localRows(store, key);
  }
  store.set({ cols, settings: readSettings(), unsynced: readUnsynced(), preshared: readPreshared(), pendingLogs: readPendingLogs() });
}

// ---------------------------------------------------------------- shared mode

/**
 * Snapshot of this device's own rows to offer for upload. Taken once, then topped up on every shared start with
 * non-demo local rows that are neither in it nor known to have come from the sheet.
 */
function takePresharedSnapshot(store: Store) {
  const existing = readPreshared();
  const snap: PresharedSnapshot = existing ?? { takenAt: nowISO(), rows: {}, demoCount: 0 };
  const known = readJson<Record<string, string[]>>(REMOTE_KNOWN_KEY, {});
  let added = 0;
  for (const key of UPLOADABLE) {
    const rows = readCollection<Row>(ENTITIES[key].storageKey);
    const keep = rows.filter((r) => !isDemoRow(r));
    if (!existing) snap.demoCount += rows.length - keep.length;
    const have = new Set((snap.rows[key] ?? []).map((r) => String(r.id)));
    const fromSheet = new Set(Array.isArray(known[key]) ? known[key] : []);
    const fresh = keep.filter((r) => !have.has(String(r.id)) && !fromSheet.has(String(r.id)));
    if (!fresh.length) continue;
    snap.rows[key] = [...(snap.rows[key] ?? []), ...fresh];
    added += fresh.length;
  }
  if (existing && !added) return;
  if (existing && added) snap.dismissed = false;
  writeJson(STORAGE_KEYS.PRESHARED, snap);
  store.set({ preshared: snap });
}

async function refreshShared(store: Store): Promise<boolean> {
  store.set((s) => ({ syncState: { ...s.syncState, busy: true, message: "Loading from Google Sheets" } }));
  const res = await remoteListAll();
  if (!res.ok) {
    store.set((s) => ({
      syncState: { ...s.syncState, busy: false, error: true, message: "Couldn't reach Google Sheets. Showing data saved on this device." },
    }));
    return false;
  }
  const s = store.get();
  const unsynced = s.unsynced;
  const remoteIds: Partial<Record<RemoteEntity, string[]>> = {};
  const knownBefore = readJson<Record<string, string[]>>(REMOTE_KNOWN_KEY, {});
  const cols = { ...s.cols };
  for (const entity of REMOTE_ENTITIES) {
    const remote = res.data[entity];
    if (!Array.isArray(remote)) continue;
    remoteIds[entity] = remote.map((r) => String(r.id));
    if (entity === "settings") {
      if (remote[0]) {
        const settings = normalizeSettings(remote[0]);
        writeSettings(settings);
        store.set({ settings });
      }
      continue;
    }
    const key = entity as CollectionKey;
    // Unsynced local rows win over remote rows with the same id; unsynced deletes stay deleted.
    const pendingUpsert = new Set(unsynced.filter((o) => o.entity === entity && o.op === "upsert").map((o) => o.id));
    const pendingDelete = new Set(unsynced.filter((o) => o.entity === entity && o.op === "delete").map((o) => o.id));
    const localById = new Map((s.cols[key] as unknown as Row[]).map((r) => [String(r.id), r]));
    let merged: Row[] = remote.filter((r) => !pendingDelete.has(String(r.id))).map((r) => (pendingUpsert.has(String(r.id)) && localById.has(String(r.id)) ? localById.get(String(r.id))! : r));
    for (const id of pendingUpsert) {
      if (!remoteIds[entity]!.includes(id) && localById.has(id)) merged.unshift(localById.get(id)!);
    }
    if (key === "activity") merged = (merged as unknown as ActivityEvent[]).sort(byNewest) as unknown as Row[];
    (cols as Record<CollectionKey, unknown>)[key] = merged;
    writeCollection(ENTITIES[key].storageKey, merged, ENTITIES[key].event);
  }
  writeJson(REMOTE_KNOWN_KEY, { ...knownBefore, ...remoteIds });
  // Entities the viewer may not read are not shown from old local data.
  for (const key of UPLOADABLE) if (!remoteIds[key]) (cols as Record<CollectionKey, unknown>)[key] = [];
  if (!remoteIds.activity) cols.activity = [];
  store.set((st) => ({
    cols,
    remoteIds,
    syncState: {
      busy: false,
      lastSyncedAt: res.fetchedAt,
      error: st.unsynced.length > 0,
      message: st.unsynced.length ? unsyncedMessage(st.unsynced.length) : undefined,
    },
  }));
  return true;
}

async function pullWorkLogs(store: Store) {
  store.set((s) => ({ syncState: { ...s.syncState, busy: true, message: "Loading from Google Sheets" } }));
  const res = await GoogleSheetsService.fetchFromGoogleSheet();
  if (res.success && res.data) {
    const remoteLogIds = new Set(res.data.map((l) => l.id));
    const stillPending = store.get().pendingLogs.filter((p) => !remoteLogIds.has(p.id));
    if (stillPending.length !== store.get().pendingLogs.length) setPendingLogs(store, stillPending);
    setCollection(store, "workLogs", [...stillPending, ...res.data], false);
    store.set((s) => ({
      workLogsLoaded: true,
      syncState: {
        ...s.syncState,
        busy: false,
        error: s.unsynced.length > 0 || s.pendingLogs.length > 0,
        message: s.unsynced.length ? unsyncedMessage(s.unsynced.length) : s.pendingLogs.length ? `${s.pendingLogs.length} work log${s.pendingLogs.length === 1 ? "" : "s"} not saved to Google Sheets` : undefined,
        lastSyncedAt: nowISO(),
      },
    }));
  } else {
    store.set((s) => ({ syncState: { ...s.syncState, busy: false, message: res.message, error: true } }));
    const pend = store.get().pendingLogs;
    if (pend.length) setCollection(store, "workLogs", [...pend, ...store.get().cols.workLogs.filter((l) => !pend.some((p) => p.id === l.id))], false);
  }
  return res;
}

/** Pre-shared rows that are not on the sheet yet, are not demo data and that the viewer may write. */
function computeEligible(
  preshared: PresharedSnapshot | null,
  remoteIds: HubState["remoteIds"],
  pv: PolicyViewer
): { rows: Partial<Record<RecordEntity, Row[]>>; excludedDemo: number } {
  const out: Partial<Record<RecordEntity, Row[]>> = {};
  if (!preshared || preshared.dismissed || !remoteIds) return { rows: out, excludedDemo: 0 };
  let excludedDemo = preshared.demoCount || 0;
  for (const key of UPLOADABLE) {
    const remote = new Set(remoteIds[key] ?? []);
    for (const r of preshared.rows[key] ?? []) {
      const id = String(r.id ?? "");
      if (!id || remote.has(id)) continue;
      if (isDemoRow(r)) {
        excludedDemo++;
        continue;
      }
      if (!canCreate(pv, key) || !canUpdate(pv, key, r)) continue;
      (out[key] ??= []).push(stripDemo(r));
    }
  }
  return { rows: out, excludedDemo };
}

// ---------------------------------------------------------------- activity copy

const NOUN: Record<RecordEntity, string> = {
  deals: "deal",
  interactions: "visit",
  clients: "client",
  projects: "project",
  payments: "invoice",
  roster: "roster",
  repositories: "repository",
  posts: "post",
  campaigns: "campaign",
  drafts: "draft",
};
const LABEL: Record<RecordEntity, string> = {
  deals: "deal",
  interactions: "visit with",
  clients: "client",
  projects: "project",
  payments: "invoice",
  roster: "team member",
  repositories: "repository",
  posts: "post",
  campaigns: "campaign",
  drafts: "draft",
};

function recordName(entity: RecordEntity, r: Row): string {
  const pick = (...keys: string[]) => keys.map((k) => r[k]).find((v) => typeof v === "string" && v.trim()) as string | undefined;
  switch (entity) {
    case "deals":
    case "interactions":
    case "clients":
      return pick("companyName") ?? "";
    case "projects":
      return pick("projectName", "projectId") ?? "";
    case "payments":
      return pick("invoiceId", "companyName") ?? "";
    case "roster":
      return pick("developerName") ?? "";
    case "repositories":
      return pick("repository") ?? "";
    case "posts":
    case "drafts":
      return pick("title") ?? "";
    case "campaigns":
      return pick("name") ?? "";
  }
}

function describe(entity: RecordEntity, verb: "created" | "updated" | "deleted", r: Row, prev?: Row) {
  const name = recordName(entity, r);
  if (entity === "deals" && verb === "updated" && prev && prev.leadStatus !== r.leadStatus && typeof r.leadStatus === "string") {
    return { action: "deal.stage_changed", summary: `Moved ${name || "deal"} to ${r.leadStatus}` };
  }
  const word = verb === "created" ? "Added" : verb === "updated" ? "Updated" : "Deleted";
  return { action: `${NOUN[entity]}.${verb}`, summary: `${word} ${LABEL[entity]}${name ? ` ${name}` : ""}` };
}

// ---------------------------------------------------------------- actions

interface Actor {
  accountId: string;
  name: string;
  category: ViewerCategory;
}

function createActions(store: Store, isAdmin: boolean, actor: Actor) {
  const pv: PolicyViewer = { accountId: actor.accountId, name: actor.name, category: actor.category };

  const markSaved = (entity: EntityKey, id: string) => store.set({ lastSaved: { entity, id, at: Date.now() } });

  function appendLocalActivity(ev: ActivityEvent) {
    const next = [ev, ...store.get().cols.activity].sort(byNewest).slice(0, ACTIVITY_CAP);
    setCollection(store, "activity", next);
  }

  function logActivity(e: Omit<ActivityEvent, "id" | "at" | "actorId" | "actorName">) {
    const ev: ActivityEvent = { ...e, id: newId(ENTITIES.activity.idPrefix), at: nowISO(), actorId: actor.accountId, actorName: actor.name };
    appendLocalActivity(ev);
    if (store.get().sharedMode) void remoteAppendActivity(ev);
  }

  /** Activity for a local-mode write (the server writes it in shared mode). */
  function autoLog(entity: RecordEntity, verb: "created" | "updated" | "deleted", r: Row, prev?: Row) {
    const { action, summary } = describe(entity, verb, r, prev);
    const ev: ActivityEvent = { id: newId(ENTITIES.activity.idPrefix), at: nowISO(), actorId: actor.accountId, actorName: actor.name, action, entity, entityId: String(r.id), summary };
    appendLocalActivity(ev);
  }

  function replaceRow<K extends RecordEntity>(key: K, row: RowOf<K>, prepend: boolean): boolean {
    const rows = store.get().cols[key] as unknown as RowOf<K>[];
    const id = (row as unknown as Row).id;
    const idx = rows.findIndex((r) => (r as unknown as Row).id === id);
    const next = idx === -1 ? (prepend ? [row, ...rows] : [...rows, row]) : rows.map((r, i) => (i === idx ? row : r));
    return setCollection(store, key, next as Collections[K]);
  }

  async function saveRecord<K extends RecordEntity>(key: K, partial: Partial<RowOf<K>>, editingId?: string): Promise<SaveResult<RowOf<K>>> {
    const s = store.get();
    const today = todayKeyIST();
    const now = nowISO();
    const rows = s.cols[key] as unknown as RowOf<K>[];
    const existing = editingId ? (rows.find((r) => (r as unknown as Row).id === editingId) as unknown as Row | undefined) : undefined;
    let record: Row;
    if (existing) {
      record = { ...existing, ...(partial as Row), id: existing.id, updatedAt: now };
    } else {
      record = stripDemo({ ...(partial as Row) });
      record.id = editingId || (typeof record.id === "string" && record.id) || newId(ENTITIES[key].idPrefix);
      record.createdAt = now;
      record.updatedAt = now;
      record.createdBy = record.createdBy ?? actor.accountId;
      if (key === "deals" && !record.dateAdded) record.dateAdded = today;
      if (key === "interactions" && !record.date) record.date = today;
      if (key === "payments" && !record.issueDate) record.issueDate = today;
    }

    if (s.modeUnavailable) return { ok: false, record: record as unknown as RowOf<K>, error: UNAVAILABLE };

    if (!s.sharedMode) {
      const specs = sequencesFor(key, record, today);
      if (specs.length) record = applySequences(record, rows, specs);
      const wrote = replaceRow(key, record as unknown as RowOf<K>, true);
      markSaved(key, String(record.id));
      if (!wrote) return { ok: false, record: record as unknown as RowOf<K>, error: STORAGE_FULL };
      autoLog(key, existing ? "updated" : "created", record, existing);
      return { ok: true, record: record as unknown as RowOf<K> };
    }

    // Shared mode: optimistic local row, then the server row (with any sequence numbers) is adopted.
    replaceRow(key, record as unknown as RowOf<K>, true);
    store.set((st) => ({ syncState: { ...st.syncState, busy: true } }));
    const res = await remoteUpsert<Row>(key, stripDemo(record));
    if (res.ok) {
      const saved = { ...res.row } as Row;
      if (record.demo === true) saved.demo = true;
      replaceRow(key, saved as unknown as RowOf<K>, true);
      clearUnsynced(store, key, String(saved.id));
      markSaved(key, String(saved.id));
      const { action, summary } = describe(key, existing ? "updated" : "created", saved, existing);
      // Display copy only; the server already wrote the shared Activity row.
      store.set((st) => ({
        cols: { ...st.cols, activity: [{ id: newId("act_local"), at: nowISO(), actorId: actor.accountId, actorName: actor.name, action, entity: key, entityId: String(saved.id), summary }, ...st.cols.activity].slice(0, ACTIVITY_CAP) },
        syncState: { ...st.syncState, busy: false },
      }));
      return { ok: true, record: saved as unknown as RowOf<K> };
    }
    addUnsynced(store, { entity: key, id: String(record.id), op: "upsert", error: res.error, at: now });
    markSaved(key, String(record.id));
    return { ok: false, record: record as unknown as RowOf<K>, error: res.error };
  }

  async function deleteRecord<K extends RecordEntity>(key: K, id: string): Promise<DeleteResult> {
    const s = store.get();
    if (s.modeUnavailable) return { ok: false, error: UNAVAILABLE };
    const rows = s.cols[key] as unknown as RowOf<K>[];
    const idx = rows.findIndex((r) => (r as unknown as Row).id === id);
    if (idx === -1) return { ok: true };
    const row = rows[idx] as unknown as Row;
    const wrote = setCollection(store, key, rows.filter((_, i) => i !== idx) as Collections[K]);
    if (!s.sharedMode) {
      if (!wrote) {
        setCollection(store, key, rows as Collections[K], false);
        return { ok: false, error: STORAGE_FULL };
      }
      autoLog(key, "deleted", row);
      return { ok: true };
    }
    const res = await remoteDelete(key, id);
    if (res.ok || res.status === 404) {
      clearUnsynced(store, key, id);
      return { ok: true };
    }
    const cur = store.get().cols[key] as unknown as RowOf<K>[];
    if (!cur.some((r) => (r as unknown as Row).id === id)) {
      const restored = [...cur];
      restored.splice(Math.min(idx, restored.length), 0, row as unknown as RowOf<K>);
      setCollection(store, key, restored as Collections[K]);
    }
    return { ok: false, error: res.error };
  }

  // ---- work logs (v1 flow, unchanged)

  async function pushAll(rows?: DailyWorkLogEntry[]): Promise<{ success: boolean; message: string }> {
    // SYNC_ALL replaces every data row of the sheet, so never send rows that were not loaded from it.
    if (store.get().modeUnavailable) return { success: false, message: UNAVAILABLE };
    if (!store.get().workLogsLoaded) return { success: false, message: "Work logs are still loading from Google Sheets. Try again in a moment." };
    const list = rows ?? store.get().cols.workLogs;
    store.set((s) => ({ syncState: { ...s.syncState, busy: true, message: "Writing to Google Sheets" } }));
    const res = await GoogleSheetsService.syncAllToGoogleSheet(list);
    store.set((s) => ({ syncState: { ...s.syncState, busy: false, message: res.message, error: !res.success, lastSyncedAt: res.success ? nowISO() : s.syncState.lastSyncedAt } }));
    if (res.success) {
      const ids = new Set(list.map((l) => l.id));
      const pend = store.get().pendingLogs;
      if (pend.some((p) => ids.has(p.id))) setPendingLogs(store, pend.filter((p) => !ids.has(p.id)));
    }
    return res;
  }

  function logWork(verb: "created" | "updated" | "deleted", entry: Partial<DailyWorkLogEntry>) {
    const word = verb === "created" ? "Logged work" : verb === "updated" ? "Updated work log" : "Deleted work log";
    const what = entry.taskDescription || entry.project || "";
    logActivity({ action: `worklog.${verb}`, entity: "workLogs", entityId: String(entry.id ?? ""), summary: what ? `${word}: ${what}` : word });
  }

  async function saveWorkLog(data: Partial<DailyWorkLogEntry>, editingId?: string): Promise<SaveResult<DailyWorkLogEntry>> {
    const s = store.get();
    const fail = (error: string): SaveResult<DailyWorkLogEntry> => ({ ok: false, record: data as DailyWorkLogEntry, error });
    if (s.modeUnavailable) return fail(UNAVAILABLE);
    if (s.source === "local") {
      const logs = readCollection<DailyWorkLogEntry>(ENTITIES.workLogs.storageKey);
      const at = nowISO();
      let saved: DailyWorkLogEntry;
      if (editingId) {
        const idx = logs.findIndex((l) => l.id === editingId);
        if (idx === -1) return fail("That entry no longer exists.");
        saved = { ...logs[idx], ...data, id: editingId, lastUpdated: legacyStamp(), updatedAt: at };
        logs[idx] = saved;
      } else {
        saved = { ...(data as DailyWorkLogEntry), date: data.date || todayKeyIST(), createdBy: actor.accountId, id: newId(ENTITIES.workLogs.idPrefix), lastUpdated: legacyStamp(), createdAt: data.createdAt ?? at, updatedAt: at };
        logs.unshift(saved);
      }
      const wrote = writeCollection(ENTITIES.workLogs.storageKey, logs, ENTITIES.workLogs.event);
      setCollection(store, "workLogs", logs, false);
      markSaved("workLogs", saved.id);
      if (!wrote) return { ok: false, record: saved, error: STORAGE_FULL };
      logWork(editingId ? "updated" : "created", saved);
      return { ok: true, record: saved };
    }
    if (editingId) {
      if (!isAdmin) return fail("Only an administrator can edit entries in Google Sheets.");
      if (!s.workLogsLoaded) return fail("Work logs are still loading from Google Sheets. Try again in a moment.");
      const prev = s.cols.workLogs;
      const next = prev.map((l) => (l.id === editingId ? { ...l, ...data, id: l.id, lastUpdated: legacyStamp() } : l));
      const updated = next.find((l) => l.id === editingId);
      if (!updated) return fail("That entry no longer exists.");
      setCollection(store, "workLogs", next, false);
      const res = await pushAll(next);
      if (!res.success) {
        setCollection(store, "workLogs", prev, false);
        return fail(res.message);
      }
      markSaved("workLogs", editingId);
      return { ok: true, record: updated };
    }
    const entry = { ...(data as DailyWorkLogEntry), date: data.date || todayKeyIST(), id: newId(ENTITIES.workLogs.idPrefix), lastUpdated: legacyStamp() };
    setCollection(store, "workLogs", [entry, ...store.get().cols.workLogs], false);
    markSaved("workLogs", entry.id);
    store.set((st) => ({ syncState: { ...st.syncState, busy: true, message: "Saving to Google Sheets" } }));
    const res = await GoogleSheetsService.appendLogToGoogleSheet(entry);
    store.set((st) => ({
      syncState: { ...st.syncState, busy: false, message: res.success ? "Saved to Google Sheets" : res.message, error: !res.success, lastSyncedAt: res.success ? nowISO() : st.syncState.lastSyncedAt },
    }));
    if (res.success) {
      logWork("created", entry);
      return { ok: true, record: entry };
    }
    // Keep the entry on this device and retry it from Retry sync.
    setPendingLogs(store, [entry, ...store.get().pendingLogs.filter((p) => p.id !== entry.id)]);
    return { ok: false, record: entry, error: res.message };
  }

  async function deleteWorkLog(id: string): Promise<DeleteResult> {
    const s = store.get();
    if (s.modeUnavailable) return { ok: false, error: UNAVAILABLE };
    const entry = s.cols.workLogs.find((l) => l.id === id);
    if (s.source === "local") {
      const logs = readCollection<DailyWorkLogEntry>(ENTITIES.workLogs.storageKey).filter((l) => l.id !== id);
      const wrote = writeCollection(ENTITIES.workLogs.storageKey, logs, ENTITIES.workLogs.event);
      if (!wrote) return { ok: false, error: STORAGE_FULL };
      setCollection(store, "workLogs", logs, false);
      if (entry) logWork("deleted", entry);
      return { ok: true };
    }
    if (!isAdmin) return { ok: false, error: "Only an administrator can delete entries in Google Sheets." };
    if (!s.workLogsLoaded) return { ok: false, error: "Work logs are still loading from Google Sheets. Try again in a moment." };
    const prev = s.cols.workLogs;
    const next = prev.filter((l) => l.id !== id);
    setCollection(store, "workLogs", next, false);
    const res = await pushAll(next);
    if (!res.success) {
      setCollection(store, "workLogs", prev, false);
      return { ok: false, error: res.message };
    }
    if (entry) logWork("deleted", entry);
    return { ok: true };
  }

  // ---- sync

  async function pullFromSheet() {
    if (store.get().modeUnavailable) {
      await bootstrapRemote(store, () => false);
      return { workLogs: undefined, shared: store.get().sharedMode };
    }
    const s = store.get();
    const out: { workLogs?: unknown; shared?: boolean } = {};
    if (s.source === "sheet") out.workLogs = await pullWorkLogs(store);
    if (s.sharedMode) out.shared = await refreshShared(store);
    return out;
  }

  async function retrySync(id?: string) {
    if (store.get().modeUnavailable) await bootstrapRemote(store, () => false);
    const ops = store.get().unsynced.filter((o) => !id || o.id === id);
    const pend = store.get().pendingLogs.filter((p) => !id || p.id === id);
    if (!ops.length && !pend.length) return;
    store.set((s) => ({ syncState: { ...s.syncState, busy: true } }));
    for (const p of pend) {
      const res = await GoogleSheetsService.appendLogToGoogleSheet(p);
      if (res.success) setPendingLogs(store, store.get().pendingLogs.filter((x) => x.id !== p.id));
    }
    for (const op of ops) {
      if (op.op === "delete") {
        const res = await remoteDelete(op.entity, op.id);
        if (res.ok || res.status === 404) clearUnsynced(store, op.entity, op.id);
        else addUnsynced(store, { ...op, error: res.error, at: nowISO() });
        continue;
      }
      if (op.entity === "settings") {
        const res = await remoteUpsert<Row>("settings", store.get().settings);
        if (res.ok) {
          const settings = normalizeSettings(res.row);
          writeSettings(settings);
          store.set({ settings });
          clearUnsynced(store, "settings", op.id);
        } else addUnsynced(store, { ...op, error: res.error, at: nowISO() });
        continue;
      }
      if (op.entity === "activity") {
        clearUnsynced(store, op.entity, op.id);
        continue;
      }
      const key = op.entity as RecordEntity;
      const row = (store.get().cols[key] as unknown as Row[]).find((r) => r.id === op.id);
      if (!row) {
        clearUnsynced(store, op.entity, op.id);
        continue;
      }
      const res = await remoteUpsert<Row>(op.entity, stripDemo(row));
      if (res.ok) {
        replaceRow(key, res.row as unknown as RowOf<typeof key>, true);
        clearUnsynced(store, op.entity, op.id);
        markSaved(key, op.id);
      } else addUnsynced(store, { ...op, error: res.error, at: nowISO() });
    }
    store.set((s) => ({ syncState: { ...s.syncState, busy: false } }));
  }

  async function pushLocalToShared() {
    const s = store.get();
    if (!s.sharedMode) return { pushed: 0, skipped: 0, failed: 0, skippedDemo: 0 };
    const { rows, excludedDemo } = computeEligible(s.preshared, s.remoteIds, pv);
    let pushed = 0;
    let skipped = 0;
    let failed = 0;
    store.set((s) => ({ syncState: { ...s.syncState, busy: true, message: "Uploading records to Google Sheets" } }));
    for (const key of UPLOADABLE) {
      const list = rows[key] ?? [];
      for (let i = 0; i < list.length; i += BATCH) {
        const batch = list.slice(i, i + BATCH);
        const res = await remoteBulkUpsert(key, batch);
        if (res.ok) {
          pushed += res.upserted;
          skipped += res.skipped;
        } else failed += batch.length;
      }
    }
    await refreshShared(store);
    return { pushed, skipped, failed, skippedDemo: excludedDemo };
  }

  function dismissLocalOnly() {
    const cur = store.get().preshared ?? { takenAt: nowISO(), rows: {}, demoCount: 0 };
    const next = { ...cur, dismissed: true };
    writeJson(STORAGE_KEYS.PRESHARED, next);
    store.set({ preshared: next });
  }

  // ---- roster

  function setRoster(rows: DeveloperRosterMember[]) {
    if (store.get().modeUnavailable) return;
    if (!setCollection(store, "roster", rows)) {
      store.set((s) => ({ syncState: { ...s.syncState, error: true, message: STORAGE_FULL } }));
    }
    if (!store.get().sharedMode) return;
    void (async () => {
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const res = await remoteBulkUpsert("roster", batch.map(stripDemo));
        if (!res.ok) for (const r of batch) addUnsynced(store, { entity: "roster", id: r.id, op: "upsert", error: res.error, at: nowISO() });
      }
    })();
  }

  // ---- settings

  async function saveSettings(patch: Partial<HubSettings>): Promise<SaveResult<HubSettings>> {
    const cur = store.get().settings;
    const next = normalizeSettings({
      ...cur,
      ...patch,
      company: patch.company ? { ...cur.company, ...patch.company } : cur.company,
      id: "settings",
      updatedAt: nowISO(),
      updatedBy: actor.name,
    });
    writeSettings(next);
    store.set({ settings: next });
    markSaved("settings", "settings");
    if (!store.get().sharedMode) {
      logActivity({ action: "settings.updated", entity: "settings", entityId: "settings", summary: "Updated settings" });
      return { ok: true, record: next };
    }
    const res = await remoteUpsert<Row>("settings", next);
    if (res.ok) {
      const saved = normalizeSettings(res.row);
      writeSettings(saved);
      store.set({ settings: saved });
      clearUnsynced(store, "settings", "settings");
      return { ok: true, record: saved };
    }
    addUnsynced(store, { entity: "settings", id: "settings", op: "upsert", error: res.error, at: nowISO() });
    return { ok: false, record: next, error: res.error };
  }

  // ---- backup and reset

  function exportBackup(): HubBackup {
    const s = store.get();
    const data: Partial<Record<EntityKey, unknown[]>> = {};
    for (const key of COLLECTION_KEYS) data[key] = s.cols[key];
    return { format: "axoraa-hub-backup", version: 2, exportedAt: nowISO(), exportedBy: actor.name, data, settings: s.settings };
  }

  async function importBackup(b: HubBackup, mode: "replace" | "merge"): Promise<{ imported: number }> {
    if (!b || b.format !== "axoraa-hub-backup" || b.version !== 2 || !b.data || typeof b.data !== "object") {
      throw new Error("This file is not an Axoraa Hub backup.");
    }
    const s = store.get();
    if (mode === "replace" && s.sharedMode) throw new Error("Replace is not available while records are shared through Google Sheets. Use merge.");
    let imported = 0;
    const rowsOf = (key: EntityKey): Row[] => {
      const v = b.data[key];
      return Array.isArray(v) ? (v.filter((r) => r && typeof r === "object" && typeof (r as unknown as Row).id === "string") as Row[]) : [];
    };

    if (s.sharedMode) {
      for (const key of UPLOADABLE) {
        const list = rowsOf(key).filter((r) => !isDemoRow(r)).map(stripDemo);
        for (let i = 0; i < list.length; i += BATCH) {
          const res = await remoteBulkUpsert(key, list.slice(i, i + BATCH));
          if (res.ok) imported += res.upserted;
        }
      }
      if (s.source === "local") imported += mergeLocal("workLogs", rowsOf("workLogs"));
      await refreshShared(store);
      return { imported };
    }

    for (const key of COLLECTION_KEYS) {
      if (key === "workLogs" && s.source === "sheet") continue; // sheet work logs are not replaced from a file
      if (!Object.prototype.hasOwnProperty.call(b.data, key)) continue;
      const list = rowsOf(key);
      if (mode === "replace") {
        writeCollection(ENTITIES[key].storageKey, list, ENTITIES[key].event);
        imported += list.length;
      } else imported += mergeLocal(key, list);
    }
    if (mode === "replace" && b.settings) writeSettings(normalizeSettings(b.settings));
    writeRaw(STORAGE_KEYS.SEEDED, "1");
    loadLocal(store);
    return { imported };
  }

  function mergeLocal(key: CollectionKey, list: Row[]): number {
    if (!list.length) return 0;
    const cur = readCollection<Row>(ENTITIES[key].storageKey);
    const byId = new Map(cur.map((r) => [String(r.id), r]));
    for (const r of list) byId.set(String(r.id), { ...(byId.get(String(r.id)) ?? {}), ...r });
    writeCollection(ENTITIES[key].storageKey, [...byId.values()], ENTITIES[key].event);
    return list.length;
  }

  function resetLocalData(mode: "empty" | "demo") {
    const s = store.get();
    if (s.sharedMode) throw new Error("Reset is not available while records are shared through Google Sheets.");
    if (mode === "demo") writeDemoData();
    else {
      for (const key of COLLECTION_KEYS) {
        if (key === "workLogs" && s.source === "sheet") continue;
        writeCollection(ENTITIES[key].storageKey, [], ENTITIES[key].event);
      }
    }
    writeRaw(STORAGE_KEYS.SEEDED, "1");
    writeJson(STORAGE_KEYS.UNSYNCED, []);
    loadLocal(store);
  }

  return {
    retrySync,
    pullFromSheet,
    pushAll: () => pushAll(),
    pushLocalToShared,
    dismissLocalOnly,
    saveWorkLog,
    deleteWorkLog,
    updateWorkLogStatus: (id: string, patch: Partial<DailyWorkLogEntry>) => saveWorkLog(patch, id),
    setRoster,
    saveRosterMember: (m: Partial<DeveloperRosterMember>, editingId?: string) => saveRecord("roster", m, editingId),
    deleteRosterMember: (id: string) => deleteRecord("roster", id),
    saveRepository: (r: Partial<RepositoryMapping>, editingId?: string) => saveRecord("repositories", r, editingId),
    deleteRepository: (id: string) => deleteRecord("repositories", id),
    saveDeal: (d: Partial<MarketingDeal>, editingId?: string) => saveRecord("deals", d, editingId),
    deleteDeal: (id: string) => deleteRecord("deals", id),
    saveInteraction: (i: Partial<MarketingInteraction>, editingId?: string) => saveRecord("interactions", i, editingId),
    deleteInteraction: (id: string) => deleteRecord("interactions", id),
    saveClient: (c: Partial<ClientMasterRecord>, editingId?: string) => saveRecord("clients", c, editingId),
    deleteClient: (id: string) => deleteRecord("clients", id),
    saveProject: (p: Partial<ProjectProgressRecord>, editingId?: string) => saveRecord("projects", p, editingId),
    deleteProject: (id: string) => deleteRecord("projects", id),
    savePayment: (p: Partial<PaymentBillingRecord>, editingId?: string) => saveRecord("payments", p, editingId),
    deletePayment: (id: string) => deleteRecord("payments", id),
    savePost: (p: Partial<ContentPost>, editingId?: string) => saveRecord("posts", p, editingId),
    deletePost: (id: string) => deleteRecord("posts", id),
    saveCampaign: (c: Partial<Campaign>, editingId?: string) => saveRecord("campaigns", c, editingId),
    deleteCampaign: (id: string) => deleteRecord("campaigns", id),
    saveDraft: (d: Partial<AgentDraft>, editingId?: string) => saveRecord("drafts", d, editingId),
    deleteDraft: (id: string) => deleteRecord("drafts", id),
    logActivity,
    saveSettings,
    exportBackup,
    importBackup,
    resetLocalData,
  };
}

// ---------------------------------------------------------------- mount

function eventEntity(name: string): CollectionKey | "settings" | null {
  for (const key of [...COLLECTION_KEYS, "settings" as const]) if (ENTITIES[key].event === name) return key;
  return null;
}

async function bootstrapRemote(store: Store, isCancelled: () => boolean) {
  const [sheets, remote] = await Promise.all([GoogleSheetsService.status(), remoteStatus()]);
  if (isCancelled()) return;
  const version = remote.version ?? sheets.version ?? null;
  const sharedMode = remote.configured && version === 2;
  // Configured but the script did not answer (cold start or timeout): not the same as "not configured".
  const modeUnavailable = (remote.configured || sheets.configured) && version === null;
  store.set({ remoteVersion: version, sharedMode, modeUnavailable, source: sheets.configured ? "sheet" : "local" });

  const unavailableMessage = () =>
    store.set((s) => ({ syncState: { ...s.syncState, busy: false, error: true, message: "Couldn't reach Google Sheets, so changes can't be saved yet. Use Retry sync." } }));

  // 4. seed or load shared records
  if (modeUnavailable) {
    unavailableMessage(); // no demo seeding and no local-only writes while the mode is unknown
  } else if (!sharedMode) {
    if (seedDemoIfFirstRun()) loadLocal(store);
  } else {
    markSeeded();
    takePresharedSnapshot(store);
    await refreshShared(store);
  }
  if (isCancelled()) return;
  if (sheets.configured) await pullWorkLogs(store);
  if (modeUnavailable && !isCancelled()) unavailableMessage();
}

async function mount(store: Store, isCancelled: () => boolean) {
  // 1. migrate, 2. local data and ready
  runMigrations();
  store.set({ dayKey: todayKeyIST() });
  loadLocal(store);
  store.set({ ready: true });

  // 3. status calls, then seed or load
  await bootstrapRemote(store, isCancelled);
}

// ---------------------------------------------------------------- hook

export function useHubData(opts: {
  isAdmin: boolean;
  actor: { accountId: string; name: string; category: ViewerCategory };
}): HubData {
  const { isAdmin } = opts;
  const { accountId, name, category } = opts.actor;
  const [store] = useState(createStore);
  const state = useSyncExternalStore(store.subscribe, store.get, store.getServer);

  const actions = useMemo(() => createActions(store, isAdmin, { accountId, name, category }), [store, isAdmin, accountId, name, category]);

  useEffect(() => {
    let cancelled = false;
    void mount(store, () => cancelled);

    const onEvent = (e: Event) => {
      const key = eventEntity(e.type);
      if (!key) return;
      if (key === "settings") store.set({ settings: readSettings() });
      else reloadEntity(store, key);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === null) {
        loadLocal(store);
        return;
      }
      if (e.key === STORAGE_KEYS.UNSYNCED) {
        store.set({ unsynced: readUnsynced() });
        return;
      }
      if (e.key === STORAGE_KEYS.PRESHARED) {
        store.set({ preshared: readPreshared() });
        return;
      }
      if (e.key === STORAGE_KEYS.SETTINGS) {
        store.set({ settings: readSettings() });
        return;
      }
      const key = COLLECTION_KEYS.find((k) => ENTITIES[k].storageKey === e.key);
      if (key) reloadEntity(store, key);
    };
    const events = [...new Set([...COLLECTION_KEYS, "settings" as const].map((k) => ENTITIES[k].event))];
    events.forEach((ev) => window.addEventListener(ev, onEvent));
    window.addEventListener("storage", onStorage);
    const tick = window.setInterval(() => {
      const day = todayKeyIST();
      if (store.get().dayKey !== day) store.set({ dayKey: day });
    }, 60_000);
    return () => {
      cancelled = true;
      events.forEach((ev) => window.removeEventListener(ev, onEvent));
      window.removeEventListener("storage", onStorage);
      window.clearInterval(tick);
    };
  }, [store]);

  const { cols, settings, dayKey, preshared, remoteIds } = state;

  const deals = useMemo(
    () => cols.deals.map((d) => enrichDeal(d, cols.interactions, settings.stageProbabilities, dayKey)),
    [cols.deals, cols.interactions, settings.stageProbabilities, dayKey]
  );
  const payments = useMemo(() => cols.payments.map((p) => computeInvoice(p, dayKey)), [cols.payments, dayKey]);
  const founderMatrix = useMemo(() => deriveFounderMatrix(cols.clients, cols.projects, payments), [cols.clients, cols.projects, payments]);
  const hasDemoData = useMemo(() => COLLECTION_KEYS.some((k) => (cols[k] as object[]).some((r) => (r as unknown as Row).demo === true)), [cols]);

  const sharedMode = state.sharedMode;
  const localOnly = useMemo<LocalOnlySummary>(() => {
    if (!sharedMode) return { total: 0, byEntity: {}, excludedDemo: 0 };
    const { rows, excludedDemo } = computeEligible(preshared, remoteIds, { accountId, name, category });
    const byEntity: Partial<Record<RemoteEntity, number>> = {};
    let total = 0;
    for (const [k, list] of Object.entries(rows) as [RecordEntity, Row[]][]) {
      byEntity[k] = list.length;
      total += list.length;
    }
    return { total, byEntity, excludedDemo };
  }, [sharedMode, preshared, remoteIds, accountId, name, category]);

  return {
    ready: state.ready,
    source: state.source,
    sharedMode: state.sharedMode,
    remoteVersion: state.remoteVersion,
    syncState: state.syncState,
    hasDemoData,
    unsynced: state.unsynced,
    lastSaved: state.lastSaved,
    retrySync: actions.retrySync,
    pullFromSheet: actions.pullFromSheet,
    pushAll: actions.pushAll,
    localOnly,
    pushLocalToShared: actions.pushLocalToShared,
    dismissLocalOnly: actions.dismissLocalOnly,
    workLogs: cols.workLogs,
    saveWorkLog: actions.saveWorkLog,
    deleteWorkLog: actions.deleteWorkLog,
    updateWorkLogStatus: actions.updateWorkLogStatus,
    roster: cols.roster,
    setRoster: actions.setRoster,
    saveRosterMember: actions.saveRosterMember,
    deleteRosterMember: actions.deleteRosterMember,
    repositories: cols.repositories,
    saveRepository: actions.saveRepository,
    deleteRepository: actions.deleteRepository,
    deals,
    saveDeal: actions.saveDeal,
    deleteDeal: actions.deleteDeal,
    interactions: cols.interactions,
    saveInteraction: actions.saveInteraction,
    deleteInteraction: actions.deleteInteraction,
    clients: cols.clients,
    saveClient: actions.saveClient,
    deleteClient: actions.deleteClient,
    projects: cols.projects,
    saveProject: actions.saveProject,
    deleteProject: actions.deleteProject,
    payments,
    savePayment: actions.savePayment,
    deletePayment: actions.deletePayment,
    posts: cols.posts,
    savePost: actions.savePost,
    deletePost: actions.deletePost,
    campaigns: cols.campaigns,
    saveCampaign: actions.saveCampaign,
    deleteCampaign: actions.deleteCampaign,
    drafts: cols.drafts,
    saveDraft: actions.saveDraft,
    deleteDraft: actions.deleteDraft,
    founderMatrix,
    activity: cols.activity,
    logActivity: actions.logActivity,
    settings,
    saveSettings: actions.saveSettings,
    exportBackup: actions.exportBackup,
    importBackup: actions.importBackup,
    resetLocalData: actions.resetLocalData,
  };
}
