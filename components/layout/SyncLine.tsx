"use client";

// Where the hub's data lives right now, drawn inside the lime sidebar card.
// The dot is static on purpose: nothing in the shell pulses.
import React from "react";
import { ChevronRight, RotateCw } from "lucide-react";
import type { HubData } from "@/lib/useHubData";
import { relativeTime } from "@/lib/format";
import { useNow } from "@/lib/prefs";

type DotTone = "ok" | "quiet" | "busy" | "bad";

interface SyncStatus {
  tone: DotTone;
  text: string;
  retry?: { label: string; run: () => void };
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

export function syncStatusOf(data: HubData, now: number): SyncStatus {
  const { syncState } = data;
  if (syncState.busy) return { tone: "busy", text: "Syncing…" };
  const n = data.unsynced.length;
  if (n > 0) {
    return {
      tone: "bad",
      text: `${n} ${plural(n, "change", "changes")} not saved.`,
      retry: { label: "Retry saving", run: () => void data.retrySync() },
    };
  }
  if (syncState.error) {
    return {
      tone: "bad",
      text: syncState.message?.trim() || "Couldn't reach Google Sheets.",
      retry: { label: "Retry sync", run: () => void data.pullFromSheet() },
    };
  }
  if (data.sharedMode) {
    const at = syncState.lastSyncedAt;
    return { tone: "ok", text: at && now ? `Synced with Google Sheets ${relativeTime(at, now)}` : "Synced with Google Sheets" };
  }
  if (data.source === "sheet") return { tone: "ok", text: "Work logs synced. Other records are on this device." };
  return { tone: "quiet", text: "Saved on this device only." };
}

const DOT: Record<DotTone, string> = {
  ok: "bg-ink",
  quiet: "bg-transparent ring-[1.5px] ring-inset ring-ink/60",
  busy: "bg-ink/35",
  bad: "bg-coral",
};

/**
 * The sync status for the sidebar's lime card. For the administrator the line is a button that
 * opens Integrations; a Retry pill appears when changes are waiting or the last pull failed.
 */
export function SyncLine({ data, onOpen }: { data: HubData; onOpen?: () => void }) {
  const now = useNow(30_000);
  const status = syncStatusOf(data, now);

  const line = (
    <>
      <span aria-hidden className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${DOT[status.tone]}`} />
      <span className="min-w-0 flex-1 text-left">{status.text}</span>
      {onOpen && <ChevronRight aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/45" />}
    </>
  );

  return (
    <div className="space-y-1.5" aria-live="polite">
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          title="Open Integrations"
          className="-mx-1 flex w-[calc(100%+0.5rem)] items-start gap-2 rounded-xl px-1 py-0.5 text-[12px] leading-[16px] text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
        >
          {line}
        </button>
      ) : (
        <div className="flex items-start gap-2 text-[12px] leading-[16px] text-ink/70">{line}</div>
      )}
      {status.retry && (
        <button
          type="button"
          onClick={status.retry.run}
          aria-label={status.retry.label}
          className="ml-3.5 inline-flex h-7 items-center gap-1.5 rounded-full bg-white/75 px-3 text-[12px] font-medium text-ink transition-colors hover:bg-white"
        >
          <RotateCw aria-hidden className="h-3 w-3" />
          Retry
        </button>
      )}
      {data.hasDemoData && (
        <div className="flex items-start gap-2 text-[12px] leading-[16px] text-ink/60">
          <span aria-hidden className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink/25" />
          <span>Demo data on this device.</span>
        </div>
      )}
    </div>
  );
}
