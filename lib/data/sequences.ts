// Human-readable numbers (lead IDs, client and project IDs, invoice and quotation numbers).
// Isomorphic: local mode fills them in the browser, shared mode sends the specs to the Apps Script,
// which fills them under its lock with the same rule.
import { fyOf } from "../format";
import type { EntityKey } from "./entities";

export interface SequenceSpec {
  field: string;
  prefix: string;
  /** Minimum digits; 0 means no padding. */
  pad: number;
  start: number;
}

const blankOrAuto = (v: unknown) => v === undefined || v === null || (typeof v === "string" && (v.trim() === "" || v.trim().toLowerCase() === "auto"));
const isAuto = (v: unknown) => typeof v === "string" && v.trim().toLowerCase() === "auto";

/** Specs for the record's sequence fields that are blank or 'auto'. A quotation number is only issued for 'auto'. */
export function sequencesFor(entity: EntityKey, record: object, todayKey: string): SequenceSpec[] {
  const r = record as Record<string, unknown>;
  const fy = fyOf(todayKey).label;
  const out: SequenceSpec[] = [];
  switch (entity) {
    case "deals":
      if (blankOrAuto(r.leadId)) out.push({ field: "leadId", prefix: "LD-", pad: 0, start: 1001 });
      if (isAuto(r.quoteNumber)) out.push({ field: "quoteNumber", prefix: `AXQ/${fy}/`, pad: 3, start: 1 });
      break;
    case "clients":
      // Three digits, matching the existing SF-001 / PRJ-001 style.
      if (blankOrAuto(r.clientId)) out.push({ field: "clientId", prefix: "CL-", pad: 3, start: 1 });
      break;
    case "projects":
      if (blankOrAuto(r.projectId)) out.push({ field: "projectId", prefix: "PR-", pad: 3, start: 1 });
      break;
    case "payments":
      if (blankOrAuto(r.invoiceId)) out.push({ field: "invoiceId", prefix: `AX/${fy}/`, pad: 3, start: 1 });
      break;
  }
  return out;
}

/** Largest numeric suffix among rows whose field starts with the prefix, plus one (never below start). */
export function nextSequence(rows: readonly object[], spec: SequenceSpec): string {
  let max = spec.start - 1;
  for (const row of rows) {
    const v = (row as Record<string, unknown>)[spec.field];
    if (typeof v !== "string" && typeof v !== "number") continue;
    const str = String(v).trim();
    if (!str.startsWith(spec.prefix)) continue;
    const rest = str.slice(spec.prefix.length);
    if (!/^\d+$/.test(rest)) continue;
    const num = Number(rest);
    if (num > max) max = num;
  }
  const next = max + 1;
  return spec.prefix + (spec.pad > 0 ? String(next).padStart(spec.pad, "0") : String(next));
}

/** Fills every spec on a copy of the record from the given rows (local mode). */
export function applySequences<T extends object>(record: T, rows: readonly object[], specs: SequenceSpec[]): T {
  const out = { ...record } as Record<string, unknown>;
  for (const spec of specs) out[spec.field] = nextSequence(rows, spec);
  return out as T;
}
