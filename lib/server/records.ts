import "server-only";

// Reads shared records for one viewer: the shared listAll cache plus the policy filter.
import type { Viewer } from "@/lib/auth/dal";
import { filterReadable, type PolicyViewer } from "@/lib/data/policy";
import type { RemoteEntity } from "@/lib/data/entities";
import type { ClientMasterRecord } from "@/lib/types";
import { listAll } from "./sheets";

/** The policy view of a signed-in viewer (the admin account is category 'admin'). */
export function toPolicyViewer(viewer: Viewer): PolicyViewer {
  return {
    accountId: viewer.account.id,
    name: viewer.account.name,
    category: viewer.isAdmin ? "admin" : viewer.account.category,
  };
}

/** Rows of one entity the viewer may read. */
export async function loadReadable(pv: PolicyViewer, entity: RemoteEntity): Promise<Record<string, unknown>[]> {
  const data = await listAll();
  const rows = data[entity] ?? [];
  return filterReadable(pv, entity, rows, { clients: (data.clients ?? []) as unknown as ClientMasterRecord[] });
}

/** One row by id, or null when it does not exist or the viewer may not read it. */
export async function getReadable(pv: PolicyViewer, entity: RemoteEntity, id: string): Promise<Record<string, unknown> | null> {
  const rows = await loadReadable(pv, entity);
  return rows.find((r) => r.id === id) ?? null;
}
