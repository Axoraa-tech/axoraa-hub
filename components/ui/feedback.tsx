"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Dialog, useIsClient } from "./Dialog";

export interface ToastInput {
  message: string;
  tone?: "neutral" | "positive" | "negative";
  action?: { label: string; onClick: () => void };
  duration?: number;
}

export interface ConfirmOptions {
  title: string;
  body?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
}

interface ToastItem extends ToastInput {
  id: number;
}

interface FeedbackValue {
  toast: (t: ToastInput) => void;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackValue | null>(null);

const MAX_TOASTS = 3;

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const isClient = useIsClient();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setToasts((list) => list.filter((x) => x.id !== id));
  }, []);

  const schedule = useCallback(
    (id: number, ms: number) => {
      const prev = timers.current.get(id);
      if (prev) clearTimeout(prev);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), ms)
      );
    },
    [dismiss]
  );

  const toast = useCallback(
    (t: ToastInput) => {
      const id = ++seq.current;
      const ms = t.duration ?? (t.action ? 8000 : 5000);
      setToasts((list) => [...list, { ...t, id, duration: ms }].slice(-MAX_TOASTS));
      schedule(id, ms);
    },
    [schedule]
  );

  /* confirm */
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending((prev) => {
        prev?.resolve(false);
        return { ...o, resolve };
      });
      setConfirmOpen(true);
    });
  }, []);

  const settle = (v: boolean) => {
    pending?.resolve(v);
    setConfirmOpen(false);
  };

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);
  const danger = pending?.tone === "danger";

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {pending && (
        <Dialog
          open={confirmOpen}
          onClose={() => settle(false)}
          title={pending.title}
          size="sm"
          initialFocus={danger ? cancelRef : confirmRef}
          footer={
            <>
              <button ref={cancelRef} type="button" className="btn btn-ghost" onClick={() => settle(false)}>
                {pending.cancelLabel ?? "Cancel"}
              </button>
              <button ref={confirmRef} type="button" className={`btn ${danger ? "btn-danger" : "btn-ink"}`} onClick={() => settle(true)}>
                {pending.confirmLabel}
              </button>
            </>
          }
        >
          {pending.body ? <div className="text-[14px] text-ink-2">{pending.body}</div> : null}
        </Dialog>
      )}
      {isClient &&
        createPortal(
          <div
            aria-live="polite"
            aria-relevant="additions text"
            className="no-print pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-[90] flex flex-col items-center gap-2 px-4 md:bottom-6"
          >
            {toasts.map((t) => (
              <div
                key={t.id}
                role={t.tone === "negative" ? "alert" : "status"}
                onMouseEnter={() => {
                  const timer = timers.current.get(t.id);
                  if (timer) clearTimeout(timer);
                }}
                onMouseLeave={() => schedule(t.id, 2500)}
                className="pointer-events-auto flex min-h-12 w-full max-w-[460px] items-center gap-3 rounded-full bg-ink-panel py-1.5 pl-5 pr-1.5 text-[13.5px] text-on-ink-panel shadow-float animate-toast-in md:w-auto md:min-w-[320px]"
              >
                {t.tone && t.tone !== "neutral" && (
                  <span aria-hidden className={`dot size-2 ${t.tone === "positive" ? "bg-lime" : "dot-negative"}`} />
                )}
                <span className="min-w-0 flex-1 py-1">{t.message}</span>
                {t.action && (
                  <button
                    type="button"
                    className="btn btn-sm bg-transparent font-semibold text-lime hover:bg-white/10"
                    onClick={() => {
                      t.action?.onClick();
                      dismiss(t.id);
                    }}
                  >
                    {t.action.label}
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Dismiss"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white [&>svg]:size-4"
                  onClick={() => dismiss(t.id)}
                >
                  <X aria-hidden />
                </button>
              </div>
            ))}
          </div>,
          document.body
        )}
    </FeedbackContext.Provider>
  );
}

const noopToast = () => {};
const noopConfirm = () => Promise.resolve(false);

/** Shows a toast. Messages are past-tense sentences; pass an action for Undo. */
export function useToast(): (t: ToastInput) => void {
  return useContext(FeedbackContext)?.toast ?? noopToast;
}

/** Opens the confirm dialog. Danger dialogs focus Cancel first and should name the exact record. */
export function useConfirm(): (o: ConfirmOptions) => Promise<boolean> {
  return useContext(FeedbackContext)?.confirm ?? noopConfirm;
}
