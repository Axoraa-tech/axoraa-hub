// Catches up on Meta leads from the last 7 days (for example after the webhook was down), through the
// same insert-only ingest path as the webhook, so leads already stored are skipped. Admin only.
import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/dal";
import { IntegrationNotConfiguredError, MetaGraphError } from "@/lib/integrations/errors";
import { readMetaConfig } from "@/lib/integrations/meta/config";
import { forgetPageToken } from "@/lib/integrations/meta/graph";
import { ingestLead } from "@/lib/integrations/meta/ingest";
import { getMetaLeadSource } from "@/lib/integrations/meta/registry";
import { getFeatureFlags } from "@/lib/server/features";
import { SheetsError } from "@/lib/server/sheets";

export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function POST() {
  const viewer = await getViewer();
  if (!viewer) return json({ error: "unauthorized" }, 401);
  if (!viewer.isAdmin) return json({ error: "forbidden" }, 403);

  const features = await getFeatureFlags({ isAdmin: true });
  if (!features.meta.leadsEnabled) {
    const reason = !features.meta.configured
      ? "Meta is not connected."
      : features.sheets.version !== 2
      ? "Lead Ads need shared Google Sheets (script version 2) first."
      : "Set META_WEBHOOK_VERIFY_TOKEN to turn on Lead Ads.";
    return json({ error: "leads_disabled", message: reason, missing: features.meta.missing }, 503);
  }

  const forms = readMetaConfig().config?.leadgenFormIds.length ?? 0;
  let fetched = 0;
  let created = 0;
  let skipped = 0;
  let failed = 0;
  try {
    const leads = await getMetaLeadSource().fetchSince(new Date(Date.now() - WINDOW_MS).toISOString());
    fetched = leads.length;
    for (const lead of leads) {
      try {
        const res = await ingestLead(lead);
        if (res === "created") created++;
        else skipped++;
      } catch (err) {
        if (err instanceof SheetsError && (err.code === "not_configured" || err.code === "script_outdated")) throw err;
        failed++;
      }
    }
  } catch (err) {
    if (err instanceof IntegrationNotConfiguredError) return json({ error: "leads_disabled", message: err.message, missing: err.missing }, 503);
    if (err instanceof MetaGraphError) {
      if (err.tokenInvalid) forgetPageToken();
      return json({ error: err.message, code: err.code }, 502);
    }
    if (err instanceof SheetsError) return json({ error: err.message }, err.status);
    console.warn("Meta lead catch-up failed (unexpected error)");
    return json({ error: "Could not fetch missed leads." }, 502);
  }
  return json({ fetched, created, skipped, failed, forms });
}
