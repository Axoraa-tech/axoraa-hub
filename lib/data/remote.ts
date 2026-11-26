// Browser client for /api/data (shared records through the v2 Apps Script).
// Every call resolves; nothing throws and nothing logs, so a missing route simply means local mode.
import type { ActivityEvent } from "../types";
import type { RemoteEntity } from "./entities";

const ENDPOINT = "/api/data";

type Failure = { ok: false; error: string; status: number };

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await res.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function failure(status: number, body: Record<string, unknown>): Failure {
  const error = typeof body.error === "string" && body.error ? body.error : status ? `HTTP ${status}` : "network";
  return { ok: false, error, status };
}

async function post(payload: object): Promise<{ res: Response | null; body: Record<string, unknown> }> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    return { res, body: await readJson(res) };
  } catch {
    return { res: null, body: { error: "Could not reach the server" } };
  }
}

/** Any non-200 answer (including 404 before the route exists) means "not configured". */
export async function remoteStatus(): Promise<{ configured: boolean; version: 1 | 2 | null }> {
  try {
    const res = await fetch(`${ENDPOINT}?status`, { cache: "no-store" });
    if (res.status !== 200) return { configured: false, version: null };
    const body = await readJson(res);
    const version = body.version === 2 ? 2 : body.version === 1 ? 1 : null;
    return { configured: body.configured === true, version };
  } catch {
    return { configured: false, version: null };
  }
}

export async function remoteListAll(): Promise<
  { ok: true; data: Partial<Record<RemoteEntity, Record<string, unknown>[]>>; fetchedAt: string } | Failure
> {
  try {
    const res = await fetch(`${ENDPOINT}?entities=all`, { cache: "no-store" });
    const body = await readJson(res);
    if (res.status !== 200) return failure(res.status, body);
    if (body.configured === false) return { ok: false, error: "not_configured", status: 200 };
    const data = body.data && typeof body.data === "object" ? (body.data as Partial<Record<RemoteEntity, Record<string, unknown>[]>>) : {};
    const fetchedAt = typeof body.fetchedAt === "string" ? body.fetchedAt : new Date().toISOString();
    return { ok: true, data, fetchedAt };
  } catch {
    return { ok: false, error: "Could not reach the server", status: 0 };
  }
}

export async function remoteUpsert<T>(entity: RemoteEntity, row: object): Promise<{ ok: true; row: T } | Failure> {
  const { res, body } = await post({ action: "upsert", entity, row });
  if (!res) return failure(0, body);
  if (res.status !== 200 || body.success !== true) return failure(res.status, body);
  return { ok: true, row: (body.row ?? row) as T };
}

export async function remoteBulkUpsert(
  entity: RemoteEntity,
  rows: object[]
): Promise<{ ok: true; upserted: number; skipped: number } | Failure> {
  const { res, body } = await post({ action: "bulk_upsert", entity, rows });
  if (!res) return failure(0, body);
  if (res.status !== 200 || body.success !== true) return failure(res.status, body);
  return { ok: true, upserted: Number(body.upserted) || 0, skipped: Number(body.skipped) || 0 };
}

export async function remoteDelete(entity: RemoteEntity, id: string): Promise<{ ok: true } | Failure> {
  const { res, body } = await post({ action: "delete", entity, id });
  if (!res) return failure(0, body);
  if (res.status !== 200 || body.success !== true) return failure(res.status, body);
  return { ok: true };
}

/** Fire-and-forget: the server stamps actor and time. Failures are ignored. */
export async function remoteAppendActivity(row: Partial<ActivityEvent>): Promise<void> {
  await post({ action: "append", entity: "activity", row });
}
