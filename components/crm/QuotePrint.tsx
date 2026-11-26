"use client";

import React, { useState } from "react";
import { FileText, Mail, Plus, Printer, RefreshCw, Trash2 } from "lucide-react";
import { clientFacingEmail, resolveCompany, signature } from "@/lib/company";
import { addDaysKey, formatDateIST, formatInrFull, newId, todayKeyIST } from "@/lib/format";
import { DEFAULT_SAC, GST_RATES, gstSplit } from "@/lib/gst";
import { useHub } from "@/lib/hub/context";
import { can } from "@/lib/hub/permissions";
import type { DocLine, QuoteData } from "@/lib/types";
import type { Overlay } from "@/lib/views";
import { PrintArea, printNow } from "@/components/print/PrintArea";
import { TaxDocument } from "@/components/print/TaxDocument";
import { ComposeActions } from "@/components/ui/ComposeActions";
import { Dialog } from "@/components/ui/Dialog";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { DateInput, ErrorSummary, Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/form";
import { Popover } from "@/components/ui/Menu";
import { EmptyState } from "@/components/ui/primitives";
import { firstName } from "./dealActions";

type QuoteOverlay = Extract<Overlay, { kind: "quote_print" }>;
type EditLine = DocLine & { key: string };

const keyed = (l: DocLine): EditLine => ({ key: newId("ql"), description: l.description ?? "", sac: l.sac ?? DEFAULT_SAC, amount: Number(l.amount) || 0 });

/** Quotation editor and print preview for one deal. Saving issues the next AXQ number. */
export function QuotePrint({ overlay, onClose }: { overlay: QuoteOverlay; onClose: () => void }) {
  const { data, all, viewer } = useHub();
  const toast = useToast();
  const confirm = useConfirm();
  const deal = data.deals.find((d) => d.id === overlay.dealId) ?? all.deals.find((d) => d.id === overlay.dealId) ?? null;
  const company = resolveCompany(data.settings.company);

  const [issueDate, setIssueDate] = useState(() => deal?.quote?.issueDate || todayKeyIST());
  const [validUntil, setValidUntil] = useState(() => deal?.quote?.validUntil || addDaysKey(deal?.quote?.issueDate || todayKeyIST(), 30));
  const [gstRate, setGstRate] = useState<number>(() => deal?.quote?.gstRate ?? 18);
  const [notes, setNotes] = useState(() => deal?.quote?.notes ?? "");
  const [lines, setLines] = useState<EditLine[]>(() => {
    if (overlay.lines?.length) return overlay.lines.map(keyed);
    if (deal?.quote?.lines?.length) return deal.quote.lines.map(keyed);
    return [keyed({ description: deal?.solutionsPitched || deal?.clientRequirements || "Software development services", sac: DEFAULT_SAC, amount: deal?.estimatedDealValue ?? 0 })];
  });
  const [dirty, setDirty] = useState(!!overlay.lines?.length);
  const [errors, setErrors] = useState<{ field: string; message: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!deal) {
    return (
      <Dialog open onClose={onClose} title="Quotation" size="md">
        <EmptyState icon={<FileText />} title="This deal isn't available" body="It may have been deleted, or it belongs to someone else's pipeline." />
      </Dialog>
    );
  }

  const canEdit = can(viewer, "deal.edit", { record: deal });
  const number = deal.quoteNumber && deal.quoteNumber !== "auto" ? deal.quoteNumber : "Draft";
  const placeOfSupply = (deal.stateRegion || "").trim() || company.state;
  const docLines: DocLine[] = lines.map(({ description, sac, amount }) => ({ description, sac, amount }));
  const taxable = docLines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const split = gstSplit({ taxable, rate: gstRate, supplierState: company.state, placeOfSupply });
  const unsynced = failed && data.unsynced.some((u) => u.entity === "deals" && u.id === deal.id);

  const edit = (fn: () => void) => {
    fn();
    setDirty(true);
  };
  const patchLine = (key: string, patch: Partial<DocLine>) => edit(() => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l))));

  const quote = (): QuoteData => ({ issueDate, validUntil, gstRate, lines: docLines, notes: notes.trim() || undefined });

  const save = async () => {
    const errs: { field: string; message: string }[] = [];
    if (!docLines.some((l) => l.description.trim())) errs.push({ field: `ql-desc-${lines[0]?.key ?? ""}`, message: "Describe at least one line" });
    lines.forEach((l, i) => {
      if (!(Number(l.amount) >= 0)) errs.push({ field: `ql-amount-${l.key}`, message: `Line ${i + 1} needs an amount of zero or more` });
    });
    if (validUntil && issueDate && validUntil < issueDate) errs.push({ field: "quote-valid", message: "Valid until must be on or after the quotation date" });
    setErrors(errs);
    if (errs.length) return;
    setSaving(true);
    const res = await data.saveDeal({ quote: quote(), quoteNumber: deal.quoteNumber || "auto" }, deal.id);
    setSaving(false);
    if (res.ok) {
      setDirty(false);
      setFailed(false);
      const qn = res.record.quoteNumber && res.record.quoteNumber !== "auto" ? ` ${res.record.quoteNumber}` : "";
      toast({ message: `Saved quotation${qn} for ${deal.companyName}`, tone: "positive" });
    } else setFailed(true);
  };

  const requestClose = async () => {
    if (dirty && canEdit) {
      const ok = await confirm({ title: "Close without saving?", body: "Your changes to the quotation lines will be lost.", confirmLabel: "Close without saving", cancelLabel: "Keep editing", tone: "danger" });
      if (!ok) return;
    }
    onClose();
  };

  const coverNote = `${firstName(deal.contactPerson) ? `Hi ${firstName(deal.contactPerson)},` : "Hello,"}

Please find our quotation ${number === "Draft" ? "" : `${number} `}for ${deal.companyName} attached. The total is ${formatInrFull(split.total)} including GST at ${gstRate}%, and it is valid until ${formatDateIST(validUntil, { year: true })}.

Happy to walk you through it on a call.

${signature(company, viewer.name === "Administrator" ? undefined : viewer.name)}`;

  return (
    <Dialog
      open
      onClose={() => void requestClose()}
      size="lg"
      icon={<FileText />}
      title={`Quotation ${number === "Draft" ? "draft" : number}`}
      description={`${deal.companyName}, place of supply ${placeOfSupply}`}
      footer={
        <>
          <Popover
            label="Email the quotation"
            align="start"
            triggerClassName="btn btn-ghost mr-auto"
            panelClassName="w-[340px]"
            trigger={
              <>
                <Mail aria-hidden /> Email
              </>
            }
          >
            <div className="space-y-3">
              <p className="text-[12.5px] text-ink-2">Print or save the quotation as a PDF first, then attach it to the email.</p>
              {!deal.emailAddress && <p className="text-[12.5px] text-warning">This deal has no email address, so add the recipient in your mail app.</p>}
              <ComposeActions
                size="sm"
                email={{ to: deal.emailAddress || undefined, cc: clientFacingEmail(company), subject: `Quotation${number === "Draft" ? "" : ` ${number}`} from ${company.name || "Axoraa"}`, body: coverNote }}
              />
            </div>
          </Popover>
          <button type="button" className="btn btn-ghost" onClick={printNow}>
            <Printer aria-hidden /> Print
          </button>
          {canEdit && (
            <button type="button" className="btn btn-ink" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving" : "Save quotation"}
            </button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        {unsynced && (
          <div role="alert" className="rounded-[20px] bg-coral-soft p-4">
            <div className="flex items-start gap-3">
              <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-coral text-white">
                <RefreshCw className="size-4" />
              </span>
              <p className="min-w-0 pt-1.5 text-[13.5px] text-ink">Not saved to Google Sheets. Your change is kept on this device.</p>
            </div>
            <button type="button" className="btn btn-ink btn-sm mt-3" onClick={() => void data.retrySync(deal.id)}>
              Retry
            </button>
          </div>
        )}
        {errors.length > 0 && <ErrorSummary errors={errors} />}

        <fieldset disabled={!canEdit} className="min-w-0 space-y-4">
          <legend className="sr-only">Quotation lines</legend>
          <ol className="space-y-2">
            {lines.map((l, i) => (
              <li key={l.key} className="rounded-[20px] bg-surface-2 p-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_110px_150px_auto] sm:items-end">
                  <Field label={`Line ${i + 1}`} htmlFor={`ql-desc-${l.key}`}>
                    <Input id={`ql-desc-${l.key}`} value={l.description} placeholder="Milestone 1: discovery and design" onChange={(e) => patchLine(l.key, { description: e.target.value })} />
                  </Field>
                  <Field label="SAC" htmlFor={`ql-sac-${l.key}`}>
                    <Input id={`ql-sac-${l.key}`} value={l.sac ?? ""} inputMode="numeric" className="font-mono" onChange={(e) => patchLine(l.key, { sac: e.target.value })} />
                  </Field>
                  <Field label="Amount" htmlFor={`ql-amount-${l.key}`}>
                    <MoneyInput id={`ql-amount-${l.key}`} value={l.amount} onChange={(v) => patchLine(l.key, { amount: v ?? 0 })} />
                  </Field>
                  <button
                    type="button"
                    className="icon-btn justify-self-end"
                    aria-label={`Remove line ${i + 1}`}
                    disabled={lines.length === 1}
                    onClick={() => edit(() => setLines((ls) => ls.filter((x) => x.key !== l.key)))}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => edit(() => setLines((ls) => [...ls, keyed({ description: "", sac: DEFAULT_SAC, amount: 0 })]))}>
            <Plus aria-hidden /> Add line
          </button>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="GST rate" htmlFor="quote-gst">
              <Select id="quote-gst" value={String(gstRate)} onChange={(e) => edit(() => setGstRate(Number(e.target.value)))}>
                {GST_RATES.map((r) => (
                  <option key={r} value={r}>
                    {r}%
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Quotation date" htmlFor="quote-issue">
              <DateInput id="quote-issue" value={issueDate} onChange={(e) => edit(() => setIssueDate(e.target.value))} />
            </Field>
            <Field label="Valid until" htmlFor="quote-valid">
              <DateInput id="quote-valid" value={validUntil} onChange={(e) => edit(() => setValidUntil(e.target.value))} />
            </Field>
            <Field label="Notes on the quotation" htmlFor="quote-notes" className="sm:col-span-3">
              <Textarea id="quote-notes" rows={2} value={notes} placeholder="Payment terms, what is not included" onChange={(e) => edit(() => setNotes(e.target.value))} />
            </Field>
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
          {[
            { k: "Taxable", v: taxable },
            { k: `GST ${gstRate}%`, v: split.tax },
            { k: "Total", v: split.total },
          ].map((s, i) => (
            <div key={s.k} className={`${i === 2 ? "card-ink" : "card-inset"} min-w-0 px-3 py-3 sm:px-4`}>
              <div className={`truncate text-[12px] ${i === 2 ? "text-white/55" : "text-ink-3"}`}>{s.k}</div>
              <div className="num mt-1 break-words text-[18px] sm:text-[22px]">{formatInrFull(s.v)}</div>
            </div>
          ))}
        </div>
        {number === "Draft" && <p className="text-[12.5px] text-ink-3">The quotation number (AXQ) is given the first time you save.</p>}

        <section aria-label="Preview">
          <h3 className="mb-2 text-[13px] font-medium text-ink-2">Preview</h3>
          <div className="overflow-x-auto rounded-[20px] bg-surface-2 p-2 sm:p-3">
            <PrintArea>
              <TaxDocument
                kind="quotation"
                number={number}
                issueDate={issueDate}
                validUntil={validUntil}
                company={company}
                billTo={{
                  name: deal.companyName,
                  contactPerson: deal.contactPerson || undefined,
                  addressLines: [deal.officeAddress, deal.city].map((s) => (s ?? "").trim()).filter(Boolean),
                  state: deal.stateRegion || undefined,
                }}
                placeOfSupply={placeOfSupply}
                lines={docLines.filter((l) => l.description.trim() || l.amount)}
                gstRate={gstRate}
                notes={notes.trim() || undefined}
              />
            </PrintArea>
          </div>
        </section>
      </div>
    </Dialog>
  );
}
