import { DailyWorkLogEntry } from "./types";
import { downloadCsv, WORK_LOG_COLUMNS } from "./export";
import { todayKeyIST } from "./format";

export interface SyncResult {
  success: boolean;
  message: string;
  data?: DailyWorkLogEntry[];
  error?: string;
}

export const GoogleSheetsService = {
  /** Whether the server has a Google Sheet bridge configured, and which Apps Script version answers. */
  async status(): Promise<{ configured: boolean; version: 1 | 2 | null }> {
    try {
      const res = await fetch("/api/sheets?status", { cache: "no-store" });
      if (!res.ok) return { configured: false, version: null };
      const body: unknown = await res.json();
      const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
      const configured = b.configured === true;
      const version = b.version === 2 ? 2 : b.version === 1 ? 1 : null;
      return { configured, version: configured ? version : null };
    } catch {
      return { configured: false, version: null };
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
    downloadCsv(`axoraa_work_log_${todayKeyIST()}.csv`, logs, WORK_LOG_COLUMNS);
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
