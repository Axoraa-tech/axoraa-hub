import React from "react";
import { BrandMark } from "@/components/ui/BrandMark";
import { clientFacingEmail, type CompanyProfile } from "@/lib/company";
import { formatInrFull, numberToIndianWords } from "@/lib/format";
import { gstSplit } from "@/lib/gst";
import type { DocLine } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** '2026-11-25' → '25 Nov 2026'. Pure string work, so it renders the same on server and client. */
function docDate(day?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day ?? "");
  if (!m) return day ?? "";
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

function rupees(n: number): string {
  let whole = Math.floor(n);
  let paise = Math.round((n - whole) * 100);
  if (paise === 100) {
    whole += 1;
    paise = 0;
  }
  const words = numberToIndianWords(whole);
  return paise ? `Rupees ${words} and ${numberToIndianWords(paise).toLowerCase()} paise only` : `Rupees ${words} only`;
}

function Row({ label, value, strong = false }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-6 py-1.5 ${strong ? "border-t border-ink/80 pt-2 text-heading text-ink" : "text-table text-ink-2"}`}>
      <span>{label}</span>
      <span className="tabular-nums text-ink">{value}</span>
    </div>
  );
}

export interface TaxDocumentProps {
  kind: "tax_invoice" | "quotation";
  number: string;
  issueDate: string;
  dueDate?: string;
  validUntil?: string;
  company: CompanyProfile;
  billTo: { name: string; contactPerson?: string; addressLines?: string[]; state?: string; gstin?: string };
  placeOfSupply: string;
  lines: DocLine[];
  gstRate: number;
  notes?: string;
  paymentInstructions?: string;
}

/** A4 tax invoice or quotation. Always drawn on the light paper palette. */
export function TaxDocument({
  kind,
  number,
  issueDate,
  dueDate,
  validUntil,
  company,
  billTo,
  placeOfSupply,
  lines,
  gstRate,
  notes,
  paymentInstructions,
}: TaxDocumentProps) {
  const email = clientFacingEmail(company);
  const taxable = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const split = gstSplit({ taxable, rate: gstRate, supplierState: company.state, placeOfSupply });
  const title = kind === "tax_invoice" ? "Tax invoice" : "Quotation";
  const addressLine = [company.city, company.state, company.pincode].filter(Boolean).join(", ");
  const half = gstRate / 2;
  const payment = paymentInstructions ?? company.paymentInstructions;

  const missing: string[] = [];
  if (!company.gstin) missing.push("GSTIN");
  if (!company.addressLines?.length) missing.push("address");
  if (!company.phone) missing.push("phone number");
  const missingText =
    missing.length === 0
      ? null
      : `Add the ${missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}`} in Settings, Company profile.`;

  return (
    <article
      aria-label={`${title} ${number}`}
      className="paper mx-auto w-full min-w-[560px] max-w-[794px] rounded-sm border border-line px-6 py-8 text-body text-ink sm:px-12 sm:py-12 print:min-w-0 print:max-w-none print:rounded-none print:border-0 print:p-0"
    >
      {missingText && (
        <p className="no-print mb-6 rounded-[14px] bg-amber-soft px-4 py-2.5 text-table text-warning">{missingText}</p>
      )}

      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <BrandMark size={36} className="[print-color-adjust:exact] [-webkit-print-color-adjust:exact]" />
            <p className="text-title text-ink">{company.legalName || company.name}</p>
          </div>
          <div className="mt-2 space-y-0.5 text-table text-ink-2">
            {company.addressLines?.map((l) => (
              <p key={l}>{l}</p>
            ))}
            {addressLine && <p>{addressLine}</p>}
            {company.gstin && (
              <p>
                GSTIN <span className="font-mono text-ink">{company.gstin}</span>
              </p>
            )}
            <p>{[email, company.phone, company.website].filter(Boolean).join(", ")}</p>
          </div>
        </div>
        <div className="shrink-0 sm:text-right">
          <h1 className="text-title text-ink">{title}</h1>
          <dl className="mt-2 grid grid-cols-[auto_auto] justify-start gap-x-4 gap-y-0.5 text-table sm:justify-end">
            <dt className="text-ink-3">Number</dt>
            <dd className="font-mono text-ink">{number}</dd>
            <dt className="text-ink-3">Date</dt>
            <dd className="tabular-nums text-ink">{docDate(issueDate)}</dd>
            {kind === "tax_invoice" && dueDate && (
              <>
                <dt className="text-ink-3">Due</dt>
                <dd className="tabular-nums text-ink">{docDate(dueDate)}</dd>
              </>
            )}
            {kind === "quotation" && validUntil && (
              <>
                <dt className="text-ink-3">Valid until</dt>
                <dd className="tabular-nums text-ink">{docDate(validUntil)}</dd>
              </>
            )}
          </dl>
        </div>
      </header>

      <section className="mt-8 grid gap-6 border-y border-line py-5 sm:grid-cols-2">
        <div>
          <p className="text-meta text-ink-3">Bill to</p>
          <p className="mt-1 text-heading text-ink">{billTo.name}</p>
          <div className="mt-1 space-y-0.5 text-table text-ink-2">
            {billTo.contactPerson && <p>Attn: {billTo.contactPerson}</p>}
            {billTo.addressLines?.map((l) => (
              <p key={l}>{l}</p>
            ))}
            {billTo.state && <p>{billTo.state}</p>}
            {billTo.gstin && (
              <p>
                GSTIN <span className="font-mono text-ink">{billTo.gstin}</span>
              </p>
            )}
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-meta text-ink-3">Place of supply</p>
          <p className="mt-1 text-body text-ink">Place of supply: {placeOfSupply}</p>
          <p className="mt-0.5 text-table text-ink-2">{split.intraState ? "Intra-state supply, CGST and SGST apply" : "Inter-state supply, IGST applies"}</p>
        </div>
      </section>

      <table className="mt-6 w-full border-collapse text-table">
        <thead>
          <tr className="border-b border-line-strong text-left text-meta text-ink-2">
            <th scope="col" className="w-8 py-2 pr-2 font-medium">
              #
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Description
            </th>
            <th scope="col" className="w-24 py-2 pr-4 font-medium">
              SAC
            </th>
            <th scope="col" className="w-32 py-2 text-right font-medium">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-b border-line align-top">
              <td className="py-2.5 pr-2 tabular-nums text-ink-3">{i + 1}</td>
              <td className="whitespace-pre-line py-2.5 pr-4 text-ink">{l.description}</td>
              <td className="py-2.5 pr-4 font-mono text-ink-2">{l.sac || "–"}</td>
              <td className="py-2.5 text-right tabular-nums text-ink">{formatInrFull(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <div className="w-full max-w-[320px]">
          <Row label="Taxable value" value={formatInrFull(taxable)} />
          {split.intraState ? (
            <>
              <Row label={`CGST at ${half}%`} value={formatInrFull(split.cgst)} />
              <Row label={`SGST at ${half}%`} value={formatInrFull(split.sgst)} />
            </>
          ) : (
            <Row label={`IGST at ${gstRate}%`} value={formatInrFull(split.igst)} />
          )}
          <Row label="Total" value={formatInrFull(split.total)} strong />
        </div>
      </div>
      <p className="mt-2 text-right text-table text-ink-2">{rupees(split.total)}</p>

      {(payment || notes) && (
        <section className="mt-8 grid gap-6 sm:grid-cols-2">
          {payment && (
            <div>
              <p className="text-meta text-ink-3">Payment instructions</p>
              <p className="mt-1 whitespace-pre-line text-table text-ink">{payment}</p>
            </div>
          )}
          {notes && (
            <div>
              <p className="text-meta text-ink-3">Notes</p>
              <p className="mt-1 whitespace-pre-line text-table text-ink">{notes}</p>
            </div>
          )}
        </section>
      )}

      <footer className="mt-10 border-t border-line pt-4 text-meta text-ink-3">
        Payment queries: {email}
      </footer>
    </article>
  );
}
