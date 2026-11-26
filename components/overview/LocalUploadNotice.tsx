"use client";

import React, { useState } from "react";
import { CloudAlert, CloudUpload } from "lucide-react";
import { useHub } from "@/lib/hub/context";
import type { RemoteEntity } from "@/lib/data/entities";
import { useConfirm, useToast } from "@/components/ui/feedback";

const NOUN: Record<RemoteEntity, [string, string]> = {
  deals: ["deal", "deals"],
  interactions: ["visit", "visits"],
  clients: ["client", "clients"],
  projects: ["project", "projects"],
  payments: ["invoice", "invoices"],
  roster: ["roster member", "roster members"],
  repositories: ["repository", "repositories"],
  posts: ["post", "posts"],
  campaigns: ["campaign", "campaigns"],
  drafts: ["assistant draft", "assistant drafts"],
  activity: ["activity entry", "activity entries"],
  settings: ["settings record", "settings records"],
};

const ORDER: RemoteEntity[] = ["interactions", "deals", "clients", "projects", "payments", "posts", "campaigns", "drafts", "roster", "repositories", "activity", "settings"];

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** '9 visits and 2 deals'. */
export function describeLocalOnly(byEntity: Partial<Record<RemoteEntity, number>>): string {
  const parts = ORDER.filter((k) => (byEntity[k] ?? 0) > 0).map((k) => {
    const n = byEntity[k] ?? 0;
    return `${n} ${NOUN[k][n === 1 ? 0 : 1]}`;
  });
  return joinList(parts);
}

/**
 * Shown in shared mode when this browser holds records the Google Sheet doesn't have
 * (saved before the sheet was connected). Upload sends them; demo rows are never sent.
 */
export function LocalUploadNotice() {
  const { data } = useHub();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const { localOnly } = data;

  if (!data.sharedMode || localOnly.total <= 0) return null;

  const what = describeLocalOnly(localOnly.byEntity) || `${localOnly.total} ${localOnly.total === 1 ? "record" : "records"}`;
  const verb = localOnly.total === 1 ? "isn't" : "aren't";

  const upload = async () => {
    setBusy(true);
    try {
      const r = await data.pushLocalToShared();
      const extra = [r.skipped > 0 ? `${r.skipped} skipped` : "", r.failed > 0 ? `${r.failed} failed` : ""].filter(Boolean).join(", ");
      toast({
        message: `Uploaded ${r.pushed} ${r.pushed === 1 ? "record" : "records"}${extra ? `, ${extra}` : ""}`,
        tone: r.failed > 0 ? "negative" : "positive",
      });
    } catch {
      toast({ message: "Upload failed. Check the connection and try again.", tone: "negative" });
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async () => {
    const ok = await confirm({
      title: "Keep these records on this device?",
      body: "These records will stay only on this device.",
      confirmLabel: "Keep on this device",
      cancelLabel: "Cancel",
    });
    if (ok) data.dismissLocalOnly();
  };

  return (
    <section
      aria-label="Records on this device"
      className="flex flex-col gap-3 rounded-[22px] bg-amber-soft px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
    >
      <span aria-hidden className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-ink sm:flex">
        <CloudUpload className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium text-ink">
          {what} on this device {verb} in the shared sheet.
        </p>
        {localOnly.excludedDemo > 0 && <p className="mt-0.5 text-[12.5px] text-ink-2">Demo rows are not uploaded.</p>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button type="button" className="btn btn-ink btn-sm" onClick={() => void upload()} disabled={busy} aria-busy={busy}>
          <CloudUpload aria-hidden className="h-3.5 w-3.5" />
          {busy ? "Uploading" : "Upload"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void dismiss()} disabled={busy}>
          Dismiss
        </button>
      </div>
    </section>
  );
}

/** Changes that did not reach Google Sheets, with a Retry. Hidden when everything is saved. */
export function UnsyncedNotice() {
  const { data } = useHub();
  const [busy, setBusy] = useState(false);
  const n = data.unsynced.length;
  if (!n) return null;
  return (
    <section
      aria-label="Unsaved changes"
      className="flex flex-col gap-3 rounded-[22px] bg-coral-soft px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
    >
      <span aria-hidden className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-negative sm:flex">
        <CloudAlert className="h-4 w-4" />
      </span>
      <p className="min-w-0 flex-1 text-[13.5px] font-medium text-ink">
        {n} {n === 1 ? "change was" : "changes were"} not saved to Google Sheets. They are kept on this device.
      </p>
      <button
        type="button"
        className="btn btn-ink btn-sm self-start sm:self-auto"
        disabled={busy}
        aria-busy={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await data.retrySync();
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Retrying" : "Retry"}
      </button>
    </section>
  );
}
