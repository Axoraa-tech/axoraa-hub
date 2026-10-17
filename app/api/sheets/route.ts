// Authenticated bridge to the Google Sheets Apps Script web app.
// The Apps Script URL and its shared token stay on the server; the browser only talks to this route.
import { NextRequest, NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/dal";
import type { DailyWorkLogEntry } from "@/lib/types";

function sheetsConfig() {
  const url = process.env.SHEETS_WEBAPP_URL;
  const token = process.env.SHEETS_API_TOKEN;
  return url && token && url.startsWith("https://") ? { url, token } : null;
}

export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cfg = sheetsConfig();
  if (req.nextUrl.searchParams.get("status") !== null) {
    return NextResponse.json({ configured: !!cfg });
  }
  if (!cfg) return NextResponse.json({ configured: false, rows: [] });

  try {
    const res = await fetch(`${cfg.url}?token=${encodeURIComponent(cfg.token)}`, { cache: "no-store" });
    const body = await res.json();
    if (!body.success || !Array.isArray(body.rows)) {
      return NextResponse.json({ configured: true, error: body.error || "Sheet returned no rows" }, { status: 502 });
    }
    let rows = body.rows as DailyWorkLogEntry[];
    // Members only ever receive their own rows.
    if (!viewer.isAdmin) rows = rows.filter((r) => r.developerName === viewer.account.name);
    return NextResponse.json({ configured: true, rows });
  } catch {
    return NextResponse.json({ configured: true, error: "Could not reach Google Sheet" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cfg = sheetsConfig();
  if (!cfg) return NextResponse.json({ error: "Google Sheets is not configured on the server" }, { status: 503 });

  let body: { action?: string; data?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action === "ADD_LOG") {
    const entry = body.data as DailyWorkLogEntry;
    if (!entry || typeof entry !== "object") return NextResponse.json({ error: "Missing entry" }, { status: 400 });
    // A member can only write rows under their own name.
    const data = viewer.isAdmin ? entry : { ...entry, developerName: viewer.account.name };
    return forward(cfg, { action: "ADD_LOG", data });
  }

  if (body.action === "SYNC_ALL") {
    if (!viewer.isAdmin) return NextResponse.json({ error: "Only the administrator can overwrite the sheet" }, { status: 403 });
    if (!Array.isArray(body.data)) return NextResponse.json({ error: "Missing rows" }, { status: 400 });
    return forward(cfg, { action: "SYNC_ALL", data: body.data });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

async function forward(cfg: { url: string; token: string }, payload: object) {
  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...payload, token: cfg.token }),
      cache: "no-store",
    });
    const result = await res.json();
    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  } catch {
    return NextResponse.json({ success: false, error: "Could not reach Google Sheet" }, { status: 502 });
  }
}
