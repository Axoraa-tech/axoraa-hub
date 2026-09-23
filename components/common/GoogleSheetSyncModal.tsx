"use client";

import React, { useState } from "react";
import { GoogleSheetsConfig, DailyWorkLogEntry } from "@/lib/types";
import { GoogleSheetsService } from "@/lib/googleSheetsService";
import { GOOGLE_APPS_SCRIPT_TEMPLATE } from "@/lib/googleAppsScriptCode";
import { X, RefreshCw, Upload, Download, Copy, Check, ExternalLink, Database, CheckCircle2, AlertCircle } from "lucide-react";

interface GoogleSheetSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GoogleSheetsConfig;
  onSaveConfig: (cfg: GoogleSheetsConfig) => void;
  currentLogs: DailyWorkLogEntry[];
  onLogsUpdated: (logs: DailyWorkLogEntry[]) => void;
}

export const GoogleSheetSyncModal: React.FC<GoogleSheetSyncModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  currentLogs,
  onLogsUpdated,
}) => {
  const [webAppUrl, setWebAppUrl] = useState(config.webAppUrl || "");
  const [sheetId, setSheetId] = useState(config.sheetId || "");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"connection" | "script">("connection");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveAndTest = async () => {
    if (!webAppUrl.trim()) {
      setStatusMessage({ type: "error", text: "Please provide a valid Google Apps Script Web App URL." });
      return;
    }

    setIsLoading(true);
    setStatusMessage({ type: "info", text: "Connecting to Google Sheet..." });

    const result = await GoogleSheetsService.fetchFromGoogleSheet(webAppUrl);

    if (result.success && result.data) {
      const newConfig: GoogleSheetsConfig = {
        ...config,
        webAppUrl,
        sheetId,
        status: "connected",
        lastSyncedAt: new Date().toLocaleTimeString(),
      };
      onSaveConfig(newConfig);
      onLogsUpdated(result.data);
      setStatusMessage({
        type: "success",
        text: `Connected! Loaded ${result.data.length} rows directly from your Google Sheet.`,
      });
    } else {
      setStatusMessage({
        type: "error",
        text: result.message || "Failed to reach Google Sheet. Ensure Web App is deployed with access = 'Anyone'.",
      });
    }
    setIsLoading(false);
  };

  const handlePushAll = async () => {
    if (!webAppUrl.trim()) {
      setStatusMessage({ type: "error", text: "Web App URL is required to push data." });
      return;
    }

    setIsLoading(true);
    setStatusMessage({ type: "info", text: `Pushing ${currentLogs.length} rows to Google Sheet...` });

    const result = await GoogleSheetsService.syncAllToGoogleSheet(webAppUrl, currentLogs);

    if (result.success) {
      const newConfig: GoogleSheetsConfig = {
        ...config,
        webAppUrl,
        sheetId,
        status: "connected",
        lastSyncedAt: new Date().toLocaleTimeString(),
      };
      onSaveConfig(newConfig);
      setStatusMessage({
        type: "success",
        text: `Synced! ${currentLogs.length} rows written to Google Sheet.`,
      });
    } else {
      setStatusMessage({
        type: "error",
        text: result.message || "Push failed. Check script permissions.",
      });
    }
    setIsLoading(false);
  };

  const handleExportCsv = () => {
    GoogleSheetsService.exportToCsv(currentLogs);
    setStatusMessage({ type: "success", text: "CSV backup downloaded to your computer!" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#d4ff32] flex items-center justify-center text-zinc-950 font-bold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Google Sheets Database Sync</h2>
              <p className="text-xs text-zinc-500">Live 2-way sync with AXORAA DEV TEAM Workbook</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-zinc-100 px-6 gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab("connection")}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === "connection"
                ? "border-zinc-900 text-zinc-900 font-semibold"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
            }`}
          >
            Connection & Live Sync
          </button>
          <button
            onClick={() => setActiveTab("script")}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === "script"
                ? "border-zinc-900 text-zinc-900 font-semibold"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
            }`}
          >
            Google Apps Script Setup (1-Min)
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {statusMessage && (
            <div
              className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 ${
                statusMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : statusMessage.type === "error"
                  ? "bg-rose-50 text-rose-800 border border-rose-200"
                  : "bg-blue-50 text-blue-800 border border-blue-200"
              }`}
            >
              {statusMessage.type === "success" && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />}
              {statusMessage.type === "error" && <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
              {statusMessage.type === "info" && <RefreshCw className="w-4 h-4 shrink-0 text-blue-600 animate-spin" />}
              <span className="font-medium">{statusMessage.text}</span>
            </div>
          )}

          {activeTab === "connection" ? (
            <div className="space-y-4">
              <div className="bg-zinc-50 border border-zinc-200/70 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Connection Status</div>
                  <div className="text-sm font-bold text-zinc-900 mt-0.5 flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        config.status === "connected" ? "bg-emerald-500" : "bg-amber-400"
                      }`}
                    />
                    {config.status === "connected" ? "Connected to Google Sheet" : "Local / Offline Mode (Fully Functional)"}
                  </div>
                  {config.lastSyncedAt && (
                    <div className="text-[11px] text-zinc-400 mt-1">Last synced: {config.lastSyncedAt}</div>
                  )}
                </div>
                <button
                  onClick={handleExportCsv}
                  className="px-3 py-1.5 bg-white border border-zinc-200 hover:border-zinc-300 rounded-xl text-xs font-medium text-zinc-700 flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV Backup
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Google Apps Script Web App URL
                </label>
                <input
                  type="text"
                  value={webAppUrl}
                  onChange={(e) => setWebAppUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 text-zinc-800"
                />
                <p className="text-[11px] text-zinc-400 mt-1">
                  Obtain this by deploying the Apps Script in your spreadsheet. See setup tab.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Google Sheet ID / Name (Optional Reference)
                </label>
                <input
                  type="text"
                  value={sheetId}
                  onChange={(e) => setSheetId(e.target.value)}
                  placeholder="AXORAA DEV TEAM - SeekFactory Engineering Operations Tracker"
                  className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 text-zinc-800"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  disabled={isLoading}
                  onClick={handleSaveAndTest}
                  className="flex-1 py-2.5 px-4 bg-zinc-900 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                  Fetch & Sync from Sheet
                </button>
                <button
                  disabled={isLoading}
                  onClick={handlePushAll}
                  className="flex-1 py-2.5 px-4 bg-[#d4ff32] text-zinc-950 rounded-xl text-sm font-semibold hover:bg-[#c4f024] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Push Local Data to Sheet
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs text-zinc-600 space-y-1">
                <p className="font-semibold text-zinc-900">Follow these 4 quick steps in your Google Sheet:</p>
                <ol className="list-decimal list-inside space-y-1 pl-1 text-zinc-600">
                  <li>In Google Sheets, click <strong>Extensions &gt; Apps Script</strong>.</li>
                  <li>Paste the code snippet below into <code>Code.gs</code>.</li>
                  <li>Click <strong>Deploy &gt; New deployment</strong>, select type <strong>Web app</strong>.</li>
                  <li>Set <em>Execute as:</em> <strong>Me</strong> and <em>Who has access:</em> <strong>Anyone</strong>.</li>
                  <li>Copy the resulting Web App URL and paste it into the Connection tab!</li>
                </ol>
              </div>

              <div className="relative">
                <button
                  onClick={handleCopyScript}
                  className="absolute top-3 right-3 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied!" : "Copy Script"}
                </button>
                <pre className="p-4 bg-zinc-950 text-zinc-200 text-xs font-mono rounded-2xl overflow-x-auto max-h-64">
                  {GOOGLE_APPS_SCRIPT_TEMPLATE}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
          <span className="text-xs text-zinc-400">
            Current memory: <strong className="text-zinc-700">{currentLogs.length} logs stored</strong>
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
