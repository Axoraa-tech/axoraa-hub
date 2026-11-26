// Authenticated bridge to the Google Sheets Apps Script web app for work logs (the v1 contract).
// The Apps Script URL and its shared token stay on the server (lib/server/sheets.ts); the browser only
// talks to this route. Members only ever read and write their own rows; SYNC_ALL is admin-only.
// String cells are escaped against formula injection in lib/server/sheets.ts (csvSafe).
import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/dal";
import type { DailyWorkLogEntry } from "@/lib/types";
import { addWorkLog, getScriptVersion, listWorkLogs, sheetsConfig, SheetsError, syncAllWorkLogs } from "@/lib/server/sheets";

const MAX_BODY = 1024 * 1024;
const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return json({ error: "Unauthorized" }, 401);

  const cfg = sheetsConfig();
  if (req.nextUrl.searchParams.get("status") !== null) {
    return json({ configured: !!cfg, version: cfg ? await getScriptVersion() : null });
  }
  if (!cfg) return json({ configured: false, rows: [] });

  try {
    let rows = await listWorkLogs();
    // Members only ever receive their own rows.
    if (!viewer.isAdmin) rows = rows.filter((r) => r.developerName === viewer.account.name);
    return json({ configured: true, rows });
  } catch (err) {
    const message = err instanceof SheetsError && err.code !== "timeout" ? err.message : "Could not reach Google Sheet";
    return json({ configured: true, error: message }, 502);
  }
}

export async function POST(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return json({ error: "Unauthorized" }, 401);
  if (!sheetsConfig()) return json({ error: "Google Sheets is not configured on the server" }, 503);

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY) return json({ error: "Request is larger than 1 MB" }, 413);

  let body: { action?: string; data?: unknown };
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return json({ error: "Request is larger than 1 MB" }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!body || typeof body !== "object") return json({ error: "Invalid JSON" }, 400);

  try {
    if (body.action === "ADD_LOG") {
      const entry = body.data as DailyWorkLogEntry;
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return json({ error: "Missing entry" }, 400);
      // A member can only write rows under their own name.
      const data = viewer.isAdmin ? entry : { ...entry, developerName: viewer.account.name };
      const result = await addWorkLog(data);
      return json(result, result.success ? 200 : 502);
    }

    if (body.action === "SYNC_ALL") {
      if (!viewer.isAdmin) return json({ error: "Only the administrator can overwrite the sheet" }, 403);
      if (!Array.isArray(body.data)) return json({ error: "Missing rows" }, 400);
      const rows = body.data.filter((r): r is DailyWorkLogEntry => !!r && typeof r === "object" && !Array.isArray(r));
      const result = await syncAllWorkLogs(rows);
      return json(result, result.success ? 200 : 502);
    }
  } catch (err) {
    const message = err instanceof SheetsError && err.code !== "upstream" ? err.message : "Could not reach Google Sheet";
    return json({ success: false, error: message }, 502);
  }

  return json({ error: "Unknown action" }, 400);
}
