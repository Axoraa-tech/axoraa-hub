import { DailyWorkLogEntry } from "./types";
import { downloadCsv, WORK_LOG_COLUMNS } from "./export";

export interface SyncResult {
  success: boolean;
  message: string;
  data?: DailyWorkLogEntry[];
  error?: string;
}

export const GoogleSheetsService = {
  /** Whether the server has a Google Sheet bridge configured. */
  async status(): Promise<{ configured: boolean }> {
    try {
      const res = await fetch("/api/sheets?status", { cache: "no-store" });
      if (!res.ok) return { configured: false };
      return await res.json();
    } catch {
      return { configured: false };
    }
  },

  /** Fetch rows through the authenticated server route (members receive only their own rows). */
  async fetchFromGoogleSheet(): Promise<SyncResult> {
    try {
      const res = await fetch("/api/sheets", { cache: "no-store" });
      const body = await res.json();
      if (!body.configured) return { success: false, message: "Google Sheets is not configured on the server yet." };
      if (!res.ok || !Array.isArray(body.rows)) {
        return { success: false, message: body.error || "Failed to fetch data from Google Sheet", error: body.error };
      }
      return { success: true, message: `Loaded ${body.rows.length} rows from Google Sheet`, data: body.rows };
    } catch (err: unknown) {
      return { success: false, message: "Could not reach the server.", error: err instanceof Error ? err.message : String(err) };
    }
  },

  /** Overwrite the sheet with the given rows (administrator only). */
  async syncAllToGoogleSheet(logs: DailyWorkLogEntry[]): Promise<SyncResult> {
    return post({ action: "SYNC_ALL", data: logs }, `Synced ${logs.length} rows to Google Sheet`);
  },

  /** Append a single work log row. */
  async appendLogToGoogleSheet(entry: DailyWorkLogEntry): Promise<SyncResult> {
    return post({ action: "ADD_LOG", data: entry }, "Row appended to Google Sheet");
  },

  /** CSV backup of work logs. */
  exportToCsv(logs: DailyWorkLogEntry[]): void {
    downloadCsv(`axoraa_work_log_${new Date().toISOString().substring(0, 10)}.csv`, logs, WORK_LOG_COLUMNS);
  },
};

async function post(payload: object, okMessage: string): Promise<SyncResult> {
  try {
    const res = await fetch("/api/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (res.ok && body.success) return { success: true, message: body.message || okMessage };
    return { success: false, message: body.error || "Google Sheet request failed", error: body.error };
  } catch (err: unknown) {
    return { success: false, message: "Could not reach the server.", error: err instanceof Error ? err.message : String(err) };
  }
}
