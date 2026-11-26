"use client";

import React, { useId, useState } from "react";
import { Building2, Plus, X } from "lucide-react";
import { COMPANY_EMAIL, type CompanyProfile } from "@/lib/company";
import { INDIAN_STATES, isValidGstin } from "@/lib/gst";
import type { HubSettings } from "@/lib/settings";
import { CardHeader } from "@/components/ui/primitives";
import { ErrorSummary, Field, Input, Select, Textarea } from "@/components/ui/form";

/* ------------------------------------------------------------------ shared settings form bits */

export interface SettingsFormProps {
  settings: HubSettings;
  /** Saves the patch; resolves true when it was kept (locally at least). */
  onSave: (patch: Partial<HubSettings>) => Promise<boolean>;
  onDirtyChange: (dirty: boolean) => void;
  saving: boolean;
}

export function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Reset and Save pills at the bottom of a settings card. */
export function SettingsFormFooter({ dirty, saving, onReset }: { dirty: boolean; saving: boolean; onReset: () => void }) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-end">
      {dirty && <span className="mr-auto text-[12.5px] text-ink-3">You have unsaved changes.</span>}
      <button type="button" className="btn btn-plain" disabled={!dirty || saving} onClick={onReset}>
        Discard changes
      </button>
      <button type="submit" className="btn btn-ink" disabled={!dirty || saving}>
        {saving ? "Saving" : "Save changes"}
      </button>
    </div>
  );
}

/** An editable list of short text values (services, lead sources, projects, work types). */
export function ListEditor({
  label,
  items,
  onChange,
  placeholder,
  addLabel,
  hint,
  max = 60,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  addLabel: string;
  hint?: React.ReactNode;
  max?: number;
}) {
  const base = useId();
  const [draft, setDraft] = useState("");
  const value = draft.trim();
  const duplicate = value !== "" && items.some((i) => i.toLowerCase() === value.toLowerCase());
  const add = () => {
    if (!value || duplicate || items.length >= max) return;
    onChange([...items, value]);
    setDraft("");
  };
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 block text-[12px] font-medium text-ink-2">{label}</legend>
      {items.length === 0 ? (
        <p className="rounded-[15px] bg-surface-2 px-4 py-3 text-[13px] text-ink-3">Nothing added yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <li key={`${item}-${i}`} className="chip h-8 pr-1 text-[13px] text-ink">
              <span className="max-w-[240px] truncate">{item}</span>
              <button
                type="button"
                aria-label={`Remove ${item}`}
                className="flex size-6 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-surface hover:text-ink"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex gap-2">
        <label htmlFor={`${base}-add`} className="sr-only">
          {addLabel}
        </label>
        <input
          id={`${base}-add`}
          className="field field-sm min-w-0 flex-1"
          value={draft}
          maxLength={120}
          placeholder={placeholder}
          aria-invalid={duplicate || undefined}
          aria-describedby={duplicate ? `${base}-dup` : hint ? `${base}-hint` : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn btn-ghost btn-sm shrink-0" disabled={!value || duplicate || items.length >= max} onClick={add}>
          <Plus aria-hidden /> Add
        </button>
      </div>
      {duplicate && (
        <p id={`${base}-dup`} className="mt-1.5 text-[12px] text-negative">
          {value} is already in the list.
        </p>
      )}
      {!duplicate && hint && (
        <p id={`${base}-hint`} className="mt-1.5 text-[12px] text-ink-3">
          {hint}
        </p>
      )}
    </fieldset>
  );
}

/* ------------------------------------------------------------------ company profile */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const PIN_RE = /^[1-9][0-9]{5}$/;

type Draft = Omit<CompanyProfile, "addressLines"> & { address: string };

function toDraft(c: CompanyProfile): Draft {
  const { addressLines, ...rest } = c;
  return { ...rest, address: addressLines.join("\n") };
}

function fromDraft(d: Draft): CompanyProfile {
  const { address, ...rest } = d;
  return {
    ...rest,
    gstin: rest.gstin.trim().toUpperCase(),
    pan: rest.pan.trim().toUpperCase(),
    addressLines: address
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  };
}

export function CompanyProfileForm({ settings, onSave, onDirtyChange, saving }: SettingsFormProps) {
  const [baseline, setBaseline] = useState(() => toDraft(settings.company));
  const [draft, setDraft] = useState(baseline);
  const [submitted, setSubmitted] = useState(false);
  const dirty = !sameJson(draft, baseline);

  const update = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onDirtyChange(!sameJson(next, baseline));
  };

  const email = draft.email.trim();
  const errors: { field: string; message: string }[] = [];
  if (!draft.name.trim()) errors.push({ field: "co-name", message: "Add the company name" });
  if (email && !EMAIL_RE.test(email)) errors.push({ field: "co-email", message: "The shared inbox needs a valid email address" });
  const gstin = draft.gstin.trim().toUpperCase();
  const pan = draft.pan.trim().toUpperCase();
  const gstinWarn = gstin && !isValidGstin(gstin) ? "This doesn't look like a GSTIN: 15 characters, for example 29ABCDE1234F1Z5." : undefined;
  const panWarn = pan && !PAN_RE.test(pan) ? "This doesn't look like a PAN: 10 characters, for example ABCDE1234F." : undefined;
  const pinWarn = draft.pincode.trim() && !PIN_RE.test(draft.pincode.trim()) ? "PIN codes have 6 digits." : undefined;
  const errorFor = (f: string) => (submitted ? errors.find((e) => e.field === f)?.message : undefined);

  return (
    <form
      noValidate
      className="card min-w-0 p-5 sm:p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setSubmitted(true);
        if (errors.length) return;
        const company = fromDraft(draft);
        if (await onSave({ company })) {
          const next = toDraft(company);
          setBaseline(next);
          setDraft(next);
          setSubmitted(false);
          onDirtyChange(false);
        }
      }}
    >
      <CardHeader icon={<Building2 />} title="Company profile" subtitle="Shown on invoices, quotations and assistant drafts" />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {submitted && errors.length > 0 && (
          <div className="md:col-span-2">
            <ErrorSummary errors={errors} />
          </div>
        )}
        <Field label="Company name" htmlFor="co-name" required error={errorFor("co-name")}>
          <Input id="co-name" value={draft.name} onChange={(e) => update({ name: e.target.value })} autoComplete="organization" />
        </Field>
        <Field label="Legal name" htmlFor="co-legal" hint="As registered for GST, if different">
          <Input id="co-legal" value={draft.legalName} onChange={(e) => update({ legalName: e.target.value })} />
        </Field>
        <Field
          label="Shared inbox"
          htmlFor="co-email"
          error={errorFor("co-email")}
          hint="Shared inbox. Used as the cc on client email, on invoices and quotations, and in assistant signatures."
          className="md:col-span-2"
        >
          <Input id="co-email" type="email" inputMode="email" value={draft.email} placeholder={COMPANY_EMAIL} onChange={(e) => update({ email: e.target.value })} />
        </Field>
        <Field label="Phone" htmlFor="co-phone">
          <Input id="co-phone" inputMode="tel" value={draft.phone} onChange={(e) => update({ phone: e.target.value })} autoComplete="tel" />
        </Field>
        <Field label="Website" htmlFor="co-web">
          <Input id="co-web" value={draft.website} onChange={(e) => update({ website: e.target.value })} placeholder="axoraa.com" />
        </Field>
        <Field label="Address" htmlFor="co-address" hint="One line per row, as it should print" className="md:col-span-2">
          <Textarea id="co-address" rows={3} value={draft.address} onChange={(e) => update({ address: e.target.value })} autoComplete="street-address" />
        </Field>
        <Field label="City" htmlFor="co-city">
          <Input id="co-city" value={draft.city} onChange={(e) => update({ city: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="State" htmlFor="co-state">
            <Select id="co-state" value={draft.state} onChange={(e) => update({ state: e.target.value })}>
              {!INDIAN_STATES.some((s) => s.name === draft.state) && draft.state && <option value={draft.state}>{draft.state}</option>}
              {INDIAN_STATES.map((s) => (
                <option key={s.code} value={s.name}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="PIN code" htmlFor="co-pin" hint={pinWarn}>
            <Input id="co-pin" inputMode="numeric" maxLength={6} value={draft.pincode} onChange={(e) => update({ pincode: e.target.value.replace(/\D/g, "") })} />
          </Field>
        </div>
        <Field label="GSTIN" htmlFor="co-gstin" hint={gstinWarn ?? "Printed on tax invoices. Leave blank until registered."}>
          <Input
            id="co-gstin"
            className="font-mono uppercase tracking-wide"
            maxLength={15}
            value={draft.gstin}
            onChange={(e) => update({ gstin: e.target.value.toUpperCase() })}
            placeholder="29ABCDE1234F1Z5"
          />
        </Field>
        <Field label="PAN" htmlFor="co-pan" hint={panWarn}>
          <Input id="co-pan" className="font-mono uppercase tracking-wide" maxLength={10} value={draft.pan} onChange={(e) => update({ pan: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Payment instructions" htmlFor="co-pay" hint="Shown on invoices, for example bank name, account and UPI ID." className="md:col-span-2">
          <Textarea id="co-pay" rows={3} value={draft.paymentInstructions} onChange={(e) => update({ paymentInstructions: e.target.value })} />
        </Field>
        <div className="md:col-span-2">
          <ListEditor
            label="Services"
            items={draft.services}
            onChange={(services) => update({ services })}
            addLabel="Add a service"
            placeholder="For example, Mobile app maintenance"
            hint="Used by the assistant when it outlines proposals."
          />
        </div>
        <p className="rounded-[15px] bg-surface-2 px-4 py-3 text-[13px] text-ink-2 md:col-span-2">
          The financial year starts in April. Periods, invoice numbers and quarters follow it.
        </p>
      </div>
      <SettingsFormFooter
        dirty={dirty}
        saving={saving}
        onReset={() => {
          setDraft(baseline);
          setSubmitted(false);
          onDirtyChange(false);
        }}
      />
    </form>
  );
}
