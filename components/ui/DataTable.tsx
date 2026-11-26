"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { useOptionalHub } from "@/lib/hub/context";
import { useDensity, type Density } from "@/lib/prefs";
import { Menu, type MenuItem } from "./Menu";
import { Segmented } from "./primitives";

export interface TableColumn<T> {
  id: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
  width?: number | string;
  sortValue?: (row: T) => string | number | null | undefined;
  hideBelow?: "sm" | "md" | "lg";
  mono?: boolean;
  truncate?: boolean;
}

type SortState = { id: string; dir: "asc" | "desc" };

const HIDE: Record<NonNullable<TableColumn<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

const ALIGN = { left: "text-left", right: "text-right", center: "text-center" } as const;

function compare(a: string | number | null | undefined, b: string | number | null | undefined): number {
  const ae = a === null || a === undefined || a === "";
  const be = b === null || b === undefined || b === "";
  if (ae && be) return 0;
  if (ae) return 1; // blanks last in both directions
  if (be) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "en-IN", { numeric: true, sensitivity: "base" });
}

function isBlank(v: React.ReactNode): boolean {
  return v === null || v === undefined || v === "" || v === false;
}

/** Muted en dash for an empty cell. */
function cellContent(v: React.ReactNode): React.ReactNode {
  return isBlank(v) ? <span className="text-ink-3">–</span> : v;
}

/** Retry for a row whose last save did not reach Google Sheets. Reads the hub only when rendered. */
function HubRetry({ id }: { id: string }) {
  const hub = useOptionalHub();
  if (!hub) return null;
  const { data } = hub;
  return (
    <button
      type="button"
      className="font-medium text-negative underline underline-offset-2"
      onClick={(e) => {
        e.stopPropagation();
        void data.retrySync(id);
      }}
    >
      Retry
    </button>
  );
}

function Unsynced({ id, onRetry }: { id: string; onRetry?: () => void }) {
  return (
    <span className="mt-1 flex items-center gap-1.5 text-[12px] text-negative">
      <span aria-hidden className="dot dot-negative" />
      Not saved.
      {onRetry ? (
        <button
          type="button"
          className="font-medium underline underline-offset-2"
          onClick={(e) => {
            e.stopPropagation();
            onRetry();
          }}
        >
          Retry
        </button>
      ) : (
        <HubRetry id={id} />
      )}
    </span>
  );
}

export function DataTable<T>({
  caption,
  rows,
  columns,
  rowKey,
  onRowClick,
  selectedKey,
  flashKey,
  rowActions,
  empty,
  mobileCard,
  initialSort,
  density,
  footer,
  maxHeight,
  rowStatus,
  onRetry,
  rowLabel,
}: {
  caption: string;
  rows: readonly T[];
  columns: TableColumn<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  /** The matching row (by key, or `key:anything`) plays the saved-row flash when this changes. */
  flashKey?: string;
  rowActions?: (row: T) => MenuItem[];
  empty?: React.ReactNode;
  mobileCard?: (row: T) => React.ReactNode;
  initialSort?: SortState;
  density?: Density;
  footer?: React.ReactNode;
  maxHeight?: number | string;
  rowStatus?: (row: T) => "unsynced" | undefined;
  /** Overrides the hub's retrySync for unsynced rows (used outside the hub, e.g. the reference page). */
  onRetry?: (row: T) => void;
  /** Accessible name for a row's action menu. Defaults to 'Actions'. */
  rowLabel?: (row: T) => string;
}) {
  const [prefDensity] = useDensity();
  const dens = density ?? prefDensity;
  const [sort, setSort] = useState<SortState | null>(initialSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.id === sort.id);
    if (!col?.sortValue) return rows;
    const sv = col.sortValue;
    const out = [...rows].sort((a, b) => {
      const va = sv(a);
      const vb = sv(b);
      const blankA = va === null || va === undefined || va === "";
      const blankB = vb === null || vb === undefined || vb === "";
      if (blankA || blankB) return compare(va, vb);
      const c = compare(va, vb);
      return sort.dir === "asc" ? c : -c;
    });
    return out;
  }, [rows, columns, sort]);

  const toggleSort = (id: string) => {
    setSort((s) => (!s || s.id !== id ? { id, dir: "asc" } : s.dir === "asc" ? { id, dir: "desc" } : null));
  };

  const flashMatch = (k: string) => !!flashKey && (flashKey === k || flashKey.startsWith(`${k}:`));
  const visibleOnCard = columns.slice(1);

  if (rows.length === 0) {
    return (
      <div className="card overflow-hidden">
        {empty ?? <p className="px-6 py-12 text-center text-[13px] text-ink-3">Nothing to show yet.</p>}
        {footer && <div className="border-t border-line px-6 py-3 text-[13px] text-ink-3">{footer}</div>}
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Desktop and tablet: the table */}
      <div className="hidden overflow-auto px-2 pb-2 pt-4 md:block" style={maxHeight ? { maxHeight } : undefined}>
        <table className={`table ${dens === "compact" ? "table-compact" : ""}`}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort?.id === c.id;
                const ariaSort = c.sortValue ? (active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none") : undefined;
                const Caret = active ? (sort!.dir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
                return (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={ariaSort}
                    style={c.width !== undefined ? { width: c.width } : undefined}
                    className={`${ALIGN[c.align ?? "left"]} ${c.hideBelow ? HIDE[c.hideBelow] : ""}`}
                  >
                    {c.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.id)}
                        className={`-mx-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors hover:text-ink ${c.align === "right" ? "flex-row-reverse" : ""} ${
                          active ? "text-ink" : ""
                        }`}
                      >
                        {c.header}
                        <Caret aria-hidden className={`size-3.5 ${active ? "text-ink" : "text-ink-3/70"}`} />
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
              {rowActions && (
                <th scope="col" className="w-12 px-1">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const k = rowKey(row);
              const flash = flashMatch(k);
              const selected = selectedKey !== undefined && selectedKey !== null && selectedKey === k;
              const unsynced = rowStatus?.(row) === "unsynced";
              return (
                <tr
                  key={flash ? `${k}~${flashKey}` : k}
                  aria-selected={selected || undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === "Enter" && e.target === e.currentTarget) {
                            e.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  className={`${onRowClick ? "cursor-pointer focus-visible:-outline-offset-2" : ""} ${flash ? "animate-flash" : ""}`}
                >
                  {columns.map((c, ci) => {
                    const v = c.cell(row);
                    const titleText = c.truncate && (typeof v === "string" || typeof v === "number") ? String(v) : undefined;
                    return (
                      <td
                        key={c.id}
                        className={`${ALIGN[c.align ?? "left"]} ${c.align === "right" ? "tabular-nums" : ""} ${c.mono ? "font-mono" : ""} ${
                          c.hideBelow ? HIDE[c.hideBelow] : ""
                        } ${c.truncate ? "max-w-0" : ""} ${unsynced && ci === 0 ? "py-2" : ""}`}
                        style={c.width !== undefined ? { width: c.width } : undefined}
                      >
                        {c.truncate ? (
                          <span className="block truncate" title={titleText}>
                            {cellContent(v)}
                          </span>
                        ) : (
                          cellContent(v)
                        )}
                        {unsynced && ci === 0 && <Unsynced id={k} onRetry={onRetry ? () => onRetry(row) : undefined} />}
                      </td>
                    );
                  })}
                  {rowActions && (
                    <td className="w-12 px-1 text-right" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <Menu label={rowLabel ? `Actions for ${rowLabel(row)}` : "Actions"} items={rowActions(row)} triggerClassName="icon-btn icon-btn-sm" />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Phones: stacked cards with full-width tap targets */}
      <ul aria-label={caption} className="space-y-2 p-2 md:hidden">
        {sorted.map((row) => {
          const k = rowKey(row);
          const flash = flashMatch(k);
          const selected = selectedKey !== undefined && selectedKey !== null && selectedKey === k;
          const unsynced = rowStatus?.(row) === "unsynced";
          const content = mobileCard ? (
            mobileCard(row)
          ) : (
            <>
              <div className="text-[14px] font-medium text-ink">{cellContent(columns[0]?.cell(row))}</div>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                {visibleOnCard.map((c) => (
                  <React.Fragment key={c.id}>
                    <dt className="text-ink-3">{c.header}</dt>
                    <dd className={`min-w-0 truncate text-right text-ink ${c.mono ? "font-mono" : ""} ${c.align === "right" ? "tabular-nums" : ""}`}>
                      {cellContent(c.cell(row))}
                    </dd>
                  </React.Fragment>
                ))}
              </dl>
            </>
          );
          return (
            <li
              key={flash ? `${k}~${flashKey}` : k}
              className={`relative flex items-start gap-2 rounded-[18px] px-4 py-3.5 ${
                selected ? "bg-lime-soft shadow-[inset_0_0_0_1.5px_var(--color-lime)]" : "bg-surface-2"
              } ${flash ? "animate-flash" : ""}`}
            >
              <div
                className={`min-w-0 flex-1 ${onRowClick ? "cursor-pointer" : ""}`}
                role={onRowClick ? "button" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
              >
                {content}
                {unsynced && <Unsynced id={k} onRetry={onRetry ? () => onRetry(row) : undefined} />}
              </div>
              {rowActions && (
                <div className="-mr-1 -mt-0.5 shrink-0">
                  <Menu label={rowLabel ? `Actions for ${rowLabel(row)}` : "Actions"} items={rowActions(row)} triggerClassName="icon-btn icon-btn-sm" />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {footer && <div className="border-t border-line px-6 py-3 text-[13px] text-ink-3">{footer}</div>}
    </div>
  );
}

/** Per-viewer row density for every table. */
export function DensityToggle() {
  const [density, setDensity] = useDensity();
  return (
    <Segmented
      label="Row density"
      size="sm"
      value={density}
      onChange={setDensity}
      options={[
        { value: "default", label: "Default" },
        { value: "compact", label: "Compact" },
      ]}
    />
  );
}
