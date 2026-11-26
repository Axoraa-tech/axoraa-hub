// Assistant usage and an approximate cost in rupees, for the Settings cost line. Isomorphic and pure.
import type { AssistantPricing } from "@/lib/settings";
import type { AgentDraft } from "@/lib/types";

const IST_OFFSET_MS = 330 * 60 * 1000;

/** 'YYYY-MM' of an ISO timestamp in Asia/Kolkata, or null when it does not parse. */
function istMonthOf(iso: string | undefined): string | null {
  if (!iso) return null;
  // A bare day key is already a calendar date.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso.slice(0, 7);
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 7);
}

function count(n: unknown): number {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Runs and tokens in the IST calendar month of todayKey ('YYYY-MM-DD').
 * A run is a draft created this month, plus every revision (version) made this month.
 * Tokens come from the drafts created this month.
 */
export function monthUsage(
  drafts: readonly AgentDraft[],
  todayKey: string
): { runs: number; inputTokens: number; outputTokens: number } {
  const month = todayKey.slice(0, 7);
  let runs = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  for (const d of drafts) {
    if (istMonthOf(d.createdAt) === month) {
      runs += 1;
      inputTokens += count(d.usage?.inputTokens);
      outputTokens += count(d.usage?.outputTokens);
    }
    for (const v of d.versions ?? []) {
      if (istMonthOf(v.at) === month) runs += 1;
    }
  }
  return { runs, inputTokens, outputTokens };
}

/** Approximate cost in whole rupees. Web search charges are not included. */
export function estimateCostInr(
  u: { inputTokens: number; outputTokens: number },
  pricing: AssistantPricing
): number {
  const usd =
    (count(u.inputTokens) / 1_000_000) * count(pricing.inputUsdPerMTok) +
    (count(u.outputTokens) / 1_000_000) * count(pricing.outputUsdPerMTok);
  return Math.round(usd * count(pricing.usdToInr));
}
