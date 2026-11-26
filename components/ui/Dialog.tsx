"use client";

import React, { useEffect, useEffectEvent, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/* ------------------------------------------------------------------ shared overlay plumbing */

const noopSubscribe = () => () => {};

/** False during SSR and hydration, true after; portals only render once this is true. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

export function focusableIn(el: HTMLElement | null): HTMLElement[] {
  if (!el) return [];
  return Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (n) => !n.hasAttribute("disabled") && n.getAttribute("aria-hidden") !== "true" && n.getClientRects().length > 0
  );
}

/** Stack of open modal layers so Escape and the focus trap only act on the top one. */
const layerStack: string[] = [];
let scrollLocks = 0;
let savedOverflow = "";
let savedPadding = "";

function lockScroll() {
  if (scrollLocks++ > 0) return;
  const body = document.body;
  const gap = window.innerWidth - document.documentElement.clientWidth;
  savedOverflow = body.style.overflow;
  savedPadding = body.style.paddingRight;
  body.style.overflow = "hidden";
  if (gap > 0) body.style.paddingRight = `${gap}px`;
}

function unlockScroll() {
  if (--scrollLocks > 0) return;
  scrollLocks = 0;
  document.body.style.overflow = savedOverflow;
  document.body.style.paddingRight = savedPadding;
}

/**
 * Keeps a layer mounted while its exit animation plays. Derived during render (no effect), and
 * the closing layer ignores pointer events so a missed animationend can never block the page.
 */
function usePresence(open: boolean) {
  const [mounted, setMounted] = useState(open);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setMounted(true);
  }
  const closing = mounted && !open;
  const onExited = () => {
    if (!open) setMounted(false);
  };
  return { mounted: mounted || open, closing, onExited };
}

function useModalLayer({
  open,
  onClose,
  panelRef,
  initialFocus,
}: {
  open: boolean;
  onClose: () => void;
  panelRef: React.RefObject<HTMLElement | null>;
  initialFocus?: React.RefObject<HTMLElement | null>;
}) {
  const layerId = useId();
  const handleClose = useEffectEvent(() => onClose());

  useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    layerStack.push(layerId);
    lockScroll();

    const panel = panelRef.current;
    const target =
      initialFocus?.current ??
      panel?.querySelector<HTMLElement>("[data-autofocus]") ??
      focusableIn(panel?.querySelector<HTMLElement>("[data-dialog-body]") ?? null)[0] ??
      panel;
    target?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (layerStack[layerStack.length - 1] !== layerId) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        handleClose();
        return;
      }
      if (e.key !== "Tab") return;
      const p = panelRef.current;
      const items = focusableIn(p);
      if (!p || items.length === 0) {
        e.preventDefault();
        p?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!p.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active === p)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      const i = layerStack.lastIndexOf(layerId);
      if (i >= 0) layerStack.splice(i, 1);
      unlockScroll();
      if (returnTo && returnTo.isConnected) returnTo.focus({ preventScroll: true });
    };
    // initialFocus and panelRef are refs; reading them inside the effect is intended.
  }, [open, layerId, panelRef, initialFocus]);
}

/* ------------------------------------------------------------------ Dialog */

const DIALOG_WIDTH = { sm: "sm:max-w-[420px]", md: "sm:max-w-[560px]", lg: "sm:max-w-[720px]" } as const;

/** White, 28px corners, pill footer. Slides up from the bottom edge on phones. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  size = "md",
  initialFocus,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Optional round lime badge beside the title. */
  icon?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  initialFocus?: React.RefObject<HTMLElement | null>;
}) {
  const isClient = useIsClient();
  const { mounted, closing, onExited } = usePresence(open);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useModalLayer({ open: open && isClient, onClose, panelRef, initialFocus });

  if (!isClient || !mounted) return null;
  return createPortal(
    <div className={`fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6 ${closing ? "pointer-events-none" : ""}`}>
      <div
        aria-hidden
        className={`absolute inset-0 bg-backdrop backdrop-blur-[2px] ${closing ? "animate-fade-out" : "animate-fade-in"}`}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget) onExited();
        }}
        className={`relative flex w-full ${DIALOG_WIDTH[size]} max-h-[min(92dvh,820px)] flex-col rounded-t-[28px] bg-raised shadow-float outline-none sm:rounded-[28px] ${
          closing ? "animate-dialog-out" : "animate-dialog-in"
        }`}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lime text-on-lime [&>svg]:h-5 [&>svg]:w-5">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h2 id={titleId} className="text-[22px] font-medium leading-tight tracking-[-0.03em] text-ink">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-1 text-[13px] text-ink-3">
                  {description}
                </p>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="icon-btn shrink-0">
            <X aria-hidden />
          </button>
        </div>
        {children !== undefined && children !== null && (
          <div data-dialog-body className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 text-[14px] text-ink-2 sm:px-7">
            {children}
          </div>
        )}
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-[28px] border-t border-line px-6 py-4 pb-[max(16px,env(safe-area-inset-bottom))] sm:px-7">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------ Sheet */

/** Full-height side drawer with 28px inner corners, sticky header and a round close button. */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "md",
  side = "right",
  headerActions,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  width?: "md" | "lg";
  side?: "right" | "left";
  headerActions?: React.ReactNode;
}) {
  const isClient = useIsClient();
  const { mounted, closing, onExited } = usePresence(open);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useModalLayer({ open: open && isClient, onClose, panelRef });

  if (!isClient || !mounted) return null;
  const left = side === "left";
  const anim = left
    ? closing
      ? "animate-sheet-out-left"
      : "animate-sheet-in-left"
    : closing
    ? "animate-sheet-out"
    : "animate-sheet-in";

  return createPortal(
    <div className={`fixed inset-0 z-[60] flex ${left ? "justify-start" : "justify-end"} ${closing ? "pointer-events-none" : ""}`}>
      <div
        aria-hidden
        className={`absolute inset-0 bg-backdrop backdrop-blur-[2px] ${closing ? "animate-fade-out" : "animate-fade-in"}`}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget) onExited();
        }}
        className={`relative flex h-dvh w-full flex-col overflow-hidden bg-raised shadow-float outline-none ${
          width === "lg" ? "md:max-w-[640px]" : "md:max-w-[480px]"
        } ${left ? "md:rounded-r-[28px]" : "md:rounded-l-[28px]"} ${anim}`}
      >
        <div className="sticky top-0 z-[1] flex items-start justify-between gap-3 bg-raised px-5 pb-4 pt-[max(20px,env(safe-area-inset-top))] md:px-6">
          <div className="min-w-0 py-1">
            <h2 id={titleId} className="truncate text-[20px] font-medium leading-tight tracking-[-0.03em] text-ink">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-[13px] text-ink-3">
                {description}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            <button type="button" onClick={onClose} aria-label="Close" className="icon-btn">
              <X aria-hidden />
            </button>
          </div>
        </div>
        <div data-dialog-body className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 md:px-6">
          {children}
        </div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-raised px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))] md:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
