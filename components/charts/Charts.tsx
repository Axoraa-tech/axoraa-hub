"use client";

import React, { useId, useState } from "react";

/* Shared tooltip bubble ------------------------------------------------------ */

function Tip({ title, lines, dark }: { title: string; lines: React.ReactNode[]; dark?: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full -mt-2 whitespace-nowrap rounded-2xl px-3 py-2 text-[12px] shadow-[var(--shadow-float)] ${
        dark ? "bg-white text-ink" : "bg-ink text-white"
      }`}
    >
      <div className="font-medium">{title}</div>
      {lines.map((l, i) => (
        <div key={i} className={dark ? "text-ink-2" : "text-white/70"}>
          {l}
        </div>
      ))}
    </div>
  );
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

/* 1. Capsule column chart ---------------------------------------------------- */

export interface ColumnDatum {
  label: string;
  title: string;
  value: number;
  detail?: React.ReactNode;
}

/**
 * Rounded capsule columns. The highlighted column is solid lime, the rest carry
 * the diagonal texture; empty days show as dashed slots so gaps read as "no activity".
 */
export function ColumnChart({
  data,
  highlight,
  format = (v) => String(v),
  height = 220,
  dark = false,
  showAxis = true,
}: {
  data: ColumnDatum[];
  highlight?: number;
  format?: (v: number) => string;
  height?: number;
  dark?: boolean;
  showAxis?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const hi = highlight ?? data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0);
  const dense = data.length > 14;
  const ints = data.every((d) => Number.isInteger(d.value));
  const ticks = ints && !Number.isInteger(max / 2) ? [1, 0] : [1, 0.5, 0];

  return (
    <div className="relative select-none">
      <div className="relative flex" style={{ height }}>
        {showAxis && (
          <div className="absolute inset-0 pointer-events-none">
            {ticks.map((t) => (
              <div key={t} className="absolute left-0 right-0 flex items-center gap-2" style={{ bottom: `${t * 100}%` }}>
                <div className={`flex-1 border-t ${dark ? "border-white/10" : "border-line"} ${t === 0 ? "" : "border-dashed"}`} />
                <span className={`text-[10.5px] tabular-nums w-8 text-right -translate-y-px ${dark ? "text-white/40" : "text-ink-3"}`}>
                  {format(max * t)}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className={`relative flex-1 flex items-end ${dense ? "gap-[3px]" : "gap-2 sm:gap-3"} ${showAxis ? "pr-10" : ""}`}>
          {data.map((d, i) => {
            const h = d.value > 0 ? Math.max(6, (d.value / max) * 100) : 0;
            const isHi = i === hi && d.value > 0;
            return (
              <div
                key={d.label + i}
                className="relative flex-1 h-full flex items-end justify-center"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                {d.value > 0 ? (
                  <div
                    className={`w-full ${dense ? "max-w-[14px]" : "max-w-[56px]"} rounded-full origin-bottom animate-grow-y transition-[filter] ${
                      isHi ? "bg-lime" : dark ? "hatch-dark" : "hatch"
                    } ${hover === i ? "brightness-95" : ""}`}
                    style={{ height: `${h}%`, animationDelay: `${i * 25}ms` }}
                  />
                ) : (
                  <div
                    className={`w-full ${dense ? "max-w-[14px]" : "max-w-[56px]"} rounded-full border-[1.5px] border-dashed ${
                      dark ? "border-white/15" : "border-ink/15"
                    }`}
                    style={{ height: dense ? "18%" : "30%" }}
                  />
                )}
                {isHi && !dense && (
                  <span
                    className={`absolute -translate-y-2 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${
                      dark ? "bg-white text-ink" : "bg-ink text-white"
                    }`}
                    style={{ bottom: `${h}%` }}
                  >
                    {format(d.value)}
                  </span>
                )}
                {hover === i && (
                  <div className="absolute left-1/2" style={{ bottom: `${Math.max(h, dense ? 18 : 30)}%` }}>
                    <Tip title={d.title} lines={[format(d.value), ...(d.detail ? [d.detail] : [])]} dark={dark} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className={`flex ${dense ? "gap-[3px]" : "gap-2 sm:gap-3"} ${showAxis ? "pr-10" : ""} mt-3`}>
        {data.map((d, i) => (
          <div
            key={d.label + i}
            className={`flex-1 text-center text-[11px] tabular-nums ${
              i === hi ? (dark ? "text-white" : "text-ink font-medium") : dark ? "text-white/45" : "text-ink-3"
            } ${dense && i % 3 !== 0 && i !== data.length - 1 ? "invisible" : ""}`}
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* 2. Funnel ---------------------------------------------------------------- */

export function FunnelChart({ steps }: { steps: { label: string; count: number }[] }) {
  const max = Math.max(...steps.map((s) => s.count), 1);
  return (
    <div className="space-y-2.5">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const prev = i > 0 ? steps[i - 1].count : null;
        const conv = prev ? Math.round((s.count / prev) * 100) : null;
        return (
          <div key={s.label} className="grid grid-cols-[88px_1fr_64px] items-center gap-3">
            <span className="text-[13px] text-ink-2 truncate">{s.label}</span>
            <div className="h-9 rounded-full bg-transparent relative">
              <div
                className={`h-full rounded-full origin-left animate-grow-x ${last ? "bg-lime" : "hatch"}`}
                style={{ width: `${Math.max(s.count ? 6 : 0, (s.count / max) * 100)}%`, animationDelay: `${i * 70}ms` }}
              />
            </div>
            <div className="text-right leading-tight">
              <div className="text-[15px] font-medium tabular-nums">{s.count}</div>
              {conv !== null && <div className="text-[10.5px] text-ink-3 tabular-nums">{conv}%</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* 3. Dot matrix -------------------------------------------------------------- */

export function DotMatrix({
  data,
  rows = 6,
  unit = "",
}: {
  data: { label: string; title: string; value: number }[];
  rows?: number;
  unit?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 1);
  const peak = data.reduce((b, d, i) => (d.value > data[b].value ? i : b), 0);
  return (
    <div className="relative">
      <div className="flex items-end justify-between gap-1">
        {data.map((d, i) => {
          const filled = d.value > 0 ? Math.max(1, Math.round((d.value / max) * rows)) : 0;
          return (
            <div
              key={d.label + i}
              className="relative flex flex-col-reverse items-center gap-[5px] flex-1"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {Array.from({ length: rows }).map((_, r) => (
                <span
                  key={r}
                  className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-colors ${
                    r < filled ? (i === peak ? "bg-ink" : "bg-ink/35") : "bg-ink/[0.07]"
                  }`}
                />
              ))}
              {hover === i && (
                <div className="absolute left-1/2 top-0">
                  <Tip title={d.title} lines={[`${d.value}${unit}`]} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between gap-1 mt-3">
        {data.map((d, i) => (
          <span key={d.label + i} className={`flex-1 text-center text-[11px] ${i === peak ? "text-ink font-medium" : "text-ink-3"}`}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* 4. Tick gauge -------------------------------------------------------------- */

export function TickGauge({ value, ticks = 42, dark = false }: { value: number; ticks?: number; dark?: boolean }) {
  const v = Math.max(0, Math.min(100, value));
  const on = Math.round((v / 100) * ticks);
  const cx = 110;
  const cy = 108;
  return (
    <svg viewBox="0 0 220 120" className="w-full h-auto" role="img" aria-label={`${v}%`}>
      {Array.from({ length: ticks }).map((_, i) => {
        const a = Math.PI - (i / (ticks - 1)) * Math.PI;
        const r1 = 78;
        const r2 = i % 5 === 0 ? 100 : 94;
        return (
          <line
            key={i}
            x1={cx + r1 * Math.cos(a)}
            y1={cy - r1 * Math.sin(a)}
            x2={cx + r2 * Math.cos(a)}
            y2={cy - r2 * Math.sin(a)}
            strokeWidth={3}
            strokeLinecap="round"
            stroke={i < on ? (dark ? "#d4ff32" : "#0e0e0f") : dark ? "rgba(255,255,255,0.14)" : "rgba(14,14,15,0.16)"}
          />
        );
      })}
    </svg>
  );
}

/* 5. Segment meter (pill slots) -------------------------------------------- */

export function SegmentMeter({ value, total, slots = 10, dark = false, height = 48 }: { value: number; total: number; slots?: number; dark?: boolean; height?: number }) {
  const filled = total > 0 ? Math.round((value / total) * slots) : 0;
  return (
    <div className="flex gap-1.5" style={{ height }}>
      {Array.from({ length: slots }).map((_, i) => (
        <div
          key={i}
          className={`flex-1 rounded-full origin-bottom animate-grow-y ${
            i < filled ? (dark ? "bg-lime" : "bg-ink") : dark ? "border-[1.5px] border-dashed border-white/20" : "dashed-slot"
          }`}
          style={{ animationDelay: `${i * 40}ms` }}
        />
      ))}
    </div>
  );
}

/* 6. Sparkline --------------------------------------------------------------- */

export function Sparkline({ values, width = 120, height = 36, stroke = "#0e0e0f", fill = true }: { values: number[]; width?: number; height?: number; stroke?: string; fill?: boolean }) {
  const id = useId();
  if (values.length < 2) values = [0, ...values, 0];
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => [i * step, height - 3 - (v / max) * (height - 6)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" aria-hidden>
      {fill && (
        <>
          <defs>
            <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={stroke} stopOpacity="0.14" />
              <stop offset="1" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${d} L${width},${height} L0,${height} Z`} fill={`url(#${id})`} />
        </>
      )}
      <path d={d} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={3} fill={stroke} />
    </svg>
  );
}

/* 7. Stacked horizontal bar (status split) ------------------------------------ */

export function SplitBar({
  parts,
  height = 12,
}: {
  parts: { key: string; value: number; className: string; label: string }[];
  height?: number;
}) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (!total) return <div className="rounded-full dashed-slot" style={{ height }} />;
  return (
    <div className="flex gap-[3px]" style={{ height }}>
      {parts
        .filter((p) => p.value > 0)
        .map((p) => (
          <div
            key={p.key}
            title={`${p.label}: ${p.value}`}
            className={`rounded-full origin-left animate-grow-x ${p.className}`}
            style={{ width: `${(p.value / total) * 100}%` }}
          />
        ))}
    </div>
  );
}

/* 8. Ranked bars (horizontal, single series) --------------------------------- */

export function RankedBars({ items, format = (v) => String(v) }: { items: { label: string; value: number }[]; format?: (v: number) => string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={it.label}>
          <div className="flex items-center justify-between text-[12.5px] mb-1.5">
            <span className="text-ink-2 truncate pr-3">{it.label}</span>
            <span className="tabular-nums font-medium">{format(it.value)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-surface-2">
            <div
              className={`h-full rounded-full origin-left animate-grow-x ${i === 0 ? "bg-ink" : "bg-ink/25"}`}
              style={{ width: `${(it.value / max) * 100}%`, animationDelay: `${i * 60}ms` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
