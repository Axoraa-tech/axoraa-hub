import { DailyWorkLogEntry } from "./types";

export interface SyncResult {
  success: boolean;
  message: string;
  data?: DailyWorkLogEntry[];
  error?: string;
}

export const GoogleSheetsService = {
  /**
   * Fetch all rows from Google Apps Script Web App
   */
  async fetchFromGoogleSheet(webAppUrl: string): Promise<SyncResult> {
    if (!webAppUrl || !webAppUrl.startsWith("http")) {
      return { success: false, message: "Invalid Web App URL provided." };
    }

    try {
      const response = await fetch(webAppUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success && Array.isArray(result.rows)) {
        return {
          success: true,
          message: `Successfully fetched ${result.rows.length} rows from Google Sheet`,
          data: result.rows,
        };
      } else {
        return {
          success: false,
          message: result.error || "Failed to fetch data from Google Sheet",
          error: result.error,
        };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: "Failed to connect to Google Sheet. Check URL or permissions.",
        error: message,
      };
    }
  },

  /**
   * Push all current work logs to Google Sheet (Sync All)
   */
  async syncAllToGoogleSheet(webAppUrl: string, logs: DailyWorkLogEntry[]): Promise<SyncResult> {
    if (!webAppUrl || !webAppUrl.startsWith("http")) {
      return { success: false, message: "Invalid Web App URL provided." };
    }

    try {
      const payload = {
        action: "SYNC_ALL",
        data: logs,
      };

      const response = await fetch(webAppUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // Apps Script accepts text/plain to avoid CORS preflight options issues
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (result.success) {
        return {
          success: true,
          message: result.message || `Successfully synced ${logs.length} rows to Google Sheet`,
        };
      } else {
        return {
          success: false,
          message: result.error || "Google Sheet sync failed",
          error: result.error,
        };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: "Network or permission error while sending data to Google Sheet.",
        error: message,
      };
    }
  },

  /**
   * Append a single work log row to Google Sheet
   */
  async appendLogToGoogleSheet(webAppUrl: string, entry: DailyWorkLogEntry): Promise<SyncResult> {
    if (!webAppUrl || !webAppUrl.startsWith("http")) {
      return { success: false, message: "Invalid Web App URL" };
    }

    try {
      const payload = {
        action: "ADD_LOG",
        data: entry,
      };

      const response = await fetch(webAppUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      return {
        success: !!result.success,
        message: result.message || "Row appended to Google Sheet",
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: "Failed to append row to Google Sheet",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },

  /**
   * Export all rows to CSV format for instant backup / offline spreadsheet import
   */
  exportToCsv(logs: DailyWorkLogEntry[]): void {
    const headers = [
      "Date",
      "Developer Name",
      "Project",
      "Repository",
      "Module / Feature Area",
      "Work Type",
      "Task / Work Description",
      "GitHub PR Number",
      "Work Status",
      "Priority",
      "Hours / Effort",
      "Blocked?",
      "Blocker / Dependency",
      "Review Required?",
      "Reviewer",
      "Deployment / Release",
      "Production Impact",
      "Notes",
      "Last Updated",
    ];

    const escapeCsv = (val: string | number) => {
      const str = String(val ?? "").replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvRows = [headers.join(",")];
    for (const log of logs) {
      const row = [
        escapeCsv(log.date),
        escapeCsv(log.developerName),
        escapeCsv(log.project),
        escapeCsv(log.repository),
        escapeCsv(log.module),
        escapeCsv(log.workType),
        escapeCsv(log.taskDescription),
        escapeCsv(log.githubPr),
        escapeCsv(log.workStatus),
        escapeCsv(log.priority),
        escapeCsv(log.hours),
        escapeCsv(log.isBlocked),
        escapeCsv(log.blockerDetails),
        escapeCsv(log.reviewRequired),
        escapeCsv(log.reviewer),
        escapeCsv(log.deployment),
        escapeCsv(log.productionImpact),
        escapeCsv(log.notes),
        escapeCsv(log.lastUpdated),
      ];
      csvRows.push(row.join(","));
    }

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\n"));
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `axoraa_dev_work_log_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};
