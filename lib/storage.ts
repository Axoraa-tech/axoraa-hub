import {
  DailyWorkLogEntry,
  DeveloperRosterMember,
  RepositoryMapping,
  GoogleSheetsConfig,
  MarketingDeal,
  MarketingInteraction,
  ClientMasterRecord,
  ProjectProgressRecord,
  PaymentBillingRecord,
  FounderMatrixStats,
} from "./types";
import {
  INITIAL_WORK_LOGS,
  INITIAL_ROSTER,
  INITIAL_REPOSITORIES,
  INITIAL_MARKETING_DEALS,
  INITIAL_INTERACTIONS,
  INITIAL_CLIENT_MASTER,
  INITIAL_PROJECT_PROGRESS,
  INITIAL_PAYMENT_BILLING,
  INITIAL_FOUNDER_MATRIX,
} from "./mockData";

const STORAGE_KEYS = {
  WORK_LOGS: "axoraa_work_logs_v1",
  ROSTER: "axoraa_dev_roster_v1",
  REPOSITORIES: "axoraa_repos_v1",
  GOOGLE_CONFIG: "axoraa_sheets_config_v1",
  MARKETING_DEALS: "axoraa_marketing_deals_v1",
  MARKETING_INTERACTIONS: "axoraa_marketing_interactions_v1",
  CLIENTS: "axoraa_client_master_v1",
  PROJECT_PROGRESS: "axoraa_project_progress_v1",
  PAYMENTS: "axoraa_payments_v1",
  FOUNDER_MATRIX: "axoraa_founder_matrix_v1",
  ACTIVE_USER_ID: "axoraa_active_user_id_v1",
  ACTIVE_WORKSPACE: "axoraa_active_workspace_v1",
};

export const StorageService = {
  // ==========================================
  // Track 1: Work Logs & Engineering
  // ==========================================
  getWorkLogs(): DailyWorkLogEntry[] {
    if (typeof window === "undefined") return INITIAL_WORK_LOGS;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.WORK_LOGS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error("Failed to load work logs", e);
    }
    this.saveWorkLogs(INITIAL_WORK_LOGS);
    return INITIAL_WORK_LOGS;
  },

  saveWorkLogs(logs: DailyWorkLogEntry[]): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEYS.WORK_LOGS, JSON.stringify(logs));
      window.dispatchEvent(new Event("axoraa_data_changed"));
    } catch (e) {
      console.error("Failed to save work logs", e);
    }
  },

  addWorkLog(entry: Omit<DailyWorkLogEntry, "id" | "lastUpdated">): DailyWorkLogEntry {
    const logs = this.getWorkLogs();
    const newEntry: DailyWorkLogEntry = {
      ...entry,
      id: "log-" + Date.now(),
      lastUpdated: new Date().toISOString().replace("T", " ").substring(0, 19),
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
      lastUpdated: new Date().toISOString().replace("T", " ").substring(0, 19),
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
      blockerDetails: "Resolved / Unblocked on " + new Date().toLocaleDateString(),
    });
  },

  // Developer Roster
  getRoster(): DeveloperRosterMember[] {
    if (typeof window === "undefined") return INITIAL_ROSTER;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ROSTER);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to load roster", e);
    }
    return INITIAL_ROSTER;
  },

  saveRoster(roster: DeveloperRosterMember[]): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.ROSTER, JSON.stringify(roster));
    window.dispatchEvent(new Event("axoraa_roster_changed"));
  },

  getRepositories(): RepositoryMapping[] {
    if (typeof window === "undefined") return INITIAL_REPOSITORIES;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.REPOSITORIES);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to load repos", e);
    }
    return INITIAL_REPOSITORIES;
  },

  // ==========================================
  // Track 2: Marketing CRM (Deals & Interactions)
  // ==========================================
  getMarketingDeals(): MarketingDeal[] {
    if (typeof window === "undefined") return INITIAL_MARKETING_DEALS;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MARKETING_DEALS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error("Failed to load marketing deals", e);
    }
    this.saveMarketingDeals(INITIAL_MARKETING_DEALS);
    return INITIAL_MARKETING_DEALS;
  },

  saveMarketingDeals(deals: MarketingDeal[]): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.MARKETING_DEALS, JSON.stringify(deals));
    window.dispatchEvent(new Event("axoraa_deals_changed"));
  },

  addMarketingDeal(deal: Omit<MarketingDeal, "id">): MarketingDeal {
    const deals = this.getMarketingDeals();
    const newDeal: MarketingDeal = {
      ...deal,
      id: "deal-" + Date.now(),
    };
    deals.unshift(newDeal);
    this.saveMarketingDeals(deals);
    return newDeal;
  },

  updateMarketingDeal(id: string, updates: Partial<MarketingDeal>): MarketingDeal | null {
    const deals = this.getMarketingDeals();
    const idx = deals.findIndex((d) => d.id === id);
    if (idx === -1) return null;
    deals[idx] = { ...deals[idx], ...updates };
    this.saveMarketingDeals(deals);
    return deals[idx];
  },

  getInteractions(): MarketingInteraction[] {
    if (typeof window === "undefined") return INITIAL_INTERACTIONS;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MARKETING_INTERACTIONS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error("Failed to load interactions", e);
    }
    this.saveInteractions(INITIAL_INTERACTIONS);
    return INITIAL_INTERACTIONS;
  },

  saveInteractions(interactions: MarketingInteraction[]): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.MARKETING_INTERACTIONS, JSON.stringify(interactions));
    window.dispatchEvent(new Event("axoraa_interactions_changed"));
  },

  addInteraction(interaction: Omit<MarketingInteraction, "id">): MarketingInteraction {
    const list = this.getInteractions();
    const newInt: MarketingInteraction = {
      ...interaction,
      id: "int-" + Date.now(),
    };
    list.unshift(newInt);
    this.saveInteractions(list);
    return newInt;
  },

  // ==========================================
  // Track 3: Founders & Executive Command Center
  // ==========================================
  getClientMaster(): ClientMasterRecord[] {
    if (typeof window === "undefined") return INITIAL_CLIENT_MASTER;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CLIENTS);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to load clients", e);
    }
    return INITIAL_CLIENT_MASTER;
  },

  saveClientMaster(clients: ClientMasterRecord[]): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
    window.dispatchEvent(new Event("axoraa_clients_changed"));
  },

  getProjectProgress(): ProjectProgressRecord[] {
    if (typeof window === "undefined") return INITIAL_PROJECT_PROGRESS;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PROJECT_PROGRESS);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to load project progress", e);
    }
    return INITIAL_PROJECT_PROGRESS;
  },

  saveProjectProgress(projects: ProjectProgressRecord[]): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.PROJECT_PROGRESS, JSON.stringify(projects));
    window.dispatchEvent(new Event("axoraa_projects_changed"));
  },

  getPayments(): PaymentBillingRecord[] {
    if (typeof window === "undefined") return INITIAL_PAYMENT_BILLING;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to load payments", e);
    }
    return INITIAL_PAYMENT_BILLING;
  },

  savePayments(payments: PaymentBillingRecord[]): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
    window.dispatchEvent(new Event("axoraa_payments_changed"));
  },

  getFounderMatrix(): FounderMatrixStats[] {
    if (typeof window === "undefined") return INITIAL_FOUNDER_MATRIX;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.FOUNDER_MATRIX);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to load founder matrix", e);
    }
    return INITIAL_FOUNDER_MATRIX;
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
    if (typeof window === "undefined") return defaultCfg;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.GOOGLE_CONFIG);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to load sheets config", e);
    }
    return defaultCfg;
  },

  saveGoogleSheetsConfig(config: GoogleSheetsConfig): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.GOOGLE_CONFIG, JSON.stringify(config));
    window.dispatchEvent(new Event("axoraa_config_changed"));
  },

  // Active Session & Workspace
  getActiveUserId(): string {
    if (typeof window === "undefined") return "user-akshar";
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_USER_ID) || "user-akshar";
  },

  setActiveUserId(id: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, id);
    window.dispatchEvent(new Event("axoraa_user_changed"));
  },

  getActiveWorkspace(): string {
    if (typeof window === "undefined") return "founders";
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_WORKSPACE) || "founders";
  },

  setActiveWorkspace(ws: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.ACTIVE_WORKSPACE, ws);
    window.dispatchEvent(new Event("axoraa_workspace_changed"));
  },
};
