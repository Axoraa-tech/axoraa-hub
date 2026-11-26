// Meta webhook (Lead Ads). Authenticated by signature, not by session:
// - GET: the subscription handshake. hub.verify_token is compared with META_WEBHOOK_VERIFY_TOKEN in
//   constant time and hub.challenge is echoed.
// - POST: the raw body bytes are verified against X-Hub-Signature-256 (HMAC-SHA256 keyed by
//   META_APP_SECRET) before anything is parsed. Leads are fetched and stored after the response.
// Nothing here logs tokens, signatures or lead answers.
import { createHmac, timingSafeEqual } from "node:crypto";
import { after, type NextRequest } from "next/server";
import { readMetaConfig } from "@/lib/integrations/meta/config";
import { ingestLead } from "@/lib/integrations/meta/ingest";
import { getMetaLeadSource } from "@/lib/integrations/meta/registry";
import { isGraphId } from "@/lib/integrations/meta/graph";
import { getScriptVersion } from "@/lib/server/sheets";

export const maxDuration = 60;

const MAX_BODY_BYTES = 1024 * 1024;
const MAX_AGE_MS = 36 * 60 * 60 * 1000;

function text(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

/** Constant-time string comparison (length checked first; the length itself is not secret). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function GET(req: NextRequest) {
  const { config } = readMetaConfig();
  if (!config?.webhookVerifyToken) return text("Forbidden", 403);
  const q = req.nextUrl.searchParams;
  const mode = q.get("hub.mode");
  const token = q.get("hub.verify_token") ?? "";
  const challenge = q.get("hub.challenge") ?? "";
  if (mode !== "subscribe" || !safeEqual(token, config.webhookVerifyToken)) return text("Forbidden", 403);
  if (!/^[A-Za-z0-9_.-]{1,256}$/.test(challenge)) return text("Forbidden", 403);
  return text(challenge, 200);
}

interface LeadgenChange {
  leadgenId: string;
  timeMs: number;
}

function toMs(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 1e12 ? n : n * 1000; // Meta sends seconds; tolerate milliseconds
}

export async function POST(req: NextRequest) {
  // 1. Not configured
  const { config } = readMetaConfig();
  if (!config) return text("Meta is not configured", 503);

  // 2. Size limit before reading
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return text("Payload too large", 413);

  // 3. Raw bytes, re-checked
  let raw: Buffer;
  try {
    raw = Buffer.from(await req.arrayBuffer());
  } catch {
    return text("Bad request", 400);
  }
  if (raw.byteLength > MAX_BODY_BYTES) return text("Payload too large", 413);

  // 4. Signature over the raw bytes, before JSON.parse
  const header = req.headers.get("x-hub-signature-256") ?? "";
  const match = /^sha256=([0-9a-fA-F]{64})$/.exec(header.trim());
  if (!match) return text("Forbidden", 403);
  const expected = createHmac("sha256", config.appSecret).update(raw).digest();
  const provided = Buffer.from(match[1], "hex");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return text("Forbidden", 403);

  // 5. Parse; only Page events for our Page
  let payload: unknown;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    return text("Bad request", 400);
  }
  if (!payload || typeof payload !== "object" || (payload as { object?: unknown }).object !== "page") {
    return text("Unsupported object", 400);
  }

  const now = Date.now();
  const changes: LeadgenChange[] = [];
  const entries = Array.isArray((payload as { entry?: unknown }).entry) ? ((payload as { entry: unknown[] }).entry) : [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as { id?: unknown; time?: unknown; changes?: unknown };
    if (String(e.id ?? "") !== config.pageId) continue;
    const list = Array.isArray(e.changes) ? e.changes : [];
    for (const change of list) {
      if (!change || typeof change !== "object") continue;
      const c = change as { field?: unknown; value?: unknown };
      if (c.field !== "leadgen" || !c.value || typeof c.value !== "object") continue;
      const v = c.value as { leadgen_id?: unknown; created_time?: unknown };
      const leadgenId = typeof v.leadgen_id === "number" ? String(v.leadgen_id) : v.leadgen_id;
      if (!isGraphId(leadgenId)) continue;
      const timeMs = toMs(v.created_time) ?? toMs(e.time);
      if (timeMs === null || now - timeMs > MAX_AGE_MS) continue; // too old: ignore
      changes.push({ leadgenId, timeMs });
    }
  }

  if (changes.length === 0) return text("EVENT_RECEIVED", 200);

  // 6. Leads are stored in the shared sheet; hold them (Meta retries) until it is ready.
  const version = await getScriptVersion();
  if (version !== 2) {
    console.warn("Meta lead held: shared storage is not ready");
    return text("Shared storage is not ready", 503);
  }

  // 7. Answer now; fetch and store after the response.
  const ids = [...new Set(changes.map((c) => c.leadgenId))];
  after(async () => {
    const source = getMetaLeadSource();
    let created = 0;
    let skipped = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        const lead = await source.fetchById(id);
        if (!lead) {
          skipped++;
          continue;
        }
        const res = await ingestLead(lead);
        if (res === "created") created++;
        else skipped++;
      } catch (err) {
        failed++;
        const name = err instanceof Error ? err.name : "Error";
        const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
        console.warn(`Meta lead not stored (${name}${code ? ` ${code}` : ""})`);
      }
    }
    if (failed) console.warn(`Meta webhook: ${created} stored, ${skipped} skipped, ${failed} failed`);
  });

  return text("EVENT_RECEIVED", 200);
}
