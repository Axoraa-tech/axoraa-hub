// Shared records (Apps Script v2). Every request needs a session; the policy table in
// lib/data/policy.ts decides what each viewer may read, create, change and delete. Owner fields are
// enforced here, sequence numbers are assigned by the script under its lock, and the activity row is
// written in the same script call as the change.
import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/dal";
import { isEntityKey, isRemoteEntity, REMOTE_ENTITIES, type RemoteEntity } from "@/lib/data/entities";
import { canCreate, canDelete, canUpdate, enforceOwner, filterReadable, type PolicyViewer } from "@/lib/data/policy";
import { sequencesFor } from "@/lib/data/sequences";
import { newId, nowISO, todayKeyIST } from "@/lib/format";
import type { ActivityEvent, ClientMasterRecord } from "@/lib/types";
import { toPolicyViewer } from "@/lib/server/records";
import { bulkUpsert, deleteRow, getScriptVersion, listAll, listTab, sheetsConfig, SheetsError, upsertRow } from "@/lib/server/sheets";

const MAX_BODY = 512 * 1024;
const MAX_BULK = 200;
const NO_STORE = { "Cache-Control": "no-store" };

type Row = Record<string, unknown>;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function sheetsErrorResponse(err: unknown) {
  if (err instanceof SheetsError) {
    if (err.code === "script_outdated") return json({ error: "script_outdated" }, 409);
    if (err.code === "too_large") return json({ error: "too_large" }, 413);
    if (err.code === "not_configured") return json({ error: "not_configured" }, 503);
    return json({ error: err.message }, err.status);
  }
  console.warn("/api/data failed (unexpected error)");
  return json({ error: "Something went wrong while talking to Google Sheets" }, 502);
}

// ---------------------------------------------------------------- activity copy

const NOUN: Record<RemoteEntity, string> = {
  deals: "deal",
  interactions: "visit",
  clients: "client",
  projects: "project",
  payments: "invoice",
  roster: "team member",
  repositories: "repository",
  posts: "post",
  campaigns: "campaign",
  drafts: "draft",
  activity: "activity",
  settings: "settings",
};

const ACTION_NOUN: Record<RemoteEntity, string> = {
  deals: "deal",
  interactions: "visit",
  clients: "client",
  projects: "project",
  payments: "invoice",
  roster: "roster",
  repositories: "repository",
  posts: "post",
  campaigns: "campaign",
  drafts: "draft",
  activity: "activity",
  settings: "settings",
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}

function labelOf(entity: RemoteEntity, row: Row): string {
  switch (entity) {
    case "deals":
    case "interactions":
    case "clients":
      return str(row.companyName);
    case "projects":
      return str(row.projectName);
    case "payments":
      return str(row.invoiceId) || str(row.companyName);
    case "roster":
      return str(row.developerName);
    case "repositories":
      return str(row.repository) || str(row.projectName);
    case "posts":
    case "drafts":
      return str(row.title);
    case "campaigns":
      return str(row.name);
    default:
      return "";
  }
}

function activityFor(pv: PolicyViewer, entity: RemoteEntity, verb: "created" | "updated" | "deleted", row: Row, existing: Row | null): ActivityEvent {
  const noun = NOUN[entity];
  const label = labelOf(entity, row);
  let action = `${ACTION_NOUN[entity]}.${verb}`;
  let summary =
    entity === "settings"
      ? "Updated settings"
      : `${verb === "created" ? "Added" : verb === "updated" ? "Updated" : "Deleted"} ${noun}${label ? ` ${label}` : ""}`;
  if (entity === "deals" && verb === "updated" && existing && str(existing.leadStatus) !== str(row.leadStatus) && str(row.leadStatus)) {
    action = "deal.stage_changed";
    summary = `Moved ${label || "a deal"} to ${str(row.leadStatus)}`;
  }
  if (entity === "payments" && verb === "updated" && existing) {
    const before = Array.isArray(existing.payments) ? existing.payments.length : 0;
    const after = Array.isArray(row.payments) ? row.payments.length : 0;
    if (after > before) {
      action = "invoice.payment_recorded";
      summary = `Recorded a payment on ${label || "an invoice"}`;
    }
  }
  return {
    id: newId("act"),
    at: nowISO(),
    actorId: pv.accountId,
    actorName: pv.name,
    action,
    entity,
    entityId: str(row.id),
    summary: summary.slice(0, 300),
  };
}

// ---------------------------------------------------------------- helpers

function isRow(v: unknown): v is Row {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function validId(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "" && v.length <= 200;
}

/**
 * The row to store: existing values, then the sent values, without `demo`; audit fields stamped by the
 * server; the owner field forced for members (enforceOwner).
 */
function prepare(pv: PolicyViewer, entity: RemoteEntity, sent: Row, existing: Row | null): Row {
  const now = nowISO();
  const merged: Row = { ...(existing ?? {}), ...sent };
  delete merged.demo;
  merged.id = existing ? existing.id : str(sent.id);
  if (entity !== "settings") {
    merged.createdAt = str(existing?.createdAt) || str(sent.createdAt) || now;
    merged.createdBy = str(existing?.createdBy) || str(sent.createdBy) || pv.accountId;
  } else {
    merged.updatedBy = pv.name;
  }
  merged.updatedAt = now;
  return enforceOwner(pv, entity, merged, existing);
}

async function readVersionGate(): Promise<Response | null> {
  const version = await getScriptVersion();
  if (version === 2) return null;
  if (version === 1) return json({ error: "script_outdated" }, 409);
  return json({ error: "Could not reach Google Sheet" }, 502);
}

// ---------------------------------------------------------------- GET

export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return json({ error: "unauthorized" }, 401);
  const pv = toPolicyViewer(viewer);
  const q = req.nextUrl.searchParams;
  const configured = sheetsConfig() !== null;

  if (q.get("status") !== null) {
    return json({ configured, version: configured ? await getScriptVersion() : null });
  }

  const all = q.get("entities");
  const one = q.get("entity");
  if (all !== "all" && one === null) return json({ error: "Ask for ?status, ?entities=all or ?entity=<name>" }, 400);
  if (one !== null && !isRemoteEntity(one)) return json({ error: "Unknown entity" }, 400);

  if (!configured) {
    return all === "all" ? json({ configured: false, version: null, data: {} }) : json({ configured: false, rows: [] });
  }

  try {
    if ((await getScriptVersion()) === 1) return json({ error: "script_outdated" }, 409);
    const data = await listAll(); // one call, shared 30 s cache
    const clients = (data.clients ?? []) as unknown as ClientMasterRecord[];
    if (all === "all") {
      const out: Partial<Record<RemoteEntity, Row[]>> = {};
      for (const entity of REMOTE_ENTITIES) {
        out[entity] = filterReadable(pv, entity, data[entity] ?? [], { clients });
      }
      return json({ configured: true, version: 2, data: out, fetchedAt: nowISO() });
    }
    const entity = one as RemoteEntity;
    return json({ configured: true, rows: filterReadable(pv, entity, data[entity] ?? [], { clients }) });
  } catch (err) {
    return sheetsErrorResponse(err);
  }
}

// ---------------------------------------------------------------- POST

export async function POST(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return json({ error: "unauthorized" }, 401);
  const pv = toPolicyViewer(viewer);
  if (!sheetsConfig()) return json({ error: "not_configured", configured: false }, 503);

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY) return json({ error: "too_large" }, 413);
  let body: unknown;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return json({ error: "too_large" }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!isRow(body)) return json({ error: "Invalid JSON" }, 400);

  const action = body.action;
  const entity = body.entity;
  if (!isRemoteEntity(entity)) return json({ error: "Unknown entity" }, 400);

  try {
    const gate = await readVersionGate();
    if (gate) return gate;

    switch (action) {
      case "upsert":
        return await handleUpsert(pv, entity, body.row);
      case "bulk_upsert":
        return await handleBulk(pv, entity, body.rows);
      case "delete":
        return await handleDelete(pv, entity, body.id);
      case "append":
        return await handleAppend(pv, entity, body.row);
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    return sheetsErrorResponse(err);
  }
}

async function handleUpsert(pv: PolicyViewer, entity: RemoteEntity, sent: unknown) {
  if (entity === "activity") return json({ error: "Use the append action for activity" }, 400);
  if (!isRow(sent) || !validId(sent.id)) return json({ error: "The row needs an id" }, 400);
  if (entity === "settings" && sent.id !== "settings") return json({ error: "The settings row id is 'settings'" }, 400);

  // Served from the shared listAll cache while it is fresh.
  const rows = await listTab(entity);
  const existing = rows.find((r) => r.id === sent.id) ?? null;
  if (existing ? !canUpdate(pv, entity, existing) : !canCreate(pv, entity)) return json({ error: "forbidden" }, 403);

  const next = prepare(pv, entity, sent, existing);
  const sequences = sequencesFor(entity, next, todayKeyIST());
  const activity = activityFor(pv, entity, existing ? "updated" : "created", next, existing);
  // Members never overwrite a row they could not see: a create is insert-only.
  const mode = existing || pv.category === "admin" ? "upsert" : "insert_only";
  const res = await upsertRow(entity, next, { mode, sequences, activity });
  if (res.skipped) return json({ error: "This record already exists. Refresh and try again." }, 409);
  return json({ success: true, row: res.row, created: res.created });
}

async function handleBulk(pv: PolicyViewer, entity: RemoteEntity, sent: unknown) {
  if (entity === "activity" || entity === "settings") return json({ error: "Bulk upload is not available for this entity" }, 400);
  if (!Array.isArray(sent)) return json({ error: "rows must be a list" }, 400);
  if (sent.length > MAX_BULK) return json({ error: `At most ${MAX_BULK} rows per request` }, 400);

  const rows = await listTab(entity);
  const byId = new Map(rows.map((r) => [String(r.id), r]));
  const member = pv.category !== "admin";
  const out: Row[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const r of sent) {
    if (!isRow(r) || !validId(r.id) || r.demo === true || seen.has(r.id)) {
      skipped++;
      continue;
    }
    seen.add(r.id);
    const existing = byId.get(r.id) ?? null;
    const allowed = existing ? !member && canUpdate(pv, entity, existing) : canCreate(pv, entity);
    if (!allowed) {
      skipped++;
      continue;
    }
    out.push(prepare(pv, entity, r, existing));
  }
  if (!out.length) return json({ success: true, upserted: 0, skipped });

  const res = await bulkUpsert(entity, out, member ? "insert_only" : "upsert");
  if (res.upserted > 0) {
    // One summary line instead of one per row; best effort.
    const ev: ActivityEvent = {
      id: newId("act"),
      at: nowISO(),
      actorId: pv.accountId,
      actorName: pv.name,
      action: `${ACTION_NOUN[entity]}.uploaded`,
      entity,
      entityId: "",
      summary: `Uploaded ${res.upserted} ${res.upserted === 1 ? NOUN[entity] : NOUN[entity] === "repository" ? "repositories" : `${NOUN[entity]}s`} from a device`,
    };
    try {
      await upsertRow("activity", ev, { mode: "insert_only" });
    } catch {
      // The upload itself succeeded; a missing summary line is not worth failing it.
    }
  }
  return json({ success: true, upserted: res.upserted, skipped: skipped + res.skipped });
}

async function handleDelete(pv: PolicyViewer, entity: RemoteEntity, id: unknown) {
  if (entity === "activity" || entity === "settings") return json({ error: "This entity cannot be deleted" }, 400);
  if (!validId(id)) return json({ error: "Missing id" }, 400);
  const rows = await listTab(entity);
  const existing = rows.find((r) => r.id === id);
  if (!existing) return json({ error: "not_found" }, 404);
  if (!canDelete(pv, entity, existing)) return json({ error: "forbidden" }, 403);
  const res = await deleteRow(entity, id, activityFor(pv, entity, "deleted", existing, existing));
  if (!res.deleted) return json({ error: "not_found" }, 404);
  return json({ success: true });
}

async function handleAppend(pv: PolicyViewer, entity: RemoteEntity, sent: unknown) {
  if (entity !== "activity") return json({ error: "append is only for activity" }, 400);
  if (!isRow(sent)) return json({ error: "Missing row" }, 400);
  const action = str(sent.action);
  if (!action || action.length > 80) return json({ error: "Missing action" }, 400);
  if (!isEntityKey(sent.entity)) return json({ error: "Unknown entity" }, 400);
  const ev: ActivityEvent = {
    id: validId(sent.id) ? sent.id : newId("act"),
    at: nowISO(),
    actorId: pv.accountId,
    actorName: pv.name,
    action,
    entity: sent.entity,
    entityId: str(sent.entityId).slice(0, 200),
    summary: str(sent.summary).slice(0, 500),
  };
  await upsertRow("activity", ev, { mode: "insert_only" });
  return json({ success: true });
}
