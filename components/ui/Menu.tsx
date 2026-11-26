"use client";

import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { focusableIn, useIsClient } from "./Dialog";

export interface MenuItem {
  label: string;
  onSelect?: () => void;
  href?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  tone?: "danger";
  disabled?: boolean;
  separatorBefore?: boolean;
}

/* ------------------------------------------------------------------ positioning */

/**
 * Places a fixed-position floating element under (or above, when there is no room) its anchor.
 * Writes styles directly in a layout effect, so the first paint is already in place and no
 * state is set from the effect.
 */
export function useAnchoredPosition(
  open: boolean,
  anchorRef: React.RefObject<HTMLElement | null>,
  floatRef: React.RefObject<HTMLElement | null>,
  opts: { align?: "start" | "end"; matchWidth?: boolean; ready?: boolean } = {}
) {
  const { align = "end", matchWidth = false, ready = true } = opts;
  useLayoutEffect(() => {
    if (!open || !ready) return;
    const place = () => {
      const a = anchorRef.current;
      const f = floatRef.current;
      if (!a || !f) return;
      const r = a.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (matchWidth) f.style.width = `${Math.round(r.width)}px`;
      const fw = f.offsetWidth;
      const fh = f.scrollHeight;
      let left = align === "end" ? r.right - fw : r.left;
      left = Math.max(8, Math.min(left, vw - fw - 8));
      const below = vh - r.bottom - 12;
      const above = r.top - 12;
      const up = fh > below && above > below;
      const room = Math.max(120, up ? above : below);
      f.style.left = `${Math.round(left)}px`;
      f.style.maxHeight = `${Math.round(Math.min(room, 420))}px`;
      f.style.top = up ? `${Math.round(Math.max(8, r.top - 4 - Math.min(fh, room)))}px` : `${Math.round(r.bottom + 4)}px`;
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, ready, align, matchWidth, anchorRef, floatRef]);
}

/** Closes a floating layer on a pointer press outside both refs. */
function useOutsidePress(open: boolean, refs: React.RefObject<HTMLElement | null>[], onOutside: () => void) {
  const cb = useRef(onOutside);
  useLayoutEffect(() => {
    cb.current = onOutside;
  });
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && refs.some((r) => r.current?.contains(t))) return;
      cb.current();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
    // refs is a list of stable ref objects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

/* ------------------------------------------------------------------ Menu */

export function Menu({
  label,
  items,
  trigger,
  align = "end",
  triggerClassName,
}: {
  label: string;
  items: MenuItem[];
  trigger?: React.ReactNode;
  align?: "start" | "end";
  triggerClassName?: string;
}) {
  const isClient = useIsClient();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const typed = useRef({ text: "", at: 0 });
  const menuId = useId();

  const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);

  useAnchoredPosition(open, triggerRef, menuRef, { align, ready: isClient });
  useOutsidePress(open, [triggerRef, menuRef], () => {
    setOpen(false);
    setActive(-1);
  });

  useEffect(() => {
    if (open && active >= 0) itemRefs.current[active]?.focus({ preventScroll: false });
  }, [open, active]);

  const openMenu = (at: "first" | "last") => {
    setOpen(true);
    setActive(at === "first" ? enabled[0] ?? -1 : enabled[enabled.length - 1] ?? -1);
  };
  const close = (returnFocus: boolean) => {
    setOpen(false);
    setActive(-1);
    if (returnFocus) triggerRef.current?.focus();
  };
  const move = (dir: 1 | -1) => {
    if (!enabled.length) return;
    const pos = enabled.indexOf(active);
    const next = pos < 0 ? (dir === 1 ? 0 : enabled.length - 1) : (pos + dir + enabled.length) % enabled.length;
    setActive(enabled[next]);
  };

  const onMenuKey = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(1);
        return;
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        return;
      case "Home":
        e.preventDefault();
        setActive(enabled[0] ?? -1);
        return;
      case "End":
        e.preventDefault();
        setActive(enabled[enabled.length - 1] ?? -1);
        return;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        close(true);
        return;
      case "Tab":
        close(false);
        return;
    }
    if (e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = e.timeStamp;
      const t = typed.current;
      t.text = now - t.at > 600 ? e.key.toLowerCase() : t.text + e.key.toLowerCase();
      t.at = now;
      const start = Math.max(0, enabled.indexOf(active));
      const order = [...enabled.slice(start + (t.text.length === 1 ? 1 : 0)), ...enabled.slice(0, start + (t.text.length === 1 ? 1 : 0))];
      const hit = order.find((i) => items[i].label.toLowerCase().startsWith(t.text));
      if (hit !== undefined) setActive(hit);
    }
  };

  const select = (it: MenuItem) => {
    if (it.disabled) return;
    close(!it.href);
    it.onSelect?.();
  };

  const plainTrigger = typeof trigger === "string";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={plainTrigger ? undefined : label}
        title={trigger ? undefined : label}
        className={triggerClassName ?? (trigger ? "btn btn-ghost btn-sm" : "icon-btn")}
        onClick={(e) => {
          e.stopPropagation();
          if (open) close(false);
          else openMenu("first");
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            openMenu("first");
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            openMenu("last");
          }
        }}
      >
        {trigger ?? <MoreHorizontal aria-hidden />}
      </button>
      {open &&
        isClient &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKey}
            onClick={(e) => e.stopPropagation()}
            style={{ position: "fixed", top: 0, left: 0 }}
            className="z-[80] min-w-[200px] max-w-[300px] overflow-y-auto rounded-[20px] bg-raised p-1.5 shadow-float animate-menu-in"
          >
            {items.map((it, i) => {
              const cls = `flex h-9 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[13.5px] outline-none transition-colors duration-150 ${
                it.disabled
                  ? "cursor-not-allowed text-ink-3"
                  : it.tone === "danger"
                  ? "text-negative hover:bg-coral-soft focus:bg-coral-soft"
                  : "text-ink hover:bg-surface-2 focus:bg-surface-2"
              } [@media(pointer:coarse)]:h-11`;
              const inner = (
                <>
                  {it.icon && (
                    <span aria-hidden className={`flex size-4 shrink-0 items-center justify-center [&>svg]:size-4 ${it.tone === "danger" ? "" : "text-ink-2"}`}>
                      {it.icon}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{it.label}</span>
                  {it.shortcut && <span className="ml-4 font-mono text-[11px] text-ink-3">{it.shortcut}</span>}
                </>
              );
              return (
                <React.Fragment key={`${it.label}-${i}`}>
                  {it.separatorBefore && i > 0 && <div role="separator" className="mx-2 my-1.5 h-px bg-line" />}
                  {it.href && !it.disabled ? (
                    <a
                      ref={(el) => {
                        itemRefs.current[i] = el;
                      }}
                      role="menuitem"
                      tabIndex={-1}
                      href={it.href}
                      target={/^https?:/.test(it.href) ? "_blank" : undefined}
                      rel={/^https?:/.test(it.href) ? "noopener noreferrer" : undefined}
                      className={cls}
                      onClick={() => select(it)}
                      onMouseEnter={() => setActive(i)}
                    >
                      {inner}
                    </a>
                  ) : (
                    <button
                      ref={(el) => {
                        itemRefs.current[i] = el;
                      }}
                      type="button"
                      role="menuitem"
                      tabIndex={-1}
                      aria-disabled={it.disabled || undefined}
                      className={cls}
                      onClick={() => select(it)}
                      onMouseEnter={() => !it.disabled && setActive(i)}
                    >
                      {inner}
                    </button>
                  )}
                </React.Fragment>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}

/* ------------------------------------------------------------------ Popover */

export function Popover({
  trigger,
  children,
  align = "start",
  label,
  triggerClassName = "btn btn-ghost btn-sm",
  panelClassName = "w-[300px]",
}: {
  trigger: React.ReactNode;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  align?: "start" | "end";
  label: string;
  triggerClassName?: string;
  panelClassName?: string;
}) {
  const isClient = useIsClient();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useAnchoredPosition(open, triggerRef, panelRef, { align, ready: isClient });
  useOutsidePress(open, [triggerRef, panelRef], () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const p = panelRef.current;
    (focusableIn(p)[0] ?? p)?.focus({ preventScroll: true });
  }, [open]);

  const triggerId = useId();
  // Looked up by id rather than through the ref: `close` is handed to children during render.
  const close = () => {
    setOpen(false);
    document.getElementById(triggerId)?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={triggerClassName}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger}
      </button>
      {open &&
        isClient &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label={label}
            tabIndex={-1}
            style={{ position: "fixed", top: 0, left: 0 }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                close();
              }
            }}
            className={`z-[80] max-w-[calc(100vw-16px)] overflow-y-auto rounded-[20px] bg-raised p-4 text-[14px] text-ink shadow-float outline-none animate-menu-in ${panelClassName}`}
          >
            {typeof children === "function" ? children(close) : children}
          </div>,
          document.body
        )}
    </>
  );
}
