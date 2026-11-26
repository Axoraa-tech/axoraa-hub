"use client";

// Axoraa chart set, drawn in the hub's own language: capsule columns, hatched ghost marks,
// a lime highlight with an ink value bubble, tick gauges, dot matrices and pill bars.
// Every chart has an accessible name, an sr-only table, and values on hover and keyboard focus.
import React, { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNow } from "@/lib/prefs";

/* ------------------------------------------------------------------ shared */

const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 330 * 60_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";

/** 'YYYY-MM-DD' for a timestamp, in India time. */
function istDayKey(ms: number): string {
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
}

/** Roving focus over a chart's marks: one tab stop, arrows move, the active value is announced. */
function useRoving(count: number) {
  const [active, setActive] = useState<number | null>(null);
  const onKeyDown = (e: React.KeyboardEvent, step = 1, rowStep?: number) => {
    if (!count) return;
    const cur = active ?? -1;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = Math.min(count - 1, cur + step);
    else if (e.key === "ArrowLeft") next = Math.max(0, cur < 0 ? 0 : cur - step);
    else if (e.key === "ArrowDown" && rowStep) next = Math.min(count - 1, cur + rowStep);
    else if (e.key === "ArrowUp" && rowStep) next = Math.max(0, cur - rowStep);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = count - 1;
    else if (e.key === "Escape") {
      setActive(null);
      return;
    }
    if (next !== null) {
      e.preventDefault();
      setActive(next);
    }
  };
  const onFocus = () => setActive((a) => (a === null ? 0 : a));
  const onBlur = () => setActive(null);
  return { active, setActive, onKeyDown, onFocus, onBlur };
}

/** Ink pill tooltip. On an ink card (`inverse`) it flips to a white pill. */
function Tip({
  title,
  lines,
  style,
  align = "center",
  inverse = false,
}: {
  title: React.ReactNode;
  lines: React.ReactNode[];
  style?: React.CSSProperties;
  align?: "center" | "start" | "end";
  inverse?: boolean;
}) {
  const shift = align === "start" ? "translate-x-0" : align === "end" ? "-translate-x-full" : "-translate-x-1/2";
  return (
    <div
      aria-hidden
      style={style}
      className={`pointer-events-none absolute z-20 ${shift} -translate-y-full whitespace-nowrap rounded-2xl px-3 py-2 text-[12px] leading-[1.35] shadow-float ${
        inverse ? "bg-white text-black" : "bg-ink text-white dark:bg-black dark:text-white dark:ring-1 dark:ring-white/10"
      }`}
    >
      <div className="font-medium">{title}</div>
      {lines.map((l, i) => (
        <div key={i} className={`tabular-nums ${inverse ? "text-black/60" : "text-white/70"}`}>
          {l}
        </div>
      ))}
    </div>
  );
}

/** Small round mark, one plain sentence. Used when a chart has nothing to draw. */
function ChartEmpty({ label, message, minHeight, onInk = false }: { label: string; message: string; minHeight?: number; onInk?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-6 text-center" style={{ minHeight }}>
      <span aria-hidden className={`inline-flex size-11 items-end justify-center gap-[3px] rounded-full pb-3 ${onInk ? "bg-white/10" : "bg-surface-2"}`}>
        <span className={`h-2 w-[5px] rounded-full ${onInk ? "bg-white/25" : "bg-ink/15"}`} />
        <span className="h-4 w-[5px] rounded-full bg-lime" />
        <span className={`h-3 w-[5px] rounded-full ${onInk ? "bg-white/25" : "bg-ink/15"}`} />
      </span>
      <p className={`max-w-[260px] text-[13px] leading-5 ${onInk ? "text-white/70" : "text-ink-2"}`}>
        <span className="sr-only">{label}: </span>
        {message}
      </p>
    </div>
  );
}

function tipAlign(i: number, n: number, edge = 2): "start" | "end" | "center" {
  return i < edge ? "start" : i > n - 1 - edge ? "end" : "center";
}
function tipLeft(i: number, n: number, edge = 2): string | number {
  return i < edge ? 0 : i > n - 1 - edge ? "100%" : "50%";
}

/** Colour set for a chart sitting on a white card, or on the ink hero card. */
function tones(onInk: boolean) {
  return onInk
    ? {
        grid: "border-white/10",
        base: "border-white/20",
        axis: "text-white/45",
        label: "text-white/50",
        labelHi: "font-medium text-white",
        ghost: "border-white/15",
        solid: "bg-white/85",
        bubble: "bg-white text-black",
        hover: "bg-white/[0.06]",
        target: "border-white/70",
        legend: "text-white/70",
      }
    : {
        grid: "border-line",
        base: "border-line-strong",
        axis: "text-ink-3",
        label: "text-ink-3",
        labelHi: "font-medium text-ink",
        ghost: "border-ink/15",
        solid: "bg-ink/85",
        bubble: "bg-ink text-white dark:bg-white dark:text-black",
        hover: "bg-surface-2",
        target: "border-ink",
        legend: "text-ink-2",
      };
}

/* ------------------------------------------------------------------ 1. ColumnChart */

export interface ColumnDatum {
  label: string;
  title: string;
  value: number;
  detail?: React.ReactNode;
  /** Bucket key ('YYYY-MM-DD', 'YYYY-MM' or 'YYYY-M'); used to find today's bucket. */
  key?: string;
  /** Marks the current bucket explicitly. */
  current?: boolean;
}

function isTodayBucket(d: ColumnDatum, todayKey: string): boolean {
  if (d.current) return true;
  if (!d.key || !todayKey) return false;
  if (d.key === todayKey) return true;
  const [y, m] = todayKey.split("-");
  return d.key === `${y}-${m}` || d.key === `${y}-${Number(m)}`;
}

/**
 * Capsule columns. Today's bucket is the lime pill with an ink value bubble; the rest carry the
 * hatch texture (or solid ink when a comparison period is drawn as hatched ghost pills beside
 * them). A target is a dashed ink line. Empty days are dashed slots; an empty period shows a
 * plain empty state instead of a row of slots.
 */
export function ColumnChart({
  data,
  highlight,
  highlightIndex,
  compare,
  target,
  format = (v) => String(v),
  height = 240,
  dark = false,
  showAxis = true,
  ariaLabel,
  seriesLabel = "This period",
  compareLabel = "Previous period",
  targetLabel = "Target",
  emptyLabel = "Nothing recorded for this period yet.",
}: {
  data: ColumnDatum[];
  /** Older name for highlightIndex. */
  highlight?: number;
  highlightIndex?: number;
  compare?: number[];
  target?: number;
  format?: (v: number) => string;
  height?: number;
  /** Set when the chart sits on the ink hero card. */
  dark?: boolean;
  showAxis?: boolean;
  ariaLabel: string;
  seriesLabel?: string;
  compareLabel?: string;
  targetLabel?: string;
  emptyLabel?: string;
}) {
  const now = useNow();
  const roving = useRoving(data.length);
  const t = tones(dark);
  // .hatch already follows the theme; .hatch-dark is for the ink hero card.
  const hatch = dark ? "hatch-dark" : "hatch";

  const todayKey = now ? istDayKey(now) : "";
  const hasKeys = data.some((d) => d.key);
  const todayIdx = data.findIndex((d) => isTodayBucket(d, todayKey));
  const peakIdx = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -Infinity) ? i : best), 0);
  // Today's bucket when it is in range; otherwise the peak, as the original chart did.
  // While the clock is unknown (server render) keyed data waits rather than jumping.
  const hi =
    highlightIndex ?? highlight ?? (todayIdx >= 0 ? todayIdx : !now && hasKeys ? -1 : data.length && data[peakIdx].value > 0 ? peakIdx : -1);

  const hasCompare = !!compare && compare.length > 0;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value), ...(compare ?? []), target ?? 0));
  const dense = data.length > 14;
  const every = dense ? Math.ceil(data.length / 8) : 1;
  const ints = data.every((d) => Number.isInteger(d.value));
  const ticks = ints && max <= 2 ? [1, 0] : [1, 0.5, 0];
  const active = roving.active;
  const isEmpty = !data.length || (data.every((d) => d.value <= 0) && !(compare ?? []).some((c) => c > 0));

  const tipFor = (i: number) => {
    const d = data[i];
    const lines: React.ReactNode[] = [`${seriesLabel}: ${format(d.value)}`];
    if (hasCompare && compare![i] !== undefined) lines.push(`${compareLabel}: ${format(compare![i])}`);
    if (d.detail) lines.push(d.detail);
    return lines;
  };
  const showLegend = hasCompare || target !== undefined;
  const gap = dense ? "gap-[3px]" : "gap-2 sm:gap-3";
  const pillW = hasCompare ? (dense ? "max-w-[7px]" : "max-w-[22px]") : dense ? "max-w-[14px]" : "max-w-[56px]";

  if (isEmpty) {
    return <ChartEmpty label={ariaLabel} message={emptyLabel} minHeight={height} onInk={dark} />;
  }

  return (
    <figure className="relative m-0 select-none">
      {showLegend && (
        <figcaption aria-hidden className={`mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] ${t.legend}`}>
          <span className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-4 rounded-full ${hasCompare ? t.solid : hatch}`} />
            {seriesLabel}
          </span>
          {hi >= 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-4 rounded-full bg-lime" />
              {todayIdx >= 0 && hi === todayIdx ? "Today" : "Highlighted"}
            </span>
          )}
          {hasCompare && (
            <span className="inline-flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-4 rounded-full ${hatch}`} />
              {compareLabel}
            </span>
          )}
          {target !== undefined && (
            <span className="inline-flex items-center gap-1.5">
              <span className={`inline-block h-0 w-4 border-t-2 border-dashed ${t.target}`} />
              {targetLabel} {format(target)}
            </span>
          )}
        </figcaption>
      )}
      <div
        role="group"
        tabIndex={0}
        aria-label={`${ariaLabel}. Use the arrow keys to read each value.`}
        onKeyDown={(e) => roving.onKeyDown(e)}
        onFocus={roving.onFocus}
        onBlur={roving.onBlur}
        onMouseLeave={() => roving.setActive(null)}
        className="relative rounded-2xl focus-visible:outline-offset-4"
      >
        <div className="relative" style={{ height }}>
          {/* gridlines and y labels (right side, like the original) */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {ticks.map((tk) => (
              <div key={tk} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${tk * 100}%` }}>
                <div className={`flex-1 border-t ${tk === 0 ? t.base : `${t.grid} border-dashed`}`} />
                {showAxis && <span className={`w-8 -translate-y-px text-right text-[11px] tabular-nums ${t.axis}`}>{format(max * tk)}</span>}
              </div>
            ))}
            {target !== undefined && target > 0 && (
              <div className={`absolute left-0 ${showAxis ? "right-10" : "right-0"} border-t-2 border-dashed ${t.target}`} style={{ bottom: `${(target / max) * 100}%` }} />
            )}
          </div>
          {/* columns */}
          <div className={`relative flex h-full items-end ${gap} ${showAxis ? "pr-10" : ""}`}>
            {data.map((d, i) => {
              const h = d.value > 0 ? Math.max(4, (d.value / max) * 100) : 0;
              const c = hasCompare ? compare![i] ?? 0 : 0;
              const ch = c > 0 ? Math.max(4, (c / max) * 100) : 0;
              const isHi = i === hi && d.value > 0;
              const isActive = i === active;
              const slot = dense ? 18 : 30;
              const tallest = Math.max(h || slot, ch);
              return (
                <div key={`${d.label}-${i}`} className="relative flex h-full flex-1 items-end justify-center gap-[3px]" onMouseEnter={() => roving.setActive(i)}>
                  {isActive && (
                    <div aria-hidden className={`absolute inset-y-0 left-1/2 w-full -translate-x-1/2 rounded-full ${dense ? "max-w-[18px]" : "max-w-[64px]"} ${t.hover}`} />
                  )}
                  {hasCompare && (
                    <div className={`relative flex h-full w-full ${pillW} items-end`}>
                      {ch > 0 ? (
                        <div
                          className={`w-full origin-bottom animate-grow-y rounded-full opacity-80 ${hatch}`}
                          style={{ height: `${ch}%`, animationDelay: `${i * 25}ms` }}
                        />
                      ) : (
                        <div className={`w-full rounded-full border-[1.5px] border-dashed ${t.ghost}`} style={{ height: `${slot / 2}%` }} />
                      )}
                    </div>
                  )}
                  <div className={`relative flex h-full w-full ${pillW} items-end justify-center`}>
                    {d.value > 0 ? (
                      <div
                        className={`w-full origin-bottom animate-grow-y rounded-full transition-[filter] ${
                          isHi ? "bg-lime" : hasCompare ? t.solid : hatch
                        } ${isActive ? "brightness-95" : ""}`}
                        style={{ height: `${h}%`, animationDelay: `${i * 25}ms` }}
                      />
                    ) : (
                      <div className={`w-full rounded-full border-[1.5px] border-dashed ${t.ghost}`} style={{ height: `${slot}%` }} />
                    )}
                    {isHi && !dense && !isActive && (
                      <span
                        aria-hidden
                        className={`absolute left-1/2 -translate-x-1/2 -translate-y-2 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${t.bubble}`}
                        style={{ bottom: `${h}%` }}
                      >
                        {format(d.value)}
                      </span>
                    )}
                  </div>
                  {isActive && (
                    <Tip
                      inverse={dark}
                      title={d.title}
                      lines={tipFor(i)}
                      align={tipAlign(i, data.length)}
                      style={{ bottom: `calc(${tallest}% + 10px)`, left: tipLeft(i, data.length) }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {/* x labels */}
        <div aria-hidden className={`mt-3 flex ${gap} ${showAxis ? "pr-10" : ""}`}>
          {data.map((d, i) => (
            <div
              key={`${d.label}-${i}`}
              className={`flex-1 truncate text-center text-[11.5px] tabular-nums ${i === hi ? t.labelHi : t.label} ${
                dense && i % every !== 0 && i !== hi ? "invisible" : ""
              }`}
            >
              {d.label}
            </div>
          ))}
        </div>
        <div aria-live="polite" className="sr-only">
          {active !== null && data[active] ? `${data[active].title}: ${tipFor(active).join(", ")}` : ""}
        </div>
      </div>
      <div className="sr-only"><table>
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">{seriesLabel}</th>
            {hasCompare && <th scope="col">{compareLabel}</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={`${d.label}-${i}`}>
              <th scope="row">{d.title}</th>
              <td>{format(d.value)}</td>
              {hasCompare && <td>{format(compare![i] ?? 0)}</td>}
            </tr>
          ))}
        </tbody>
      </table></div>
    </figure>
  );
}

/* ------------------------------------------------------------------ 2. FunnelChart */

/** Hatched pill bars per stage, the last (won) stage in lime, with stage-to-stage conversion. */
export function FunnelChart({
  steps,
  ariaLabel = "Pipeline by stage",
  emptyLabel = "No deals in the pipeline yet.",
}: {
  steps: { label: string; count: number }[];
  ariaLabel?: string;
  emptyLabel?: string;
}) {
  const max = Math.max(...steps.map((s) => s.count), 1);
  if (!steps.length || steps.every((s) => s.count <= 0)) {
    return <ChartEmpty label={ariaLabel} message={emptyLabel} minHeight={Math.max(160, steps.length * 46)} />;
  }
  return (
    <figure className="m-0">
      <div aria-hidden className="space-y-2.5">
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          const prev = i > 0 ? steps[i - 1].count : null;
          const conv = prev ? Math.round((s.count / prev) * 100) : null;
          return (
            <div key={s.label} className="grid grid-cols-[88px_1fr_64px] items-center gap-3 sm:grid-cols-[96px_1fr_72px]" title={`${s.label}: ${s.count}`}>
              <span className="truncate text-[13px] text-ink-2">{s.label}</span>
              <div className="relative h-9">
                {s.count > 0 ? (
                  <div
                    className={`h-full origin-left animate-grow-x rounded-full ${last ? "bg-lime" : "hatch"}`}
                    style={{ width: `${Math.max(6, (s.count / max) * 100)}%`, animationDelay: `${i * 70}ms` }}
                  />
                ) : (
                  <div className="h-full w-[12%] min-w-9 rounded-full border-[1.5px] border-dashed border-ink/15" />
                )}
              </div>
              <div className="text-right leading-tight">
                <div className="text-[15px] font-medium tabular-nums text-ink">{s.count}</div>
                {conv !== null && <div className="text-[11px] tabular-nums text-ink-3">{conv}%</div>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="sr-only"><table>
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Stage</th>
            <th scope="col">Count</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((s) => (
            <tr key={s.label}>
              <th scope="row">{s.label}</th>
              <td>{s.count}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </figure>
  );
}

/* ------------------------------------------------------------------ 3. Heatmap */

function dayIndex(key: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(key);
  if (!m) return null;
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS);
}

function keyFromIndex(idx: number): string {
  return new Date(idx * DAY_MS).toISOString().slice(0, 10);
}

function prettyDay(key: string): string {
  const idx = dayIndex(key);
  if (idx === null) return key;
  const wd = WEEKDAYS[(((idx + 3) % 7) + 7) % 7]; // 1970-01-01 was a Thursday
  return `${wd} ${Number(key.slice(8, 10))} ${MONTHS[Number(key.slice(5, 7)) - 1]}`;
}

/** Lime-to-ink in light; dim lime to full lime in dark. Level 0 is an empty ghost square. */
const HEAT_BG = [
  "bg-ink/[0.06]",
  "bg-lime/45 dark:bg-lime/15",
  "bg-lime dark:bg-lime/35",
  "bg-[color-mix(in_oklab,var(--color-lime),var(--color-ink)_42%)] dark:bg-lime/60",
  "bg-[color-mix(in_oklab,var(--color-lime),var(--color-ink)_70%)] dark:bg-lime/85",
  "bg-ink dark:bg-lime",
];

/** Weeks (columns) by Mon–Sun (rows), five steps. One tab stop; arrows move day by day or week by week. */
export function Heatmap({
  cells,
  ariaLabel,
  unit,
  size = "md",
  emptyLabel = "No days to show yet.",
}: {
  cells: { date: string; value: number }[];
  ariaLabel: string;
  unit: string;
  size?: "sm" | "md";
  emptyLabel?: string;
}) {
  const px = size === "sm" ? 10 : 12;
  const gap = 3;
  const radius = size === "sm" ? "rounded-[3px]" : "rounded-[4px]";
  const { grid, weeks, max, ordered } = useMemo(() => {
    const valid = cells
      .map((c) => ({ ...c, idx: dayIndex(c.date) }))
      .filter((c): c is { date: string; value: number; idx: number } => c.idx !== null)
      .sort((a, b) => a.idx - b.idx);
    if (!valid.length) return { grid: [] as ({ date: string; value: number } | null)[], weeks: 0, max: 0, ordered: [] as { date: string; value: number }[] };
    const first = valid[0].idx;
    const last = valid[valid.length - 1].idx;
    const weekday = (i: number) => (((i + 3) % 7) + 7) % 7; // Monday = 0
    const start = first - weekday(first);
    const end = last + (6 - weekday(last));
    const weeks = Math.round((end - start + 1) / 7);
    const byIdx = new Map(valid.map((c) => [c.idx, c]));
    const g: ({ date: string; value: number } | null)[] = [];
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const idx = start + w * 7 + d;
        const hit = byIdx.get(idx);
        g.push(hit ? { date: hit.date, value: hit.value } : idx >= first && idx <= last ? { date: keyFromIndex(idx), value: 0 } : null);
      }
    }
    return { grid: g, weeks, max: Math.max(0, ...valid.map((c) => c.value)), ordered: valid.map(({ date, value }) => ({ date, value })) };
  }, [cells]);

  const roving = useRoving(grid.length);
  const level = (v: number) => (v <= 0 || max <= 0 ? 0 : Math.min(5, Math.max(1, Math.ceil((v / max) * 5))));
  const active = roving.active !== null ? grid[roving.active] : null;
  const total = ordered.reduce((s, c) => s + c.value, 0);
  const daysActive = ordered.filter((c) => c.value > 0).length;

  // Month labels: first week column whose Monday starts a new month.
  const monthLabels: { col: number; label: string }[] = [];
  for (let w = 0; w < weeks; w++) {
    const cell = grid.slice(w * 7, w * 7 + 7).find(Boolean);
    if (!cell) continue;
    const m = Number(cell.date.slice(5, 7)) - 1;
    const prev = monthLabels[monthLabels.length - 1];
    if (!prev || MONTHS[m] !== prev.label) {
      if (!prev || w - prev.col >= 3) monthLabels.push({ col: w, label: MONTHS[m] });
    }
  }

  if (!grid.length) {
    return <ChartEmpty label={ariaLabel} message={emptyLabel} minHeight={7 * (px + gap) + 40} />;
  }

  return (
    <figure className="m-0">
      {/* The scroller's top padding leaves room for the tooltip; it sits over the content above
          without catching clicks. */}
      <div className="pointer-events-none -mt-14 overflow-x-auto pt-14 pb-1 no-scrollbar">
        <div
          role="group"
          tabIndex={0}
          aria-label={`${ariaLabel}. Use the arrow keys to move between days.`}
          onKeyDown={(e) => {
            // Columns are weeks: left/right move a week, up/down move a day.
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") roving.onKeyDown(e, 7);
            else if (e.key === "ArrowDown" || e.key === "ArrowUp") roving.onKeyDown(e, 1, 1);
            else roving.onKeyDown(e);
          }}
          onFocus={() => roving.setActive((a) => (a === null ? Math.max(0, grid.findLastIndex((c) => c !== null)) : a))}
          onBlur={roving.onBlur}
          onMouseLeave={() => roving.setActive(null)}
          className="pointer-events-auto relative inline-block rounded-xl focus-visible:outline-offset-4"
        >
          <div className="flex">
            <div aria-hidden className="mr-2 grid shrink-0 text-[11px] text-ink-3" style={{ gridTemplateRows: `18px repeat(7, ${px}px)`, rowGap: gap }}>
              <span />
              {WEEKDAYS.map((d, i) => (
                <span key={d} className="flex items-center leading-none" style={{ height: px }}>
                  {i % 2 === 0 ? d : ""}
                </span>
              ))}
            </div>
            <div className="relative">
              <div aria-hidden className="relative h-[18px] text-[11px] leading-none text-ink-3">
                {monthLabels.map((m) => (
                  <span key={`${m.col}-${m.label}`} className="absolute top-0" style={{ left: m.col * (px + gap) }}>
                    {m.label}
                  </span>
                ))}
              </div>
              <div aria-hidden className="mt-[3px] grid grid-flow-col" style={{ gridTemplateRows: `repeat(7, ${px}px)`, gridAutoColumns: `${px}px`, gap }}>
                {grid.map((c, i) =>
                  c ? (
                    <span
                      key={i}
                      onMouseEnter={() => roving.setActive(i)}
                      className={`block ${radius} transition-transform ${HEAT_BG[level(c.value)]} ${
                        roving.active === i ? "scale-110 outline-2 outline-offset-1 outline-ink outline-solid" : ""
                      }`}
                    />
                  ) : (
                    <span key={i} />
                  )
                )}
              </div>
              {active && roving.active !== null && (
                <Tip
                  title={prettyDay(active.date)}
                  lines={[`${active.value} ${unit}`]}
                  align={Math.floor(roving.active / 7) < 4 ? "start" : Math.floor(roving.active / 7) > weeks - 5 ? "end" : "center"}
                  style={{
                    left: Math.floor(roving.active / 7) * (px + gap) + px / 2,
                    top: 21 + (roving.active % 7) * (px + gap) - 6,
                  }}
                />
              )}
            </div>
          </div>
          <div aria-live="polite" className="sr-only">
            {active ? `${prettyDay(active.date)}: ${active.value} ${unit}` : ""}
          </div>
        </div>
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 text-[12px] text-ink-3">
        <span className="tabular-nums">
          {daysActive} of {ordered.length} days with {unit}, {Math.round(total * 10) / 10} {unit} in all
        </span>
        <span aria-hidden className="inline-flex items-center gap-1">
          Less
          {HEAT_BG.map((b) => (
            <span key={b} className={`inline-block ${radius} ${b}`} style={{ width: px, height: px }} />
          ))}
          More
        </span>
      </figcaption>
      <div className="sr-only"><table>
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">{unit}</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((c) => (
            <tr key={c.date}>
              <th scope="row">{prettyDay(c.date)}</th>
              <td>{c.value}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </figure>
  );
}

/* ------------------------------------------------------------------ 4. StackedBars */

const PART_META = {
  paid: { label: "Paid", bg: "bg-good" },
  due: { label: "Due", bg: "bg-amber" },
  overdue: { label: "Overdue", bg: "bg-coral" },
} as const;
const PART_ORDER = ["paid", "due", "overdue"] as const;

/** Collections per period as stacked pills: paid (green), due (amber), overdue (coral). */
export function StackedBars({
  data,
  ariaLabel,
  format = (v) => String(v),
  height = 240,
  emptyLabel = "No invoices in this period yet.",
}: {
  data: { label: string; title?: string; parts: { key: "paid" | "due" | "overdue"; value: number }[] }[];
  ariaLabel: string;
  format?: (v: number) => string;
  height?: number;
  emptyLabel?: string;
}) {
  const roving = useRoving(data.length);
  const totals = data.map((d) => d.parts.reduce((s, p) => s + Math.max(0, p.value), 0));
  const max = niceMax(Math.max(0, ...totals));
  const val = (d: (typeof data)[number], k: (typeof PART_ORDER)[number]) => d.parts.filter((p) => p.key === k).reduce((s, p) => s + Math.max(0, p.value), 0);
  const active = roving.active;
  const used = PART_ORDER.filter((k) => data.some((d) => val(d, k) > 0));
  const lines = (i: number) => [...PART_ORDER.map((k) => `${PART_META[k].label}: ${format(val(data[i], k))}`), `Total: ${format(totals[i])}`];

  if (!data.length || totals.every((x) => x <= 0)) {
    return <ChartEmpty label={ariaLabel} message={emptyLabel} minHeight={height} />;
  }

  return (
    <figure className="m-0 select-none">
      <figcaption aria-hidden className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-ink-2">
        {(used.length ? used : PART_ORDER).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-4 rounded-full ${PART_META[k].bg}`} />
            {PART_META[k].label}
          </span>
        ))}
      </figcaption>
      <div
        role="group"
        tabIndex={0}
        aria-label={`${ariaLabel}. Use the arrow keys to read each value.`}
        onKeyDown={(e) => roving.onKeyDown(e)}
        onFocus={roving.onFocus}
        onBlur={roving.onBlur}
        onMouseLeave={() => roving.setActive(null)}
        className="relative rounded-2xl focus-visible:outline-offset-4"
      >
        <div className="relative" style={{ height }}>
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {[1, 0.5, 0].map((tk) => (
              <div key={tk} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${tk * 100}%` }}>
                <div className={`flex-1 border-t ${tk === 0 ? "border-line-strong" : "border-dashed border-line"}`} />
                <span className="w-12 -translate-y-px text-right text-[11px] tabular-nums text-ink-3">{format(max * tk)}</span>
              </div>
            ))}
          </div>
          <div className="relative flex h-full items-end gap-2 pr-14 sm:gap-4">
            {data.map((d, i) => {
              const totalPct = totals[i] > 0 ? Math.max(4, (totals[i] / max) * 100) : 0;
              return (
                <div
                  key={`${d.label}-${i}`}
                  onMouseEnter={() => roving.setActive(i)}
                  className="relative flex h-full flex-1 items-end justify-center"
                >
                  {active === i && <div aria-hidden className="absolute inset-y-0 left-1/2 w-full max-w-[60px] -translate-x-1/2 rounded-full bg-surface-2" />}
                  {totals[i] > 0 ? (
                    <div
                      className="relative flex w-full max-w-[44px] origin-bottom animate-grow-y flex-col-reverse gap-[3px]"
                      style={{ height: `${totalPct}%`, animationDelay: `${i * 30}ms` }}
                    >
                      {PART_ORDER.map((k) => {
                        const v = val(d, k);
                        return v > 0 ? <div key={k} className={`min-h-[6px] basis-0 rounded-full ${PART_META[k].bg}`} style={{ flexGrow: v }} /> : null;
                      })}
                    </div>
                  ) : (
                    <div className="relative h-[24%] w-full max-w-[44px] rounded-full border-[1.5px] border-dashed border-ink/15" />
                  )}
                  {active === i && (
                    <Tip
                      title={d.title ?? d.label}
                      lines={lines(i)}
                      align={tipAlign(i, data.length, 1)}
                      style={{ bottom: `calc(${totalPct || 24}% + 10px)`, left: tipLeft(i, data.length, 1) }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div aria-hidden className="mt-3 flex gap-2 pr-14 sm:gap-4">
          {data.map((d, i) => (
            <div key={`${d.label}-${i}`} className={`flex-1 truncate text-center text-[11.5px] ${active === i ? "font-medium text-ink" : "text-ink-3"}`}>
              {d.label}
            </div>
          ))}
        </div>
        <div aria-live="polite" className="sr-only">
          {active !== null && data[active] ? `${data[active].title ?? data[active].label}: ${lines(active).join(", ")}` : ""}
        </div>
      </div>
      <div className="sr-only"><table>
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            {PART_ORDER.map((k) => (
              <th key={k} scope="col">
                {PART_META[k].label}
              </th>
            ))}
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={`${d.label}-${i}`}>
              <th scope="row">{d.title ?? d.label}</th>
              {PART_ORDER.map((k) => (
                <td key={k}>{format(val(d, k))}</td>
              ))}
              <td>{format(totals[i])}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </figure>
  );
}

/* ------------------------------------------------------------------ 5. DotMatrix */

/** Columns of dots; the peak column in ink, the rest softer, empty dots as ghosts. */
export function DotMatrix({
  data,
  rows = 6,
  unit = "",
  ariaLabel = "Activity by period",
}: {
  data: { label: string; title: string; value: number }[];
  rows?: number;
  unit?: string;
  ariaLabel?: string;
}) {
  const roving = useRoving(data.length);
  const max = Math.max(...data.map((d) => d.value), 1);
  const peak = data.reduce((b, d, i) => (d.value > (data[b]?.value ?? -Infinity) ? i : b), 0);
  const hasAny = data.some((d) => d.value > 0);
  return (
    <figure className="m-0">
      <div
        role="group"
        tabIndex={0}
        aria-label={`${ariaLabel}. Use the arrow keys to read each value.`}
        onKeyDown={(e) => roving.onKeyDown(e)}
        onFocus={roving.onFocus}
        onBlur={roving.onBlur}
        onMouseLeave={() => roving.setActive(null)}
        className="relative rounded-2xl focus-visible:outline-offset-4"
      >
        <div className="flex items-end justify-between gap-1">
          {data.map((d, i) => {
            const filled = d.value > 0 ? Math.max(1, Math.round((d.value / max) * rows)) : 0;
            const isPeak = hasAny && i === peak;
            return (
              <div key={d.label + i} className="relative flex flex-1 flex-col-reverse items-center gap-[5px]" onMouseEnter={() => roving.setActive(i)}>
                {Array.from({ length: rows }).map((_, r) => (
                  <span
                    key={r}
                    className={`size-2.5 rounded-full transition-colors sm:size-3 ${
                      r >= filled ? "bg-ink/[0.07]" : roving.active === i ? "bg-lime-deep" : isPeak ? "bg-ink" : "bg-ink/[0.38]"
                    }`}
                  />
                ))}
                {roving.active === i && <Tip title={d.title} lines={[`${d.value}${unit}`]} align={tipAlign(i, data.length, 1)} style={{ top: -8, left: tipLeft(i, data.length, 1) }} />}
              </div>
            );
          })}
        </div>
        <div aria-hidden className="mt-3 flex justify-between gap-1">
          {data.map((d, i) => (
            <span key={d.label + i} className={`flex-1 text-center text-[11.5px] ${hasAny && i === peak ? "font-medium text-ink" : "text-ink-3"}`}>
              {d.label}
            </span>
          ))}
        </div>
        <div aria-live="polite" className="sr-only">
          {roving.active !== null && data[roving.active] ? `${data[roving.active].title}: ${data[roving.active].value}${unit}` : ""}
        </div>
      </div>
      <div className="sr-only"><table>
        <caption>{ariaLabel}</caption>
        <tbody>
          {data.map((d, i) => (
            <tr key={d.label + i}>
              <th scope="row">{d.title}</th>
              <td>
                {d.value}
                {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </figure>
  );
}

/* ------------------------------------------------------------------ 6. TickGauge */

/**
 * Semicircle of ticks for a single percentage. Lit ticks take the card's text colour
 * (ink on white or lime cards, white on the ink card); `dark` lights them in lime instead.
 * The lit ticks sweep in on mount unless reduced motion is on.
 */
export function TickGauge({ value, ticks = 42, dark = false, ariaLabel }: { value: number; ticks?: number; dark?: boolean; ariaLabel?: string }) {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const on = Math.round((v / 100) * ticks);
  const cx = 110;
  const cy = 108;
  const litRef = useRef<SVGGElement>(null);

  useLayoutEffect(() => {
    const g = litRef.current;
    if (!g || typeof g.animate !== "function" || prefersReducedMotion()) return;
    const lines = Array.from(g.querySelectorAll("line"));
    const anims = lines.map((l, i) =>
      l.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 80 + i * 16, easing: EASE, fill: "backwards" })
    );
    return () => anims.forEach((a) => a.cancel());
  }, []);

  const tick = (i: number) => {
    const a = Math.PI - (i / (ticks - 1)) * Math.PI;
    const r1 = 78;
    const r2 = i % 5 === 0 ? 100 : 94;
    // Rounded so server and browser trig agree (unrounded floats differ in the last digits and break hydration).
    const r = (n: number) => Math.round(n * 100) / 100;
    return { x1: r(cx + r1 * Math.cos(a)), y1: r(cy - r1 * Math.sin(a)), x2: r(cx + r2 * Math.cos(a)), y2: r(cy - r2 * Math.sin(a)) };
  };

  return (
    <svg
      viewBox="0 0 220 120"
      className="h-auto w-full"
      role="img"
      aria-label={ariaLabel ? `${ariaLabel}: ${Math.round(v)}%` : `${Math.round(v)}%`}
    >
      <g className={dark ? "text-white" : ""} stroke="currentColor" strokeOpacity={dark ? 0.15 : 0.16}>
        {Array.from({ length: ticks }).map((_, i) => (i < on ? null : <line key={i} {...tick(i)} strokeWidth={3} strokeLinecap="round" />))}
      </g>
      <g ref={litRef} className={dark ? "text-lime" : ""} stroke="currentColor">
        {Array.from({ length: on }).map((_, i) => (
          <line key={i} {...tick(i)} strokeWidth={3} strokeLinecap="round" />
        ))}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ 7. SegmentMeter */

/** Pill slots: filled in the card's text colour (lime on the ink card), empty as dashed slots. */
export function SegmentMeter({
  value,
  total,
  slots = 10,
  dark = false,
  height = 48,
  ariaLabel,
}: {
  value: number;
  total: number;
  slots?: number;
  dark?: boolean;
  height?: number;
  ariaLabel?: string;
}) {
  const filled = total > 0 ? Math.max(0, Math.min(slots, Math.round((value / total) * slots))) : 0;
  return (
    <div role="img" aria-label={ariaLabel ?? `${value} of ${total}`} className="flex gap-1.5" style={{ height }}>
      {Array.from({ length: slots }).map((_, i) => (
        <div
          key={i}
          className={`flex-1 rounded-full ${
            i < filled
              ? `origin-bottom animate-grow-y ${dark ? "bg-lime" : "bg-current"}`
              : `border-[1.5px] border-dashed ${dark ? "border-white/20" : "border-current/20"}`
          }`}
          style={i < filled ? { animationDelay: `${i * 40}ms` } : undefined}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ 8. Sparkline */

/** Tiny trend line with a soft fill and an end dot. Uses the text colour unless `stroke` is set. */
export function Sparkline({
  values,
  width = 120,
  height = 36,
  stroke,
  fill = true,
  ariaLabel,
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: boolean;
  ariaLabel?: string;
}) {
  const rawId = useId();
  const gid = `spark-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const vals = values.length < 2 ? [0, ...values, 0] : values;
  const max = Math.max(...vals, 1);
  const step = width / (vals.length - 1);
  const pts = vals.map((v, i) => [i * step, height - 3 - (Math.max(0, v) / max) * (height - 6)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const color = stroke ?? "currentColor";
  const end = pts[pts.length - 1];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`overflow-visible ${stroke ? "" : "text-ink"}`}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.14" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${d} L${width},${height} L0,${height} Z`} fill={`url(#${gid})`} />
        </>
      )}
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={end[0]} cy={end[1]} r={3} fill={color} />
    </svg>
  );
}

/* ------------------------------------------------------------------ 9. SplitBar */

/** Status split as pill segments with small gaps. Callers pass the class for each part. */
export function SplitBar({
  parts,
  height = 12,
}: {
  parts: { key: string; value: number; className: string; label: string }[];
  height?: number;
}) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  if (!total) {
    return <div role="img" aria-label="No data" className="rounded-full border-[1.5px] border-dashed border-ink/15" style={{ height }} />;
  }
  return (
    <div className="flex gap-[3px]" style={{ height }} role="img" aria-label={parts.map((p) => `${p.label}: ${p.value}`).join(", ")}>
      {parts
        .filter((p) => p.value > 0)
        .map((p) => (
          <div
            key={p.key}
            title={`${p.label}: ${p.value}`}
            className={`origin-left animate-grow-x rounded-full ${p.className}`}
            style={{ width: `${(p.value / total) * 100}%` }}
          />
        ))}
    </div>
  );
}

/* ------------------------------------------------------------------ 10. RankedBars */

/** Thick progress bars, the leader in ink and the rest softer. */
export function RankedBars({
  items,
  format = (v) => String(v),
  ariaLabel = "Ranking",
  emptyLabel = "Nothing to rank for this period.",
}: {
  items: { label: string; value: number }[];
  format?: (v: number) => string;
  ariaLabel?: string;
  emptyLabel?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  if (!items.length) {
    return <ChartEmpty label={ariaLabel} message={emptyLabel} minHeight={140} />;
  }
  return (
    <figure className="m-0">
      <div aria-hidden className="space-y-3">
        {items.map((it, i) => (
          <div key={it.label}>
            <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
              <span className="truncate pr-3 text-ink-2">{it.label}</span>
              <span className="font-medium tabular-nums text-ink">{format(it.value)}</span>
            </div>
            <div className="h-2.5 rounded-full bg-surface-2">
              <div
                className={`h-full origin-left animate-grow-x rounded-full ${i === 0 ? "bg-ink" : "bg-ink/25"}`}
                style={{ width: `${Math.max(0, (it.value / max) * 100)}%`, animationDelay: `${i * 60}ms` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="sr-only"><table>
        <caption>{ariaLabel}</caption>
        <tbody>
          {items.map((it) => (
            <tr key={it.label}>
              <th scope="row">{it.label}</th>
              <td>{format(it.value)}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </figure>
  );
}
