import React from "react";

/* Soft surface-2 blocks shaped like the cards they stand in for; a gentle pulse, shown only after a short delay. */

function Bar({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`skeleton ${className}`} />;
}

/** Renders its children (a skeleton page by default) only once `delay` ms have passed. */
export function DelayedSkeleton({ delay = 300, children, label = "Loading" }: { delay?: number; children?: React.ReactNode; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="delay-reveal" style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}>
      <span className="sr-only">{label}</span>
      {children ?? <SkeletonPage />}
    </div>
  );
}

/** Stands in for a SummaryBand: a row of stat cards. */
export function SkeletonBand({ count = 5 }: { count?: number }) {
  return (
    <div aria-hidden className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none lg:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card flex min-h-[128px] flex-col justify-between p-5">
          <Bar className="h-3 w-24 rounded-full" />
          <div className="space-y-2.5">
            <Bar className="h-8 w-28" />
            <Bar className="h-3 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

const WIDTHS = ["w-2/5", "w-1/4", "w-1/5", "w-1/6", "w-1/12"];

/** Stands in for a DataTable: a card with rounded row placeholders. */
export function SkeletonRows({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div aria-hidden className="card overflow-hidden px-2 pb-2 pt-4">
      <div className="flex h-7 items-center gap-6 px-4">
        {Array.from({ length: columns }).map((_, c) => (
          <Bar key={c} className={`h-2.5 rounded-full ${c === 0 ? "w-24" : "w-14"}`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex h-12 items-center gap-6 border-t border-line px-4">
          <Bar className="size-7 shrink-0 rounded-full" />
          {Array.from({ length: columns }).map((_, c) => (
            <Bar key={c} className={`h-3 rounded-full ${WIDTHS[(c + r) % WIDTHS.length]} ${c === columns - 1 ? "ml-auto" : ""}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** A whole page: title row, stat cards, and a table card. */
export function SkeletonPage() {
  return (
    <div aria-hidden className="space-y-4 lg:space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Bar className="h-10 w-64 rounded-full" />
        <Bar className="h-10 w-28 rounded-full" />
        <Bar className="ml-auto h-10 w-44 rounded-full" />
      </div>
      <SkeletonBand />
      <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
        <div className="card h-[280px] p-5 lg:col-span-2">
          <Bar className="h-4 w-40 rounded-full" />
          <Bar className="mt-6 h-[190px] w-full rounded-[18px]" />
        </div>
        <div className="card h-[280px] p-5">
          <Bar className="h-4 w-28 rounded-full" />
          <Bar className="mx-auto mt-8 size-36 rounded-full" />
        </div>
      </div>
      <SkeletonRows />
    </div>
  );
}
