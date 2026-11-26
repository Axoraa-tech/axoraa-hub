// Who may read and write each entity. Isomorphic: the single source of truth for /api/data on the
// server and for can() in the browser.
//
// | entity               | admin     | founder                       | marketing          | developer |
// |----------------------|-----------|-------------------------------|--------------------|-----------|
// | deals, interactions  | rw all    | none                          | rw own (marketingPerson) | none |
// | clients              | rw        | rw own (salesOwner)           | none               | none      |
// | projects             | rw        | rw own (projectManager)       | none               | none      |
// | payments             | rw        | read where clientId ∈ own clients | none           | none      |
// | roster, repositories | rw        | read                          | read               | read      |
// | posts, campaigns     | rw        | none                          | rw (team-wide)     | none      |
// | drafts               | rw all    | rw own (createdBy = accountId)| rw own             | none      |
// | activity             | read all  | read own                      | read own           | read own  |
// | settings             | rw        | read                          | read               | read      |
// Anyone signed in may append activity. Deletes follow write, except clients, projects and payments (admin only).
import type { ClientMasterRecord } from "../types";
import type { ViewerCategory } from "../hub/types";
import { ENTITIES, type EntityKey } from "./entities";

export interface PolicyViewer {
  accountId: string;
  name: string;
  category: ViewerCategory;
}

type Row = Record<string, unknown>;
const rowOf = (r: object | null | undefined): Row => (r ?? {}) as Row;
const same = (a: unknown, b: string) => typeof a === "string" && a.trim().toLowerCase() === b.trim().toLowerCase() && b.trim() !== "";

const isAdmin = (pv: PolicyViewer) => pv.category === "admin";

/** Owner value a member gets on the rows they create. */
function ownerValue(pv: PolicyViewer, entity: EntityKey): string {
  return entity === "drafts" || entity === "activity" ? pv.accountId : pv.name;
}

function ownsRow(pv: PolicyViewer, entity: EntityKey, row: Row): boolean {
  const field = entity === "workLogs" ? "developerName" : ENTITIES[entity].ownerField;
  if (!field) return false;
  const v = row[field];
  return entity === "drafts" || entity === "activity" ? v === pv.accountId : same(v, pv.name);
}

export function canRead(pv: PolicyViewer, entity: EntityKey, row: object, ctx?: { ownClientIds?: Set<string> }): boolean {
  if (isAdmin(pv)) return true;
  const r = rowOf(row);
  const c = pv.category;
  switch (entity) {
    case "workLogs":
      return ownsRow(pv, entity, r);
    case "deals":
    case "interactions":
      return c === "marketing" && ownsRow(pv, entity, r);
    case "clients":
    case "projects":
      return c === "founder" && ownsRow(pv, entity, r);
    case "payments":
      return c === "founder" && typeof r.clientId === "string" && !!ctx?.ownClientIds?.has(r.clientId);
    case "roster":
    case "repositories":
    case "settings":
      return true;
    case "posts":
    case "campaigns":
      return c === "marketing";
    case "drafts":
      return (c === "founder" || c === "marketing") && ownsRow(pv, entity, r);
    case "activity":
      return ownsRow(pv, entity, r);
  }
}

export function canCreate(pv: PolicyViewer, entity: EntityKey): boolean {
  if (entity === "activity") return true;
  if (isAdmin(pv)) return true;
  const c = pv.category;
  switch (entity) {
    case "workLogs":
      return c !== "marketing";
    case "deals":
    case "interactions":
    case "posts":
    case "campaigns":
      return c === "marketing";
    case "clients":
    case "projects":
      return c === "founder";
    case "drafts":
      return c === "founder" || c === "marketing";
    default:
      return false;
  }
}

export function canUpdate(pv: PolicyViewer, entity: EntityKey, existing: object): boolean {
  if (entity === "activity") return false; // append-only
  if (isAdmin(pv)) return true;
  const r = rowOf(existing);
  const c = pv.category;
  switch (entity) {
    case "workLogs":
      return c !== "marketing" && ownsRow(pv, entity, r);
    case "deals":
    case "interactions":
      return c === "marketing" && ownsRow(pv, entity, r);
    case "clients":
    case "projects":
      return c === "founder" && ownsRow(pv, entity, r);
    case "posts":
    case "campaigns":
      return c === "marketing";
    case "drafts":
      return (c === "founder" || c === "marketing") && ownsRow(pv, entity, r);
    default:
      return false;
  }
}

export function canDelete(pv: PolicyViewer, entity: EntityKey, existing: object): boolean {
  if (entity === "activity") return false;
  if (entity === "clients" || entity === "projects" || entity === "payments") return isAdmin(pv);
  return canUpdate(pv, entity, existing);
}

/**
 * Members cannot reassign rows: on create the owner field is forced to the viewer (name, or account id
 * for drafts and activity); on update it is forced back to the existing value. Admin rows pass unchanged.
 */
export function enforceOwner<T extends object>(pv: PolicyViewer, entity: EntityKey, next: T, existing: object | null): T {
  if (isAdmin(pv)) return next;
  const field = ENTITIES[entity].ownerField;
  if (!field) return next;
  const out = { ...next } as Row;
  if (existing) out[field] = rowOf(existing)[field];
  else out[field] = ownerValue(pv, entity);
  return out as T;
}

/** Rows of one entity the viewer may read. Pass all clients so founders see invoices for their own clients. */
export function filterReadable<T extends object>(
  pv: PolicyViewer,
  entity: EntityKey,
  rows: T[],
  all?: { clients?: ClientMasterRecord[] | object[] }
): T[] {
  if (isAdmin(pv)) return rows;
  let ownClientIds: Set<string> | undefined;
  if (entity === "payments") {
    ownClientIds = new Set(
      ((all?.clients ?? []) as object[])
        .map(rowOf)
        .filter((c) => same(c.salesOwner, pv.name))
        .map((c) => c.clientId)
        .filter((id): id is string => typeof id === "string" && id !== "")
    );
  }
  return rows.filter((r) => canRead(pv, entity, r, { ownClientIds }));
}
