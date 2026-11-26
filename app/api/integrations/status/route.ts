// What is connected: Google Sheets, the assistant and each Meta surface. ?check=1 (admin only) runs a
// live Page lookup on Meta; without it nothing is sent to Meta. Secrets never appear in the answer;
// only the administrator sees the names of missing environment variables.
import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/dal";
import { daysBetween, todayKeyIST } from "@/lib/format";
import type { IntegrationsStatusResponse } from "@/lib/integrations/types";
import { readMetaConfig } from "@/lib/integrations/meta/config";
import { getIntegrationStatuses } from "@/lib/integrations/meta/registry";
import { getFeatureFlags } from "@/lib/server/features";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });

  const check = req.nextUrl.searchParams.get("check") === "1";
  if (check && !viewer.isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403, headers: NO_STORE });

  const features = await getFeatureFlags({ isAdmin: viewer.isAdmin });
  const statuses = await getIntegrationStatuses({ live: check, isAdmin: viewer.isAdmin });
  const { config } = readMetaConfig();
  const expires = config?.tokenExpiresAt ?? null;

  const body: IntegrationsStatusResponse = {
    sheets: features.sheets,
    assistant: features.assistant,
    meta: {
      ...statuses,
      publishEnabled: features.meta.publishEnabled,
      leadsEnabled: features.meta.leadsEnabled,
      webhookPath: "/api/integrations/meta/webhook",
      tokenDaysLeft: expires ? daysBetween(todayKeyIST(), expires) : null,
    },
  };
  return NextResponse.json(body, { headers: NO_STORE });
}
