"use client";

import React, { useMemo, useState } from "react";
import { IndianRupee, Printer, Trash2 } from "lucide-react";
import { useHub } from "@/lib/hub/context";
import { can } from "@/lib/hub/permissions";
import type { Overlay } from "@/lib/views";
import type { ClientMasterRecord, PaymentBillingRecord } from "@/lib/types";
import { resolveCompany } from "@/lib/company";
import { DEFAULT_SAC, GST_RATES, INDIAN_STATES, gstSplit, placeOfSupplyFor } from "@/lib/gst";
import { addDaysKey, formatInrFull, todayKeyIST } from "@/lib/format";
import { Sheet } from "@/components/ui/Dialog";
import { Menu } from "@/components/ui/Menu";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Combobox, DateInput, ErrorSummary, Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/form";
import { StatusPill } from "@/components/ui/primitives";
import { NotSavedBanner, ReadOnlyNote } from "./ClientEditor";
import { RecordPaymentDialog, taxableOf } from "./RecordPaymentDialog";

interface InvoiceForm {
  client: ClientMasterRecord | null;
  projectId: string;
  milestoneDescription: string;
  issueDate: string;
  dueDate: string;
  taxable: number | null;
  gstRate: number;
  placeOfSupply: string;
  sac: string;
  notes: string;
}

type Errors = Partial<Record<"client" | "milestone" | "issueDate" | "dueDate" | "taxable" | "placeOfSupply", string>>;

const ORDER: (keyof Errors)[] = ["client", "milestone", "taxable", "issueDate", "dueDate", "placeOfSupply"];
const FIELD_ID: Record<keyof Errors, string> = {
  client: "inv-client",
  milestone: "inv-milestone",
  taxable: "inv-taxable",
  issueDate: "inv-issue",
  dueDate: "inv-due",
  placeOfSupply: "inv-pos",
};

function validate(f: InvoiceForm): Errors {
  const e: Errors = {};
  if (!f.client) e.client = "Choose the client";
  if (!f.milestoneDescription.trim()) e.milestone = "Describe what this invoice is for";
  if (!f.taxable || f.taxable <= 0) e.taxable = "Enter the taxable amount";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.issueDate)) e.issueDate = "Choose the invoice date";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.dueDate)) e.dueDate = "Choose the due date";
  else if (f.issueDate && f.dueDate < f.issueDate) e.dueDate = "The due date is before the invoice date";
  if (!f.placeOfSupply.trim()) e.placeOfSupply = "Choose the place of supply";
  return e;
}

export function InvoiceEditor({ overlay, onClose }: { overlay: Extract<Overlay, { kind: "invoice" }>; onClose: () => void }) {
  const { data, viewer, openOverlay } = useHub();
  const toast = useToast();
  const confirm = useConfirm();
  const company = useMemo(() => resolveCompany(data.settings?.company), [data.settings?.company]);

  const existing = useMemo(
    () => (overlay.invoiceId ? data.payments.find((p) => p.id === overlay.invoiceId || p.invoiceId === overlay.invoiceId) ?? null : null),
    [data.payments, overlay.invoiceId]
  );
  const missing = !!overlay.invoiceId && !existing;
  const canEdit = can(viewer, "invoice.edit", existing ? { record: existing } : undefined);
  const canDelete = !!existing && canEdit;

  const [form, setForm] = useState<InvoiceForm>(() => {
    const src: Partial<PaymentBillingRecord> = existing ?? overlay.prefill ?? {};
    const clientKey = src.clientId || overlay.clientId;
    const client = clientKey ? data.clients.find((c) => c.clientId === clientKey || c.id === clientKey) ?? null : null;
    const today = todayKeyIST();
    const issue = src.issueDate || today;
    return {
      client,
      projectId: src.projectId ?? "",
      milestoneDescription: src.milestoneDescription ?? "",
      issueDate: issue,
      dueDate: src.dueDate || addDaysKey(issue, 15),
      taxable: existing ? taxableOf(existing) : typeof src.taxableAmount === "number" ? src.taxableAmount : null,
      gstRate: typeof src.gstRate === "number" ? src.gstRate : 18,
      placeOfSupply: src.placeOfSupply || placeOfSupplyFor(client ?? undefined, company),
      sac: src.sac || DEFAULT_SAC,
      notes: src.notes ?? "",
    };
  });
  const [posTouched, setPosTouched] = useState(() => !!(existing?.placeOfSupply || overlay.prefill?.placeOfSupply));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const errors = submitted ? validate(form) : {};
  const summary = ORDER.filter((k) => errors[k]).map((k) => ({ field: FIELD_ID[k], message: errors[k]! }));
  const set = <K extends keyof InvoiceForm>(k: K, v: InvoiceForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const projects = useMemo(() => (form.client ? data.projects.filter((p) => p.clientId === form.client!.clientId) : []), [data.projects, form.client]);
  const split = gstSplit({ taxable: form.taxable ?? 0, rate: form.gstRate, supplierState: company.state, placeOfSupply: form.placeOfSupply });
  const legacyTotal = existing && !(typeof existing.taxableAmount === "number" && existing.taxableAmount > 0);

  const pickClient = (c: ClientMasterRecord | null) =>
    setForm((f) => ({
      ...f,
      client: c,
      projectId: c && data.projects.some((p) => (p.id === f.projectId || p.projectId === f.projectId) && p.clientId === c.clientId) ? f.projectId : "",
      placeOfSupply: posTouched ? f.placeOfSupply : placeOfSupplyFor(c ?? undefined, company),
    }));

  const save = async () => {
    setSubmitted(true);
    if (Object.keys(validate(form)).length || !form.client) return;
    setSaving(true);
    const project = data.projects.find((p) => p.id === form.projectId || p.projectId === form.projectId);
    const total = split.total;
    const patch: Partial<PaymentBillingRecord> = {
      clientId: form.client.clientId,
      companyName: form.client.companyName,
      projectId: project?.projectId ?? "",
      projectName: project?.projectName ?? "",
      milestoneDescription: form.milestoneDescription.trim(),
      issueDate: form.issueDate,
      dueDate: form.dueDate,
      taxableAmount: Math.round((form.taxable ?? 0) * 100) / 100,
      gstRate: form.gstRate,
      placeOfSupply: form.placeOfSupply,
      sac: form.sac.trim() || DEFAULT_SAC,
      notes: form.notes.trim(),
      invoicedAmount: total,
    };
    if (!existing && !failedId) {
      Object.assign(patch, { invoiceId: "", receivedAmount: 0, pendingAmount: total, overdueAmount: 0, status: "Pending", payments: [] });
    }
    try {
      const res = await data.savePayment(patch, existing?.id ?? failedId ?? undefined);
      if (res.ok) {
        toast({ message: existing ? `Saved ${res.record.invoiceId}` : `Added invoice ${res.record.invoiceId || ""}`.trim(), tone: "positive" });
        onClose();
      } else {
        setFailedId(res.record.id);
      }
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Couldn't save the invoice.", tone: "negative" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirm({
      title: `Delete invoice ${existing.invoiceId}?`,
      body: "The invoice and every payment recorded against it are removed for everyone. Its number is not reused.",
      confirmLabel: "Delete invoice",
      tone: "danger",
    });
    if (!ok) return;
    const res = await data.deletePayment(existing.id);
    if (res.ok) {
      toast({ message: `Deleted ${existing.invoiceId}` });
      onClose();
    } else {
      toast({ message: `Couldn't delete ${existing.invoiceId}. ${res.error}`, tone: "negative" });
    }
  };

  if (missing) {
    return (
      <Sheet open onClose={onClose} title="Invoice not found" description="It may have been deleted.">
        <ReadOnlyNote>Nothing to show here. Close this panel and pick an invoice from the list.</ReadOnlyNote>
      </Sheet>
    );
  }

  const half = form.gstRate / 2;

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        width="lg"
        title={existing ? `Invoice ${existing.invoiceId}` : "Add invoice"}
        description={existing ? existing.companyName : "Numbered automatically, like AX/FY26/014"}
        headerActions={
          existing ? (
            <Menu
              label="Invoice actions"
              items={[
                ...(canEdit && existing.status !== "Fully Paid"
                  ? [{ label: "Record payment", icon: <IndianRupee />, onSelect: () => setPaying(true) }]
                  : []),
                { label: "Print invoice", icon: <Printer />, onSelect: () => openOverlay({ kind: "invoice_print", invoiceId: existing.id }) },
                ...(canDelete ? [{ label: "Delete invoice", icon: <Trash2 />, tone: "danger" as const, separatorBefore: true, onSelect: () => void remove() }] : []),
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
                {saving ? "Saving" : existing ? "Save invoice" : "Add invoice"}
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
          {!canEdit && <ReadOnlyNote>Only the administrator can change invoices.</ReadOnlyNote>}
          <ErrorSummary errors={summary} />

          {existing && (
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
              <StatusPill status={existing.status} />
              <span className="chip chip-outline">
                Received <span className="font-medium tabular-nums text-ink">{formatInrFull(existing.receivedAmount)}</span>
              </span>
              <span className="chip chip-outline">
                Balance <span className="font-medium tabular-nums text-ink">{formatInrFull(existing.pendingAmount)}</span>
              </span>
            </div>
          )}

          <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Combobox
                id="inv-client"
                label="Client"
                items={data.clients}
                value={form.client}
                onChange={pickClient}
                getKey={(c) => c.id}
                getLabel={(c) => c.companyName}
                getDescription={(c) => [c.clientId, c.state].filter(Boolean).join(", ")}
                placeholder={data.clients.length ? "Search clients" : "Add a client first"}
                error={errors.client}
              />
            </div>
            <Field label="Project" htmlFor="inv-project" hint={form.client && !projects.length ? "This client has no projects yet." : undefined}>
              <Select id="inv-project" value={form.projectId} disabled={!form.client} onChange={(e) => set("projectId", e.target.value)}>
                <option value="">{form.client ? "No project" : "Choose a client first"}</option>
                {form.projectId && !projects.some((p) => p.id === form.projectId || p.projectId === form.projectId) && (
                  <option value={form.projectId}>{existing?.projectName || form.projectId}</option>
                )}
                {projects.map((p) => (
                  <option key={p.id} value={p.projectId || p.id}>
                    {p.projectName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="SAC" htmlFor="inv-sac" hint="998314 is IT design and development">
              <Input id="inv-sac" className="font-mono" inputMode="numeric" value={form.sac} onChange={(e) => set("sac", e.target.value.replace(/\s/g, ""))} />
            </Field>
            <Field label="Milestone" htmlFor="inv-milestone" required error={errors.milestone} className="sm:col-span-2">
              <Input
                id="inv-milestone"
                value={form.milestoneDescription}
                onChange={(e) => set("milestoneDescription", e.target.value)}
                placeholder="Phase 1, design and admin panel (40%)"
              />
            </Field>
            <Field label="Invoice date" htmlFor="inv-issue" required error={errors.issueDate}>
              <DateInput
                id="inv-issue"
                value={form.issueDate}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((f) => ({ ...f, issueDate: v, dueDate: !existing && /^\d{4}-\d{2}-\d{2}$/.test(v) ? addDaysKey(v, 15) : f.dueDate }));
                }}
              />
            </Field>
            <Field label="Due date" htmlFor="inv-due" required error={errors.dueDate} hint={existing ? undefined : "15 days after the invoice date"}>
              <DateInput id="inv-due" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
            </Field>
            <Field
              label="Taxable amount"
              htmlFor="inv-taxable"
              required
              error={errors.taxable}
              hint={legacyTotal ? `Worked out from the invoiced total of ${formatInrFull(existing!.invoicedAmount)}.` : "Before GST"}
            >
              <MoneyInput id="inv-taxable" value={form.taxable} onChange={(v) => set("taxable", v)} invalid={!!errors.taxable} />
            </Field>
            <Field label="GST rate" htmlFor="inv-gst">
              <Select id="inv-gst" value={String(form.gstRate)} onChange={(e) => set("gstRate", Number(e.target.value))}>
                {GST_RATES.map((r) => (
                  <option key={r} value={r}>
                    {r}%
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Place of supply"
              htmlFor="inv-pos"
              required
              error={errors.placeOfSupply}
              hint={`From the client's state or GSTIN. ${company.name || "Axoraa"} bills from ${company.state || "Karnataka"}.`}
              className="sm:col-span-2"
            >
              <Select
                id="inv-pos"
                value={form.placeOfSupply}
                onChange={(e) => {
                  setPosTouched(true);
                  set("placeOfSupply", e.target.value);
                }}
              >
                <option value="">Choose a state</option>
                {form.placeOfSupply && !INDIAN_STATES.some((s) => s.name === form.placeOfSupply) && <option value={form.placeOfSupply}>{form.placeOfSupply}</option>}
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Notes" htmlFor="inv-notes" hint="Printed on the invoice" className="sm:col-span-2">
              <Textarea id="inv-notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="PO number, bank charges and so on" />
            </Field>
          </fieldset>

          <section aria-label="Tax breakdown" className="card-ink p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[12px] text-white/55">Invoice total</div>
                <div className="num mt-2 text-[36px]">{formatInrFull(split.total)}</div>
              </div>
              <span className="chip chip-lime shrink-0">{split.intraState ? "CGST + SGST" : "IGST"}</span>
            </div>
            <dl className="mt-4 space-y-1.5 border-t border-white/10 pt-3 text-[13px]">
              <div className="flex justify-between gap-4">
                <dt className="text-white/60">Taxable value</dt>
                <dd className="tabular-nums">{formatInrFull(form.taxable ?? 0)}</dd>
              </div>
              {split.intraState ? (
                <>
                  <div className="flex justify-between gap-4">
                    <dt className="text-white/60">CGST at {half}%</dt>
                    <dd className="tabular-nums">{formatInrFull(split.cgst)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-white/60">SGST at {half}%</dt>
                    <dd className="tabular-nums">{formatInrFull(split.sgst)}</dd>
                  </div>
                </>
              ) : (
                <div className="flex justify-between gap-4">
                  <dt className="text-white/60">IGST at {form.gstRate}%</dt>
                  <dd className="tabular-nums">{formatInrFull(split.igst)}</dd>
                </div>
              )}
            </dl>
          </section>
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
      </Sheet>
      {paying && existing && <RecordPaymentDialog invoice={existing} onClose={() => setPaying(false)} />}
    </>
  );
}
