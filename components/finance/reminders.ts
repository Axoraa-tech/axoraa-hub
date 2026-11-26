// Payment reminder text for an invoice. Pure: no browser APIs, so it can be tested anywhere.
// Client-facing addresses always come from the company profile (clientFacingEmail), never a literal.
import { clientFacingEmail, resolveCompany, signature, type CompanyProfile, type EmailDraft } from "@/lib/company";
import { formatDateIST, formatInrFull } from "@/lib/format";
import type { ClientMasterRecord, PaymentBillingRecord } from "@/lib/types";

type ClientLike = Pick<ClientMasterRecord, "companyName"> & Partial<Pick<ClientMasterRecord, "contactPerson" | "contactEmail" | "contactPhone">>;

/** What is still owed on the invoice (balance after receipts and TDS). */
export function reminderAmount(invoice: PaymentBillingRecord): number {
  return Math.max(0, Number(invoice.pendingAmount) || 0);
}

function firstName(name?: string): string {
  const t = (name ?? "").trim();
  return t ? t.split(/\s+/)[0] : "";
}

function dueLine(invoice: PaymentBillingRecord): string {
  const due = invoice.dueDate ? formatDateIST(invoice.dueDate, { year: true }) : "";
  if (!due) return "is now due";
  return invoice.status === "Overdue" ? `was due on ${due}` : `is due on ${due}`;
}

/** A polite payment reminder email. cc goes to the company's client-facing address. */
export function emailReminder(
  invoice: PaymentBillingRecord,
  client: ClientLike | null | undefined,
  companyInput: Partial<CompanyProfile> | null | undefined,
  senderName?: string
): EmailDraft {
  const company = resolveCompany(companyInput ?? undefined);
  const companyName = company.name || "Axoraa";
  const amount = formatInrFull(reminderAmount(invoice));
  const greeting = firstName(client?.contactPerson) ? `Dear ${firstName(client?.contactPerson)},` : "Dear Sir or Madam,";
  const what = invoice.milestoneDescription?.trim() ? ` for ${invoice.milestoneDescription.trim()}` : "";
  const lines = [
    greeting,
    "",
    `I hope you are well. This is a gentle reminder that invoice ${invoice.invoiceId}${what} ${dueLine(invoice)}. The balance of ${amount} is still open on our side.`,
  ];
  if (company.paymentInstructions.trim()) {
    lines.push("", "You can pay to:", company.paymentInstructions.trim());
  }
  lines.push(
    "",
    "If you have already paid, please share the payment reference and we will update our records. If anything on the invoice needs a correction, just reply to this email.",
    "",
    "Thank you for working with us.",
    "",
    signature(company, senderName)
  );
  return {
    to: client?.contactEmail?.trim() || undefined,
    cc: clientFacingEmail(company),
    subject: `Payment reminder for ${invoice.invoiceId}, ${companyName}`,
    body: lines.join("\n"),
  };
}

/** A short WhatsApp message for the same reminder. */
export function whatsappReminder(
  invoice: PaymentBillingRecord,
  client: ClientLike | null | undefined,
  companyInput: Partial<CompanyProfile> | null | undefined,
  senderName?: string
): string {
  const company = resolveCompany(companyInput ?? undefined);
  const hello = firstName(client?.contactPerson) ? `Hello ${firstName(client?.contactPerson)},` : "Hello,";
  const amount = formatInrFull(reminderAmount(invoice));
  const from = [senderName?.trim(), company.name || "Axoraa"].filter(Boolean).join(", ");
  const parts = [
    `${hello} a gentle reminder that invoice ${invoice.invoiceId} for ${amount} ${dueLine(invoice)}.`,
    company.paymentInstructions.trim() ? `Payment details: ${company.paymentInstructions.trim().replace(/\s*\n\s*/g, ", ")}.` : "",
    "If it is already paid, please share the reference. Thank you.",
    from ? `${from}` : "",
  ];
  return parts.filter(Boolean).join("\n");
}
