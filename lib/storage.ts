// Browser storage for every collection. Keys are unchanged from v1, so existing data loads as-is.
// Getters never seed demo data: that happens once, in lib/data/migrations.ts seedDemoIfFirstRun().
// Every read and write is wrapped in try/catch (private mode, quota, malformed JSON).
import type {
  ClientMasterRecord,
  DailyWorkLogEntry,
  DeveloperRosterMember,
  FounderMatrixStats,
  GoogleSheetsConfig,
  MarketingDeal,
  MarketingInteraction,
  PaymentBillingRecord,
  ProjectProgressRecord,
  RepositoryMapping,
} from "./types";
import { ENTITIES } from "./data/entities";
import { normalizeSettings, type HubSettings } from "./settings";
import { newId, todayKeyIST } from "./format";
import { computeInvoice, deriveFounderMatrix } from "./analytics";

export const STORAGE_KEYS = {
  WORK_LOGS: "axoraa_work_logs_v1",
  ROSTER: "axoraa_dev_roster_v1",
  REPOSITORIES: "axoraa_repos_v1",
  GOOGLE_CONFIG: "axoraa_sheets_config_v1",
  MARKETING_DEALS: "axoraa_marketing_deals_v1",
  MARKETING_INTERACTIONS: "axoraa_marketing_interactions_v1",
  CLIENTS: "axoraa_client_master_v1",
  PROJECT_PROGRESS: "axoraa_project_progress_v1",
  PAYMENTS: "axoraa_payments_v1",
  FOUNDER_MATRIX: "axoraa_founder_matrix_v1", // no longer read; the matrix is derived
  ACTIVE_USER_ID: "axoraa_active_user_id_v1",
  ACTIVE_WORKSPACE: "axoraa_active_workspace_v1",
  CONTENT_POSTS: "axoraa_content_posts_v1",
  CAMPAIGNS: "axoraa_campaigns_v1",
  AGENT_DRAFTS: "axoraa_agent_drafts_v1",
  ACTIVITY: "axoraa_activity_v1",
  SETTINGS: "axoraa_settings_v1",
  SCHEMA_VERSION: "axoraa_schema_version",
  SEEDED: "axoraa_seeded_v2",
  UNSYNCED: "axoraa_unsynced_v1",
  PRESHARED: "axoraa_preshared_v2",
} as const;

const hasWindow = () => typeof window !== "undefined";

/** Raw string from localStorage, or null when missing or unavailable. */
export function readRaw(key: string): string | null {
  if (!hasWindow()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Writes a raw string; returns false when storage is unavailable or full. */
export function writeRaw(key: string, value: string): boolean {
  if (!hasWindow()) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Parsed JSON value for a key, or the fallback. */
export function readJson<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown, eventName?: string): boolean {
  let ok = false;
  try {
    ok = writeRaw(key, JSON.stringify(value));
  } catch {
    ok = false;
  }
  if (ok && eventName) notify(eventName);
  return ok;
}

function notify(eventName: string) {
  if (!hasWindow()) return;
  try {
    window.dispatchEvent(new Event(eventName));
  } catch {
    // ignore
  }
}

/** Array stored under a key; [] when missing, malformed or not an array. */
export function readCollection<T>(key: string): T[] {
  const v = readJson<unknown>(key, []);
  return Array.isArray(v) ? (v.filter((r) => r && typeof r === "object") as T[]) : [];
}

/** Stores an array and dispatches the same-tab change event. Returns false when the write failed. */
export function writeCollection<T>(key: string, rows: T[], eventName: string): boolean {
  return writeJson(key, rows, eventName);
}

export function readSettings(): HubSettings {
  return normalizeSettings(readJson<unknown>(STORAGE_KEYS.SETTINGS, {}));
}

export function writeSettings(s: HubSettings): boolean {
  return writeJson(STORAGE_KEYS.SETTINGS, s, ENTITIES.settings.event);
}

const legacyStamp = () => new Date().toISOString().replace("T", " ").substring(0, 19);

export const StorageService = {
  readCollection,
  writeCollection,
  readSettings,
  writeSettings,

  // ==========================================
  // Track 1: Work Logs & Engineering
  // ==========================================
  getWorkLogs(): DailyWorkLogEntry[] {
    return readCollection<DailyWorkLogEntry>(STORAGE_KEYS.WORK_LOGS);
  },

  saveWorkLogs(logs: DailyWorkLogEntry[]): void {
    writeCollection(STORAGE_KEYS.WORK_LOGS, logs, ENTITIES.workLogs.event);
  },

  addWorkLog(entry: Omit<DailyWorkLogEntry, "id" | "lastUpdated">): DailyWorkLogEntry {
    const logs = this.getWorkLogs();
    const at = new Date().toISOString();
    const newEntry: DailyWorkLogEntry = {
      ...entry,
      id: newId(ENTITIES.workLogs.idPrefix),
      lastUpdated: legacyStamp(),
      createdAt: entry.createdAt ?? at,
      updatedAt: at,
    };
    logs.unshift(newEntry);
    this.saveWorkLogs(logs);
    return newEntry;
  },

  updateWorkLog(id: string, updates: Partial<DailyWorkLogEntry>): DailyWorkLogEntry | null {
    const logs = this.getWorkLogs();
    const index = logs.findIndex((l) => l.id === id);
    if (index === -1) return null;
    logs[index] = {
      ...logs[index],
      ...updates,
      id,
      lastUpdated: legacyStamp(),
      updatedAt: new Date().toISOString(),
    };
    this.saveWorkLogs(logs);
    return logs[index];
  },

  deleteWorkLog(id: string): boolean {
    const logs = this.getWorkLogs();
    const filtered = logs.filter((l) => l.id !== id);
    if (filtered.length !== logs.length) {
      this.saveWorkLogs(filtered);
      return true;
    }
    return false;
  },

  resolveBlocker(id: string): void {
    this.updateWorkLog(id, {
      isBlocked: "No",
      workStatus: "In Progress",
      blockerDetails: "Resolved on " + todayKeyIST(),
    });
  },

  // Developer Roster
  getRoster(): DeveloperRosterMember[] {
    return readCollection<DeveloperRosterMember>(STORAGE_KEYS.ROSTER);
  },

  saveRoster(roster: DeveloperRosterMember[]): void {
    writeCollection(STORAGE_KEYS.ROSTER, roster, ENTITIES.roster.event);
  },

  getRepositories(): RepositoryMapping[] {
    return readCollection<RepositoryMapping>(STORAGE_KEYS.REPOSITORIES);
  },

  saveRepositories(repos: RepositoryMapping[]): void {
    writeCollection(STORAGE_KEYS.REPOSITORIES, repos, ENTITIES.repositories.event);
  },

  // ==========================================
  // Track 2: Marketing CRM (Deals & Interactions)
  // ==========================================
  getMarketingDeals(): MarketingDeal[] {
    return readCollection<MarketingDeal>(STORAGE_KEYS.MARKETING_DEALS);
  },

  saveMarketingDeals(deals: MarketingDeal[]): void {
    writeCollection(STORAGE_KEYS.MARKETING_DEALS, deals, ENTITIES.deals.event);
  },

  addMarketingDeal(deal: Omit<MarketingDeal, "id">): MarketingDeal {
    const deals = this.getMarketingDeals();
    const at = new Date().toISOString();
    const newDeal: MarketingDeal = { ...deal, id: newId(ENTITIES.deals.idPrefix), createdAt: deal.createdAt ?? at, updatedAt: at };
    deals.unshift(newDeal);
    this.saveMarketingDeals(deals);
    return newDeal;
  },

  updateMarketingDeal(id: string, updates: Partial<MarketingDeal>): MarketingDeal | null {
    const deals = this.getMarketingDeals();
    const idx = deals.findIndex((d) => d.id === id);
    if (idx === -1) return null;
    deals[idx] = { ...deals[idx], ...updates, id, updatedAt: new Date().toISOString() };
    this.saveMarketingDeals(deals);
    return deals[idx];
  },

  getInteractions(): MarketingInteraction[] {
    return readCollection<MarketingInteraction>(STORAGE_KEYS.MARKETING_INTERACTIONS);
  },

  saveInteractions(interactions: MarketingInteraction[]): void {
    writeCollection(STORAGE_KEYS.MARKETING_INTERACTIONS, interactions, ENTITIES.interactions.event);
  },

  addInteraction(interaction: Omit<MarketingInteraction, "id">): MarketingInteraction {
    const list = this.getInteractions();
    const at = new Date().toISOString();
    const newInt: MarketingInteraction = { ...interaction, id: newId(ENTITIES.interactions.idPrefix), createdAt: interaction.createdAt ?? at, updatedAt: at };
    list.unshift(newInt);
    this.saveInteractions(list);
    return newInt;
  },

  // ==========================================
  // Track 3: Founders & Executive Command Center
  // ==========================================
  getClientMaster(): ClientMasterRecord[] {
    return readCollection<ClientMasterRecord>(STORAGE_KEYS.CLIENTS);
  },

  saveClientMaster(clients: ClientMasterRecord[]): void {
    writeCollection(STORAGE_KEYS.CLIENTS, clients, ENTITIES.clients.event);
  },

  getProjectProgress(): ProjectProgressRecord[] {
    return readCollection<ProjectProgressRecord>(STORAGE_KEYS.PROJECT_PROGRESS);
  },

  saveProjectProgress(projects: ProjectProgressRecord[]): void {
    writeCollection(STORAGE_KEYS.PROJECT_PROGRESS, projects, ENTITIES.projects.event);
  },

  getPayments(): PaymentBillingRecord[] {
    return readCollection<PaymentBillingRecord>(STORAGE_KEYS.PAYMENTS);
  },

  savePayments(payments: PaymentBillingRecord[]): void {
    writeCollection(STORAGE_KEYS.PAYMENTS, payments, ENTITIES.payments.event);
  },

  /** Derived from clients, projects and invoices; axoraa_founder_matrix_v1 is no longer read. */
  getFounderMatrix(): FounderMatrixStats[] {
    const today = todayKeyIST();
    return deriveFounderMatrix(
      this.getClientMaster(),
      this.getProjectProgress(),
      this.getPayments().map((p) => computeInvoice(p, today))
    );
  },

  // Google Sheets Config
  getGoogleSheetsConfig(): GoogleSheetsConfig {
    const defaultCfg: GoogleSheetsConfig = {
      sheetId: "1_m3ld9Eb_zizpDB31fOZ5w59SKPYsNoMI9Ru7f2cfDY",
      webAppUrl: "",
      autoSync: false,
      lastSyncedAt: null,
      status: "disconnected",
    };
    const v = readJson<GoogleSheetsConfig | null>(STORAGE_KEYS.GOOGLE_CONFIG, null);
    return v && typeof v === "object" ? v : defaultCfg;
  },

  saveGoogleSheetsConfig(config: GoogleSheetsConfig): void {
    writeJson(STORAGE_KEYS.GOOGLE_CONFIG, config, "axoraa_config_changed");
  },

  // Active Session & Workspace
  getActiveUserId(): string {
    return readRaw(STORAGE_KEYS.ACTIVE_USER_ID) || "user-akshar";
  },

  setActiveUserId(id: string): void {
    if (writeRaw(STORAGE_KEYS.ACTIVE_USER_ID, id)) notify("axoraa_user_changed");
  },

  getActiveWorkspace(): string {
    return readRaw(STORAGE_KEYS.ACTIVE_WORKSPACE) || "founders";
  },

  setActiveWorkspace(ws: string): void {
    if (writeRaw(STORAGE_KEYS.ACTIVE_WORKSPACE, ws)) notify("axoraa_workspace_changed");
  },
};
