"use client";

import React, { createContext, forwardRef, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Plus } from "lucide-react";
import { useIsClient } from "./Dialog";
import { useAnchoredPosition } from "./Menu";

/* ------------------------------------------------------------------ Field */

interface FieldCtx {
  id?: string;
  describedBy?: string;
  invalid: boolean;
  required?: boolean;
}

const FieldContext = createContext<FieldCtx>({ invalid: false });

function useFieldProps(props: { id?: string; "aria-describedby"?: string; "aria-invalid"?: React.AriaAttributes["aria-invalid"]; required?: boolean; invalid?: boolean }) {
  const ctx = useContext(FieldContext);
  const invalid = props.invalid ?? ctx.invalid;
  return {
    id: props.id ?? ctx.id,
    "aria-describedby": props["aria-describedby"] ?? ctx.describedBy,
    "aria-invalid": props["aria-invalid"] ?? (invalid ? (true as const) : undefined),
    required: props.required ?? ctx.required,
  };
}

const labelCls = "mb-1.5 block text-[12px] font-medium text-ink-2";

/**
 * Label, control, hint and error. With htmlFor, controls inside pick up the id, aria-describedby
 * and aria-invalid automatically. Without htmlFor it wraps the control in a <label> (legacy use).
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className = "",
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const autoId = useId();
  const base = htmlFor ?? autoId;
  const hintId = hint ? `${base}-hint` : undefined;
  const errorId = error ? `${base}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  const ctx = useMemo<FieldCtx>(() => ({ id: htmlFor, describedBy, invalid: !!error, required }), [htmlFor, describedBy, error, required]);

  const labelText = (
    <>
      {label}
      {required && (
        <span aria-hidden className="text-negative">
          {" "}
          *
        </span>
      )}
    </>
  );
  const foot = (
    <>
      {error && (
        <span id={errorId} className="mt-1.5 block text-[12px] text-negative">
          {error}
        </span>
      )}
      {hint && (
        <span id={hintId} className="mt-1.5 block text-[12px] text-ink-3">
          {hint}
        </span>
      )}
    </>
  );

  return (
    <FieldContext.Provider value={ctx}>
      {htmlFor ? (
        <div className={`block ${className}`}>
          <label htmlFor={htmlFor} className={labelCls}>
            {labelText}
          </label>
          {children}
          {foot}
        </div>
      ) : (
        <label className={`block ${className}`}>
          <span className={labelCls}>{labelText}</span>
          {children}
          {foot}
        </label>
      )}
    </FieldContext.Provider>
  );
}

/* ------------------------------------------------------------------ inputs */

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; fieldSize?: "sm" | "md" };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = "", invalid, fieldSize = "md", ...rest },
  ref
) {
  const f = useFieldProps({ ...rest, invalid });
  return <input ref={ref} {...rest} {...f} className={`field ${fieldSize === "sm" ? "field-sm" : ""} ${className}`} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className = "", invalid, rows = 4, ...rest }, ref) {
    const f = useFieldProps({ ...rest, invalid });
    return <textarea ref={ref} rows={rows} {...rest} {...f} className={`field ${className}`} />;
  }
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; fieldSize?: "sm" | "md" }>(
  function Select({ className = "", invalid, fieldSize = "md", children, ...rest }, ref) {
    const f = useFieldProps({ ...rest, invalid });
    return (
      <span className={`relative block ${className}`}>
        <select ref={ref} {...rest} {...f} className={`field ${fieldSize === "sm" ? "field-sm" : ""} cursor-pointer appearance-none pr-10`}>
          {children}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-2" />
      </span>
    );
  }
);

export const DateInput = forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { invalid?: boolean }>(
  function DateInput({ className = "", invalid, ...rest }, ref) {
    const f = useFieldProps({ ...rest, invalid });
    return <input ref={ref} type="date" {...rest} {...f} className={`field tabular-nums ${className}`} />;
  }
);

/* ------------------------------------------------------------------ MoneyInput */

function groupIndian(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

/** ₹ prefix; plain digits while editing, Indian grouping (1,25,000) once the field loses focus. */
export function MoneyInput({
  id,
  value,
  onChange,
  placeholder = "0",
  invalid,
  className = "",
  disabled,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const f = useFieldProps({ id, invalid });
  const [editing, setEditing] = useState<string | null>(null);
  const shown = editing ?? (value === null || value === undefined || Number.isNaN(value) ? "" : groupIndian(value));
  return (
    <span className={`relative block ${className}`}>
      <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[14px] text-ink-3">
        ₹
      </span>
      <input
        {...f}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={shown}
        onFocus={() => setEditing(value === null || value === undefined || Number.isNaN(value) ? "" : String(value))}
        onBlur={() => setEditing(null)}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.]/g, "");
          setEditing(raw);
          if (raw === "" || raw === ".") onChange(null);
          else {
            const n = Number(raw);
            if (Number.isFinite(n)) onChange(n);
          }
        }}
        className="field pl-8 text-right tabular-nums"
      />
    </span>
  );
}

/* ------------------------------------------------------------------ Switch and Checkbox */

export function Switch({
  checked,
  onChange,
  label,
  id,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  id?: string;
  description?: React.ReactNode;
  disabled?: boolean;
}) {
  const autoId = useId();
  const sid = id ?? autoId;
  return (
    <div className="flex items-start gap-3">
      <button
        id={sid}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${sid}-label`}
        aria-describedby={description ? `${sid}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-brand disabled:opacity-50 ${
          checked ? "bg-accent" : "bg-zinc-300"
        }`}
      >
        <span
          aria-hidden
          className={`absolute left-0.5 size-5 rounded-full shadow-sm transition-transform duration-200 ease-brand ${
            checked ? "translate-x-5 bg-on-accent" : "translate-x-0 bg-white"
          }`}
        />
      </button>
      <div className="min-w-0">
        <span id={`${sid}-label`} className="block cursor-pointer pt-0.5 text-[14px] text-ink" onClick={() => !disabled && onChange(!checked)}>
          {label}
        </span>
        {description && (
          <span id={`${sid}-desc`} className="mt-0.5 block text-[12px] text-ink-3">
            {description}
          </span>
        )}
      </div>
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  id,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  id?: string;
  description?: React.ReactNode;
  disabled?: boolean;
}) {
  const autoId = useId();
  const cid = id ?? autoId;
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={cid}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={description ? `${cid}-desc` : undefined}
        className="mt-0.5 size-[18px] shrink-0 cursor-pointer rounded-md accent-accent"
      />
      <div className="min-w-0">
        <label htmlFor={cid} className="block cursor-pointer text-[14px] text-ink">
          {label}
        </label>
        {description && (
          <span id={`${cid}-desc`} className="mt-0.5 block text-[12px] text-ink-3">
            {description}
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Combobox */

export function Combobox<T>({
  id,
  label,
  items,
  value,
  onChange,
  getKey,
  getLabel,
  getDescription,
  placeholder,
  allowCustom = false,
  onCreate,
  error,
  hint,
}: {
  id: string;
  label: React.ReactNode;
  items: readonly T[];
  value: T | null;
  onChange: (v: T | null) => void;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  getDescription?: (item: T) => string | undefined;
  placeholder?: string;
  allowCustom?: boolean;
  onCreate?: (text: string) => void;
  error?: React.ReactNode;
  hint?: React.ReactNode;
}) {
  const isClient = useIsClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = `${id}-listbox`;

  const text = query ?? (value !== null ? getLabel(value) : "");
  const q = (query ?? "").trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? items.filter((it) => getLabel(it).toLowerCase().includes(q) || (getDescription?.(it) ?? "").toLowerCase().includes(q)) : items.slice()),
    [items, q, getLabel, getDescription]
  );
  const exact = q !== "" && items.some((it) => getLabel(it).trim().toLowerCase() === q);
  const showCreate = (allowCustom || !!onCreate) && q !== "" && !exact;
  const count = filtered.length + (showCreate ? 1 : 0);
  const activeIdx = Math.min(active, Math.max(0, count - 1));

  useAnchoredPosition(open, inputRef, listRef, { align: "start", matchWidth: true, ready: isClient });

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIdx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIdx]);

  const commit = (i: number) => {
    if (i < filtered.length) {
      onChange(filtered[i]);
    } else if (showCreate) {
      onCreate?.(query!.trim());
    }
    setQuery(null);
    setOpen(false);
  };

  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="block">
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && count > 0 ? `${id}-opt-${activeIdx}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
            if (e.target.value === "" && value !== null) onChange(null);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setQuery(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (!open) setOpen(true);
              else setActive((activeIdx + 1) % Math.max(1, count));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              if (!open) setOpen(true);
              else setActive((activeIdx - 1 + Math.max(1, count)) % Math.max(1, count));
            } else if (e.key === "Home" && open) {
              e.preventDefault();
              setActive(0);
            } else if (e.key === "End" && open) {
              e.preventDefault();
              setActive(Math.max(0, count - 1));
            } else if (e.key === "Enter") {
              if (open && count > 0) {
                e.preventDefault();
                commit(activeIdx);
              }
            } else if (e.key === "Escape") {
              if (open) {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                setQuery(null);
              }
            }
          }}
          className="field pr-10"
        />
        <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-2" />
      </div>
      {error && (
        <span id={`${id}-error`} className="mt-1.5 block text-[12px] text-negative">
          {error}
        </span>
      )}
      {hint && (
        <span id={`${id}-hint`} className="mt-1.5 block text-[12px] text-ink-3">
          {hint}
        </span>
      )}
      {open &&
        isClient &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={typeof label === "string" ? label : undefined}
            style={{ position: "fixed", top: 0, left: 0 }}
            onMouseDown={(e) => e.preventDefault()}
            className="z-[85] overflow-y-auto rounded-[20px] bg-raised p-1.5 shadow-float animate-menu-in"
          >
            {filtered.map((it, i) => {
              const selected = value !== null && getKey(value) === getKey(it);
              const desc = getDescription?.(it);
              return (
                <li
                  key={getKey(it)}
                  id={`${id}-opt-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => commit(i)}
                  className={`flex cursor-pointer items-start gap-2 rounded-xl px-3 py-2 text-[13.5px] ${i === activeIdx ? "bg-surface-2" : ""}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ink">{getLabel(it)}</span>
                    {desc && <span className="block truncate text-[12px] text-ink-3">{desc}</span>}
                  </span>
                  {selected && <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-ink" />}
                </li>
              );
            })}
            {showCreate && (
              <li
                id={`${id}-opt-${filtered.length}`}
                data-index={filtered.length}
                role="option"
                aria-selected={false}
                onMouseEnter={() => setActive(filtered.length)}
                onClick={() => commit(filtered.length)}
                className={`flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] text-ink ${activeIdx === filtered.length ? "bg-surface-2" : ""}`}
              >
                <span aria-hidden className="flex size-6 items-center justify-center rounded-full bg-lime text-on-lime">
                  <Plus className="size-3.5" />
                </span>
                <span className="truncate">Add &ldquo;{query?.trim()}&rdquo;</span>
              </li>
            )}
            {count === 0 && <li className="px-3 py-2.5 text-[13px] text-ink-3">No matches</li>}
          </ul>,
          document.body
        )}
    </div>
  );
}

/* ------------------------------------------------------------------ ErrorSummary */

/** Lists the form's errors and takes focus whenever a new set appears (on submit). */
export function ErrorSummary({ errors, title = "Fix these before saving" }: { errors: { field: string; message: string }[]; title?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const signature = errors.map((e) => `${e.field}:${e.message}`).join("|");
  useEffect(() => {
    if (signature) ref.current?.focus();
  }, [signature]);
  if (!errors.length) return null;
  return (
    <div ref={ref} tabIndex={-1} role="alert" className="rounded-[18px] bg-coral-soft px-4 py-3 outline-none focus-visible:outline-2">
      <p className="text-[13px] font-medium text-negative">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {errors.map((e) => (
          <li key={e.field + e.message}>
            <a
              href={`#${e.field}`}
              className="text-[13px] text-ink underline decoration-negative/50 underline-offset-2 hover:decoration-negative"
              onClick={(ev) => {
                const el = document.getElementById(e.field);
                if (el) {
                  ev.preventDefault();
                  el.focus();
                }
              }}
            >
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
