"use client";

import React, { useState } from "react";
import { Check, Copy, Database, Download, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { GOOGLE_APPS_SCRIPT_TEMPLATE } from "@/lib/googleAppsScriptCode";
import { GoogleSheetsService } from "@/lib/googleSheetsService";
import type { HubData } from "@/lib/useHubData";
import { Modal, Segmented } from "@/components/ui/primitives";

export function GoogleSheetSyncModal({ open, onClose, data }: { open: boolean; onClose: () => void; data: HubData }) {
  const [tab, setTab] = useState<"sync" | "setup">(data.source === "sheet" ? "sync" : "setup");
  const [copied, setCopied] = useState(false);
  const connected = data.source === "sheet";

  const copy = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<Database />}
      title="Google Sheets"
      subtitle="Your workbook is the database. The connection lives on the server, never in the browser."
      width="max-w-2xl"
      footer={
        <button className="btn btn-ink" onClick={onClose}>
          Done
        </button>
      }
    >
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "sync", label: "Sync" },
          { value: "setup", label: "Setup" },
        ]}
      />

      {tab === "sync" ? (
        <div className="mt-5 space-y-4">
          <div className={`${connected ? "card-lime" : "card-inset"} p-5 flex items-center gap-4`}>
            <span className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${connected ? "bg-ink text-lime" : "bg-surface"}`}>
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-medium">{connected ? "Connected to Google Sheet" : "Not connected — using this browser's storage"}</div>
              <div className={`text-[12.5px] mt-0.5 ${connected ? "text-ink/60" : "text-ink-3"}`}>
                {data.syncState.message ?? (connected ? "Rows load automatically when anyone opens the hub." : "Add SHEETS_WEBAPP_URL and SHEETS_API_TOKEN to the server environment.")}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button className="btn btn-ink" disabled={!connected || data.syncState.busy} onClick={() => data.pullFromSheet()}>
              <RefreshCw className={`w-4 h-4 ${data.syncState.busy ? "animate-spin" : ""}`} /> Pull latest
            </button>
            <button
              className="btn btn-lime"
              disabled={!connected || data.syncState.busy}
              onClick={() => {
                if (confirm(`Overwrite the Google Sheet with the ${data.workLogs.length} rows shown in the hub?`)) data.pushAll();
              }}
            >
              <Upload className="w-4 h-4" /> Push all rows
            </button>
            <button className="btn btn-ghost" onClick={() => GoogleSheetsService.exportToCsv(data.workLogs)}>
              <Download className="w-4 h-4" /> CSV backup
            </button>
          </div>
          <p className="text-[12px] text-ink-3">
            Members append their own entries straight to the sheet. Edits and deletions made by the administrator re-write the sheet.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <ol className="space-y-2.5 text-[13.5px] text-ink-2">
            {[
              <>In the workbook, open <b className="text-ink font-medium">Extensions → Apps Script</b> and paste the script below into Code.gs.</>,
              <>Project Settings → Script properties → add <code className="font-mono text-[12px] bg-surface-2 px-1.5 py-0.5 rounded">AXORAA_TOKEN</code> with a long random value.</>,
              <>Deploy → New deployment → Web app · Execute as <b className="text-ink font-medium">Me</b> · Access <b className="text-ink font-medium">Anyone</b>. Requests without the token are rejected.</>,
              <>
                On the server, set <code className="font-mono text-[12px] bg-surface-2 px-1.5 py-0.5 rounded">SHEETS_WEBAPP_URL</code> (the /exec URL) and{" "}
                <code className="font-mono text-[12px] bg-surface-2 px-1.5 py-0.5 rounded">SHEETS_API_TOKEN</code> (same token) in .env.local, then restart.
              </>,
            ].map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-ink text-white text-[12px] flex items-center justify-center shrink-0">{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
          <div className="relative">
            <button onClick={copy} className="btn btn-sm absolute top-3 right-3 bg-white/10 text-white hover:bg-white/20">
              {copied ? <Check className="w-3.5 h-3.5 text-lime" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy script"}
            </button>
            <pre className="p-5 pt-14 bg-ink text-white/80 text-[11.5px] font-mono rounded-[20px] overflow-auto max-h-72">{GOOGLE_APPS_SCRIPT_TEMPLATE}</pre>
          </div>
        </div>
      )}
    </Modal>
  );
}
