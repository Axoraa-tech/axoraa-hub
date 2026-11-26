"use client";

// One view failing must never take the sidebar, header or other views down with it.
// ViewBoundary wraps the active view (keyed on the view, so navigating away clears the error).
import React from "react";
import { catchError, type ErrorInfo } from "next/error";
import { Mail, RotateCw, TriangleAlert } from "lucide-react";
import { supportMailto } from "@/lib/company";
import type { ViewId } from "@/lib/views";

export interface ViewBoundaryProps {
  view: ViewId;
  /** The view's label, shown in the message. */
  label: string;
}

/** The coral-soft card shown in place of a view that threw. */
export function ViewErrorFallback({
  view,
  label,
  error,
  onRetry,
}: ViewBoundaryProps & { error?: unknown; onRetry: () => void }) {
  const detail = error instanceof Error && error.message ? error.message : null;
  const path = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "";
  const mail = supportMailto({
    subject: `Hub error – ${view}`,
    body: `What happened:\n\n\nSteps:\n\n\nPage: ${path}${detail ? `\nError: ${detail}` : ""}`,
  });

  return (
    <div role="alert" className="card animate-rise p-5 sm:p-6">
      <div className="flex flex-col gap-5 rounded-inset bg-coral-soft p-5 sm:flex-row sm:items-center sm:p-6">
        <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface text-negative">
          <TriangleAlert className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-medium tracking-[-0.02em] text-ink">This view failed to load.</h2>
          <p className="mt-1 text-[13px] text-ink-2">
            {label} hit an error. Your data is safe. Try again, and if it keeps happening, tell us what you were doing.
          </p>
          {detail && <p className="mt-2 break-words font-mono text-[12px] text-ink-3">{detail}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" className="btn btn-ink" onClick={onRetry}>
            <RotateCw aria-hidden />
            Retry
          </button>
          <a className="btn btn-ghost" href={mail}>
            <Mail aria-hidden />
            Email support
          </a>
        </div>
      </div>
    </div>
  );
}

function fallback(props: ViewBoundaryProps, { error, retry }: ErrorInfo) {
  return <ViewErrorFallback view={props.view} label={props.label} error={error} onRetry={retry} />;
}

/** Error boundary for one view: <ViewBoundary view={view} label={...}>{viewElement}</ViewBoundary>. */
export const ViewBoundary = catchError(fallback);
