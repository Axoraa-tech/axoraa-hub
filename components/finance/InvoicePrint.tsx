"use client";

import React, { useMemo } from "react";
import { FileText, Printer } from "lucide-react";
import { useHub } from "@/lib/hub/context";
import type { Overlay } from "@/lib/views";
import { resolveCompany } from "@/lib/company";
import { DEFAULT_SAC, placeOfSupplyFor } from "@/lib/gst";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/primitives";
import { PrintArea, printNow } from "@/components/print/PrintArea";
import { TaxDocument } from "@/components/print/TaxDocument";
import { taxableOf } from "./RecordPaymentDialog";

function addressLines(text?: string): string[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** The GST tax invoice for one invoice record, previewed in a dialog. Print sends only the invoice to the printer. */
export function InvoicePrint({ overlay, onClose }: { overlay: Extract<Overlay, { kind: "invoice_print" }>; onClose: () => void }) {
  const { data, openOverlay } = useHub();
  const company = useMemo(() => resolveCompany(data.settings?.company), [data.settings?.company]);
  const invoice = data.payments.find((p) => p.id === overlay.invoiceId || p.invoiceId === overlay.invoiceId) ?? null;
  const client = invoice ? data.clients.find((c) => c.clientId === invoice.clientId) ?? null : null;

  if (!invoice) {
    return (
      <Dialog open onClose={onClose} title="Invoice not found" size="sm">
        <EmptyState icon={<FileText />} title="This invoice isn't in the hub any more." body="It may have been deleted. Close this and pick another invoice." className="py-6!" />
      </Dialog>
    );
  }

  const missing: string[] = [];
  if (!client?.gstin) missing.push("GSTIN");
  if (!client?.billingAddress?.trim()) missing.push("billing address");
  const clientNote = missing.length
    ? `The client's ${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} missing. Add ${missing.length > 1 ? "them" : "it"} to the client before sending a tax invoice.`
    : null;

  const description = [invoice.milestoneDescription, invoice.projectName ? `Project: ${invoice.projectName}` : ""].filter(Boolean).join("\n");

  return (
    <Dialog
      open
      onClose={onClose}
      icon={<Printer />}
      title={`Invoice ${invoice.invoiceId || "without a number"}`}
      description={`${invoice.companyName}, tax invoice on A4`}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn-ink" onClick={() => printNow()}>
            <Printer aria-hidden /> Print
          </button>
        </>
      }
    >
      {clientNote && (
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-amber-soft px-4 py-3">
          <p className="min-w-0 text-[13px] text-ink">{clientNote}</p>
          {client && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => openOverlay({ kind: "client", clientId: client.id })}>
              Edit client
            </button>
          )}
        </div>
      )}
      <div className="-mx-2 overflow-x-auto rounded-[18px] bg-surface-2 p-2 sm:p-4">
        <PrintArea>
          <TaxDocument
            kind="tax_invoice"
            number={invoice.invoiceId}
            issueDate={invoice.issueDate || invoice.createdAt?.slice(0, 10) || invoice.dueDate}
            dueDate={invoice.dueDate}
            company={company}
            billTo={{
              name: client?.companyName || invoice.companyName,
              contactPerson: client?.contactPerson || undefined,
              addressLines: addressLines(client?.billingAddress),
              state: client?.state || undefined,
              gstin: client?.gstin || undefined,
            }}
            placeOfSupply={invoice.placeOfSupply || placeOfSupplyFor(client ?? undefined, company)}
            lines={[{ description: description || "Software development services", sac: invoice.sac || DEFAULT_SAC, amount: taxableOf(invoice) }]}
            gstRate={typeof invoice.gstRate === "number" ? invoice.gstRate : 18}
            notes={invoice.notes || undefined}
          />
        </PrintArea>
      </div>
    </Dialog>
  );
}
