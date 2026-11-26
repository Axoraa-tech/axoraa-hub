"use client";

import React, { useMemo, useState } from "react";
import { FolderKanban, ReceiptIndianRupee, RefreshCw, Trash2 } from "lucide-react";
import { useHub } from "@/lib/hub/context";
import { can } from "@/lib/hub/permissions";
import type { Overlay } from "@/lib/views";
import type { ClientMasterRecord, ProjectDeliveryStatus } from "@/lib/types";
import { FOUNDER_NAMES } from "@/lib/people";
import { INDIAN_STATES, isValidGstin, stateFromGstin } from "@/lib/gst";
import { formatInrFull, normalizeIndianPhone, todayKeyIST } from "@/lib/format";
import { Sheet } from "@/components/ui/Dialog";
import { Menu } from "@/components/ui/Menu";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { DateInput, ErrorSummary, Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/form";
import { StatusPill } from "@/components/ui/primitives";

export const DEAL_STATUSES: ClientMasterRecord["dealStatus"][] = ["Won", "Negotiation", "Proposal Sent", "Discussion", "On Hold"];
export const DELIVERY_STATUSES: ProjectDeliveryStatus[] = ["Development", "Testing", "Client Review", "Completed", "On Hold"];

/* ------------------------------------------------------------------ shared editor pieces */

/**
 * Shown inside an editor when the save reached this device but not Google Sheets. Once a retry
 * succeeds (the id leaves data.unsynced) it turns into a short confirmation.
 */
export function NotSavedBanner({ id }: { id: string }) {
  const { data } = useHub();
  const [busy, setBusy] = useState(false);
  if (!data.unsynced.some((u) => u.id === id)) {
    return (
      <p role="status" className="rounded-[18px] bg-good-soft px-4 py-3 text-[13px] text-ink">
        Saved to Google Sheets.
      </p>
    );
  }
  return (
    <div role="alert" className="rounded-[18px] bg-coral-soft p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-coral text-white">
          <RefreshCw className="h-4 w-4" />
        </span>
        <p className="min-w-0 pt-1.5 text-[13.5px] text-ink">Not saved to Google Sheets. Your change is kept on this device.</p>
      </div>
      <button
        type="button"
        className="btn btn-ink btn-sm mt-3"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await data.retrySync(id);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Retrying" : "Retry"}
      </button>
    </div>
  );
}

/** A read-only notice for viewers who can see a record but not change it. */
export function ReadOnlyNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-[18px] bg-surface-2 px-4 py-3 text-[13px] text-ink-2">{children}</p>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormErrors = Partial<Record<string, string>>;

interface ClientForm {
  companyName: string;
  industry: string;
  salesOwner: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  gstin: string;
  state: string;
  billingAddress: string;
  dealValue: number | null;
  dealStatus: ClientMasterRecord["dealStatus"];
  contractScope: string;
  signedDate: string;
  deliveryStatus: ProjectDeliveryStatus;
}

function initialForm(existing: ClientMasterRecord | null, prefill: Partial<ClientMasterRecord> | undefined, lockedOwner: string | null): ClientForm {
  const src: Partial<ClientMasterRecord> = { ...(existing ?? {}), ...(existing ? {} : prefill ?? {}) };
  const gstin = (src.gstin ?? "").toUpperCase();
  return {
    companyName: src.companyName ?? "",
    industry: src.industry ?? "",
    salesOwner: lockedOwner ?? src.salesOwner ?? "",
    contactPerson: src.contactPerson ?? "",
    contactEmail: src.contactEmail ?? "",
    contactPhone: src.contactPhone ?? "",
    gstin,
    state: src.state || stateFromGstin(gstin) || "",
    billingAddress: src.billingAddress ?? "",
    dealValue: typeof src.dealValue === "number" ? src.dealValue : null,
    dealStatus: src.dealStatus ?? "Won",
    contractScope: src.contractScope ?? "",
    signedDate: src.signedDate || todayKeyIST(),
    deliveryStatus: src.deliveryStatus ?? "Development",
  };
}

function validate(f: ClientForm): FormErrors {
  const e: FormErrors = {};
  if (!f.companyName.trim()) e.companyName = "Enter the company name";
  if (!f.salesOwner.trim()) e.salesOwner = "Choose the founder who owns this client";
  if (f.contactEmail.trim() && !EMAIL_RE.test(f.contactEmail.trim())) e.contactEmail = "Enter a valid email address";
  if (f.contactPhone.trim() && !normalizeIndianPhone(f.contactPhone)) e.contactPhone = "Enter a 10-digit mobile number";
  if (f.dealValue !== null && f.dealValue < 0) e.dealValue = "Deal value can't be negative";
  return e;
}

const ORDER = ["companyName", "salesOwner", "contactEmail", "contactPhone", "dealValue"];

/* ------------------------------------------------------------------ editor */

export function ClientEditor({ overlay, onClose }: { overlay: Extract<Overlay, { kind: "client" }>; onClose: () => void }) {
  const { data, viewer, openOverlay } = useHub();
  const toast = useToast();
  const confirm = useConfirm();

  const existing = useMemo(
    () => (overlay.clientId ? data.clients.find((c) => c.id === overlay.clientId || c.clientId === overlay.clientId) ?? null : null),
    [data.clients, overlay.clientId]
  );
  const missing = !!overlay.clientId && !existing;
  const lockedOwner = viewer.privileged ? null : viewer.name;
  const canEdit = existing ? can(viewer, "client.edit", { record: existing }) : can(viewer, "client.edit");
  const canDelete = !!existing && can(viewer, "client.delete", { record: existing });

  const [form, setForm] = useState<ClientForm>(() => initialForm(existing, overlay.prefill, lockedOwner));
  const [stateTouched, setStateTouched] = useState(() => !!(existing?.state || overlay.prefill?.state));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failedId, setFailedId] = useState<string | null>(null);

  const errors = submitted ? validate(form) : {};
  const summary = ORDER.filter((k) => errors[k]).map((k) => ({ field: `client-${k}`, message: errors[k]! }));
  const set = <K extends keyof ClientForm>(k: K, v: ClientForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const gstinWarning = form.gstin.trim() && !isValidGstin(form.gstin.trim()) ? "This doesn't look like a GSTIN (15 characters, like 29ABCDE1234F1Z5). You can still save." : null;
  const sourceDealId = existing ? undefined : overlay.prefill?.sourceDealId;
  const sourceCompany = sourceDealId
    ? data.deals.find((d) => d.id === sourceDealId)?.companyName || overlay.prefill?.companyName || "this client"
    : null;
  const projects = existing ? data.projects.filter((p) => p.clientId === existing.clientId) : [];
  const invoices = existing ? data.payments.filter((p) => p.clientId === existing.clientId) : [];
  const pending = invoices.reduce((s, p) => s + (Number(p.pendingAmount) || 0), 0);

  const owners = useMemo(() => {
    const list = [...FOUNDER_NAMES];
    if (form.salesOwner && !list.includes(form.salesOwner)) list.push(form.salesOwner);
    return list;
  }, [form.salesOwner]);

  const save = async () => {
    setSubmitted(true);
    if (Object.keys(validate(form)).length) return;
    setSaving(true);
    const patch: Partial<ClientMasterRecord> = {
      companyName: form.companyName.trim(),
      industry: form.industry.trim(),
      salesOwner: lockedOwner ?? form.salesOwner,
      contactPerson: form.contactPerson.trim(),
      contactEmail: form.contactEmail.trim(),
      contactPhone: form.contactPhone.trim(),
      gstin: form.gstin.trim().toUpperCase(),
      state: form.state,
      billingAddress: form.billingAddress.trim(),
      dealValue: form.dealValue ?? 0,
      dealStatus: form.dealStatus,
      contractScope: form.contractScope.trim(),
      signedDate: form.signedDate,
      deliveryStatus: form.deliveryStatus,
    };
    // After a failed sync the record already exists on this device: save over it, never add a second one.
    if (!existing && !failedId) {
      patch.clientId = "";
      if (overlay.prefill?.sourceDealId) patch.sourceDealId = overlay.prefill.sourceDealId;
    }
    try {
      const res = await data.saveClient(patch, existing?.id ?? failedId ?? undefined);
      if (res.ok) {
        toast({ message: existing ? `Saved ${res.record.companyName}` : `Added ${res.record.companyName}`, tone: "positive" });
        onClose();
      } else {
        setFailedId(res.record.id);
      }
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Couldn't save the client.", tone: "negative" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirm({
      title: `Delete ${existing.companyName}?`,
      body: "The client record is removed for everyone. Projects and invoices that point at it stay, so remove those separately if needed.",
      confirmLabel: "Delete client",
      tone: "danger",
    });
    if (!ok) return;
    const res = await data.deleteClient(existing.id);
    if (res.ok) {
      toast({ message: `Deleted ${existing.companyName}` });
      onClose();
    } else {
      toast({ message: `Couldn't delete ${existing.companyName}. ${res.error}`, tone: "negative" });
    }
  };

  if (missing) {
    return (
      <Sheet open onClose={onClose} title="Client not found" description="It may have been deleted, or it belongs to someone else.">
        <ReadOnlyNote>Nothing to show here. Close this panel and pick a client from the list.</ReadOnlyNote>
      </Sheet>
    );
  }

  const title = existing ? existing.companyName || "Client" : "Add client";
  const description = existing ? `${existing.clientId || "No client ID yet"}, owned by ${existing.salesOwner || "nobody"}` : "A signed or nearly signed account";

  return (
    <Sheet
      open
      onClose={onClose}
      width="lg"
      title={title}
      description={description}
      headerActions={
        existing ? (
          <Menu
            label="Client actions"
            items={[
              ...(can(viewer, "project.edit") ? [{ label: "Add project", icon: <FolderKanban />, onSelect: () => openOverlay({ kind: "project", clientId: existing.id }) }] : []),
              ...(viewer.privileged ? [{ label: "Add invoice", icon: <ReceiptIndianRupee />, onSelect: () => openOverlay({ kind: "invoice", clientId: existing.id }) }] : []),
              ...(canDelete ? [{ label: "Delete client", icon: <Trash2 />, tone: "danger" as const, separatorBefore: true, onSelect: () => void remove() }] : []),
            ]}
          />
        ) : undefined
      }
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {canEdit ? "Cancel" : "Close"}
          </button>
          {canEdit && (
            <button type="button" className="btn btn-ink" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving" : existing ? "Save client" : "Add client"}
            </button>
          )}
        </>
      }
    >
      <form
        noValidate
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (canEdit) void save();
        }}
      >
        {failedId && <NotSavedBanner id={failedId} />}
        {!canEdit && <ReadOnlyNote>Only the administrator and the client&apos;s owner can change this record.</ReadOnlyNote>}
        {sourceCompany && <p className="text-[12.5px] text-ink-3">Created from the deal for {sourceCompany}.</p>}
        <ErrorSummary errors={summary} />

        {existing && (
          <div className="grid grid-cols-3 gap-2">
            <div className="card-ink min-w-0 p-4">
              <div className="text-[12px] text-white/55">Deal value</div>
              <div className="num mt-3 truncate text-[22px] sm:text-[26px]">{formatInrFull(existing.dealValue)}</div>
            </div>
            <div className="card-inset min-w-0 p-4">
              <div className="text-[12px] text-ink-3">Projects</div>
              <div className="num mt-3 text-[22px] sm:text-[26px]">{projects.length}</div>
            </div>
            <div className="card-inset min-w-0 p-4">
              <div className="text-[12px] text-ink-3">Pending</div>
              <div className={`num mt-3 truncate text-[22px] sm:text-[26px] ${pending > 0 ? "text-negative" : ""}`}>{formatInrFull(pending)}</div>
            </div>
          </div>
        )}

        <fieldset disabled={!canEdit} className="space-y-5">
          <section className="grid gap-4 sm:grid-cols-2">
            <Field label="Company" htmlFor="client-companyName" required error={errors.companyName} className="sm:col-span-2">
              <Input id="client-companyName" value={form.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="Apex FinTech Solutions" autoComplete="organization" />
            </Field>
            <Field label="Industry" htmlFor="client-industry">
              <Input id="client-industry" value={form.industry} onChange={(e) => set("industry", e.target.value)} placeholder="Fintech" />
            </Field>
            <Field
              label="Owner"
              htmlFor="client-salesOwner"
              required
              error={errors.salesOwner}
              hint={lockedOwner ? "Clients you add are yours." : "The founder who brought the client in"}
            >
              <Select id="client-salesOwner" value={form.salesOwner} disabled={!!lockedOwner} onChange={(e) => set("salesOwner", e.target.value)}>
                <option value="">Choose a founder</option>
                {owners.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
          </section>

          <section className="space-y-4 border-t border-line pt-5">
            <h3 className="text-[14px] font-medium text-ink">Contact</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contact person" htmlFor="client-contactPerson">
                <Input id="client-contactPerson" value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} placeholder="Rajiv Malhotra" autoComplete="name" />
              </Field>
              <Field label="Phone" htmlFor="client-contactPhone" error={errors.contactPhone}>
                <Input
                  id="client-contactPhone"
                  className="font-mono"
                  inputMode="tel"
                  value={form.contactPhone}
                  onChange={(e) => set("contactPhone", e.target.value)}
                  placeholder="98450 12345"
                  autoComplete="tel"
                />
              </Field>
              <Field label="Email" htmlFor="client-contactEmail" error={errors.contactEmail} hint="Payment reminders go here" className="sm:col-span-2">
                <Input
                  id="client-contactEmail"
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => set("contactEmail", e.target.value)}
                  placeholder="accounts@company.in"
                  autoComplete="email"
                />
              </Field>
            </div>
          </section>

          <section className="space-y-4 border-t border-line pt-5">
            <h3 className="text-[14px] font-medium text-ink">Billing</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="GSTIN"
                htmlFor="client-gstin"
                hint={gstinWarning ? <span className="text-warning">{gstinWarning}</span> : "Printed on tax invoices. Fills in the state."}
              >
                <Input
                  id="client-gstin"
                  className="font-mono uppercase"
                  value={form.gstin}
                  maxLength={15}
                  autoCapitalize="characters"
                  spellCheck={false}
                  onChange={(e) => {
                    const v = e.target.value.toUpperCase().replace(/\s/g, "");
                    const st = stateFromGstin(v);
                    setForm((f) => ({ ...f, gstin: v, state: st && !stateTouched ? st : f.state }));
                  }}
                  placeholder="29ABCDE1234F1Z5"
                />
              </Field>
              <Field label="State" htmlFor="client-state" hint="Decides CGST and SGST or IGST">
                <Select
                  id="client-state"
                  value={form.state}
                  onChange={(e) => {
                    setStateTouched(true);
                    set("state", e.target.value);
                  }}
                >
                  <option value="">Not set</option>
                  {form.state && !INDIAN_STATES.some((s) => s.name === form.state) && <option value={form.state}>{form.state}</option>}
                  {INDIAN_STATES.map((s) => (
                    <option key={s.code} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Billing address" htmlFor="client-billingAddress" className="sm:col-span-2">
                <Textarea
                  id="client-billingAddress"
                  rows={3}
                  value={form.billingAddress}
                  onChange={(e) => set("billingAddress", e.target.value)}
                  placeholder={"Building, street\nArea, city, PIN"}
                  autoComplete="street-address"
                />
              </Field>
            </div>
          </section>

          <section className="space-y-4 border-t border-line pt-5">
            <h3 className="text-[14px] font-medium text-ink">Deal and delivery</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Deal value" htmlFor="client-dealValue" error={errors.dealValue}>
                <MoneyInput id="client-dealValue" value={form.dealValue} onChange={(v) => set("dealValue", v)} invalid={!!errors.dealValue} />
              </Field>
              <Field label="Deal status" htmlFor="client-dealStatus">
                <Select id="client-dealStatus" value={form.dealStatus} onChange={(e) => set("dealStatus", e.target.value as ClientForm["dealStatus"])}>
                  {DEAL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Signed on" htmlFor="client-signedDate">
                <DateInput id="client-signedDate" value={form.signedDate} onChange={(e) => set("signedDate", e.target.value)} />
              </Field>
              <Field label="Delivery status" htmlFor="client-deliveryStatus">
                <Select id="client-deliveryStatus" value={form.deliveryStatus} onChange={(e) => set("deliveryStatus", e.target.value as ProjectDeliveryStatus)}>
                  {DELIVERY_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Contract scope" htmlFor="client-contractScope" className="sm:col-span-2">
                <Textarea
                  id="client-contractScope"
                  rows={3}
                  value={form.contractScope}
                  onChange={(e) => set("contractScope", e.target.value)}
                  placeholder="What we are building, and what is out of scope"
                />
              </Field>
            </div>
          </section>
        </fieldset>

        {existing && projects.length > 0 && (
          <section className="space-y-3 border-t border-line pt-5">
            <h3 className="text-[14px] font-medium text-ink">Projects</h3>
            <ul className="space-y-2">
              {projects.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => openOverlay({ kind: "project", projectId: p.id })}
                    className="card-interactive flex w-full items-center gap-3 rounded-[18px] bg-surface-2 px-4 py-3 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-ink">{p.projectName}</span>
                      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface">
                        <span
                          className={`block h-full rounded-full ${p.status === "Completed" ? "bg-ink" : p.status === "On Hold" ? "bg-coral" : "bg-lime"}`}
                          style={{ width: `${Math.max(0, Math.min(100, p.completionPercentage))}%` }}
                        />
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] tabular-nums text-ink-2">{Math.round(p.completionPercentage)}%</span>
                    <StatusPill status={p.status} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {/* Lets Enter submit from a text field */}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}
