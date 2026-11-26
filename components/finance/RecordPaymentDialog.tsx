"use client";

import React, { useState } from "react";
import { IndianRupee } from "lucide-react";
import { useHub } from "@/lib/hub/context";
import type { PaymentBillingRecord, PaymentReceipt } from "@/lib/types";
import { formatInrFull, newId, todayKeyIST } from "@/lib/format";
import { invoiceTds } from "@/lib/analytics";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/feedback";
import { DateInput, ErrorSummary, Field, Input, MoneyInput, Select } from "@/components/ui/form";
import { NotSavedBanner } from "./ClientEditor";

export const PAYMENT_MODES: PaymentReceipt["mode"][] = ["NEFT/RTGS", "UPI", "Cheque", "Cash", "Card", "Other"];
export const TDS_SECTIONS: NonNullable<PaymentReceipt["tdsSection"]>[] = ["194J", "194C", "Other"];

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Taxable value of an invoice: the stored figure, or the total with GST taken back out. */
export function taxableOf(inv: PaymentBillingRecord): number {
  if (typeof inv.taxableAmount === "number" && inv.taxableAmount > 0) return inv.taxableAmount;
  const rate = typeof inv.gstRate === "number" ? inv.gstRate : 18;
  return round2((Number(inv.invoicedAmount) || 0) / (1 + rate / 100));
}

/**
 * Receipts as stored, plus one opening receipt when the invoice only has a received figure from
 * before receipts were tracked. Without it, adding the first receipt would drop that figure.
 */
function receiptsWithOpening(inv: PaymentBillingRecord): PaymentReceipt[] {
  const list = Array.isArray(inv.payments) ? inv.payments : [];
  if (list.length || !(Number(inv.receivedAmount) > 0)) return list;
  return [
    {
      id: newId("rcpt"),
      date: inv.issueDate || inv.dueDate || todayKeyIST(),
      amount: Number(inv.receivedAmount),
      mode: "Other",
      reference: "Received before receipts were tracked",
    },
  ];
}

type Errors = Partial<Record<"amount" | "tds" | "date", string>>;

export function RecordPaymentDialog({ invoice, onClose }: { invoice: PaymentBillingRecord; onClose: () => void }) {
  const { data } = useHub();
  const toast = useToast();
  const balance = Math.max(0, Number(invoice.pendingAmount) || 0);

  const [amount, setAmount] = useState<number | null>(balance || null);
  const [amountTouched, setAmountTouched] = useState(false);
  const [tds, setTds] = useState<number | null>(0);
  const [section, setSection] = useState<NonNullable<PaymentReceipt["tdsSection"]>>("194J");
  const [date, setDate] = useState(() => todayKeyIST());
  const [mode, setMode] = useState<PaymentReceipt["mode"]>("NEFT/RTGS");
  const [reference, setReference] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failedId, setFailedId] = useState<string | null>(null);

  const tdsValue = tds ?? 0;
  const amountValue = amount ?? 0;
  const suggestedTds = round2(taxableOf(invoice) * 0.1);
  const after = round2(balance - amountValue - tdsValue);

  const validate = (): Errors => {
    const e: Errors = {};
    if (amountValue < 0) e.amount = "Amount can't be negative";
    if (tdsValue < 0) e.tds = "TDS can't be negative";
    if (amountValue + tdsValue <= 0) e.amount = "Enter the amount received, the TDS deducted, or both";
    else if (amountValue + tdsValue > balance + 0.5) e.amount = `Amount and TDS add up to more than the balance of ${formatInrFull(balance)}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) e.date = "Choose the date the money arrived";
    return e;
  };
  const errors = submitted ? validate() : {};
  const summary = (["amount", "tds", "date"] as const)
    .filter((k) => errors[k])
    .map((k) => ({ field: `pay-${k}`, message: errors[k]! }));

  const setTdsAndAmount = (v: number | null) => {
    setTds(v);
    if (!amountTouched) setAmount(Math.max(0, round2(balance - (v ?? 0))) || null);
  };

  const save = async () => {
    setSubmitted(true);
    if (Object.keys(validate()).length) return;
    setSaving(true);
    const before = { payments: invoice.payments ?? [], receivedAmount: invoice.receivedAmount };
    const receipt: PaymentReceipt = {
      id: newId("rcpt"),
      date,
      amount: round2(amountValue),
      mode,
      reference: reference.trim(),
      ...(tdsValue > 0 ? { tdsAmount: round2(tdsValue), tdsSection: section } : {}),
    };
    const payments = [...receiptsWithOpening(invoice), receipt];
    const received = payments.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    try {
      const res = await data.savePayment({ payments, receivedAmount: round2(received) }, invoice.id);
      if (!res.ok) {
        setFailedId(res.record.id);
        return;
      }
      const what = tdsValue > 0 ? `Recorded ${formatInrFull(receipt.amount)} received and ${formatInrFull(tdsValue)} TDS` : `Recorded ${formatInrFull(receipt.amount)} received`;
      toast({
        message: what,
        tone: "positive",
        action: {
          label: "Undo",
          onClick: () => {
            void data.savePayment(before, invoice.id).then((r) => {
              toast(r.ok ? { message: `Removed the payment on ${invoice.invoiceId}` } : { message: "Undo kept on this device. Not saved to Google Sheets yet.", tone: "negative" });
            });
          },
        },
      });
      onClose();
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Couldn't record the payment.", tone: "negative" });
    } finally {
      setSaving(false);
    }
  };

  const tdsSoFar = invoiceTds(invoice);

  return (
    <Dialog
      open
      onClose={onClose}
      icon={<IndianRupee />}
      title="Record payment"
      description={`${invoice.invoiceId}, ${invoice.companyName}`}
      size="md"
      footer={
        <>
          {failedId ? (
            // The receipt is already kept on this device; recording again would add it twice.
            <button type="button" className="btn btn-ink" onClick={onClose}>
              Close
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="btn btn-ink" disabled={saving} onClick={() => void save()}>
                {saving ? "Saving" : "Record payment"}
              </button>
            </>
          )}
        </>
      }
    >
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!failedId) void save();
        }}
      >
        {failedId && <NotSavedBanner id={failedId} />}
        <ErrorSummary errors={summary} />

        <div className="grid grid-cols-3 gap-2">
          <div className="card-inset min-w-0 p-3.5">
            <div className="truncate text-[12px] text-ink-3">Invoice total</div>
            <div className="mt-2 truncate text-[15px] font-medium tabular-nums text-ink">{formatInrFull(invoice.invoicedAmount)}</div>
          </div>
          <div className="card-inset min-w-0 p-3.5">
            <div className="truncate text-[12px] text-ink-3">Received so far</div>
            <div className="mt-2 truncate text-[15px] font-medium tabular-nums text-ink">
              {formatInrFull(invoice.receivedAmount)}
              {tdsSoFar > 0 && <span className="block text-[12px] font-normal text-ink-3">+ {formatInrFull(tdsSoFar)} TDS</span>}
            </div>
          </div>
          <div className="card-inset min-w-0 p-3.5">
            <div className="truncate text-[12px] text-ink-3">Balance</div>
            <div className="mt-2 truncate text-[15px] font-medium tabular-nums text-ink">{formatInrFull(balance)}</div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount received" htmlFor="pay-amount" required error={errors.amount}>
            <MoneyInput
              id="pay-amount"
              value={amount}
              invalid={!!errors.amount}
              onChange={(v) => {
                setAmountTouched(true);
                setAmount(v);
              }}
            />
          </Field>
          <Field
            label="TDS deducted"
            htmlFor="pay-tds"
            error={errors.tds}
            hint={
              <>
                Clients often deduct 10% under 194J.{" "}
                {suggestedTds > 0 && (
                  <button type="button" className="font-medium text-ink underline underline-offset-2" onClick={() => setTdsAndAmount(Math.min(suggestedTds, balance))}>
                    Use {formatInrFull(suggestedTds)}
                  </button>
                )}
              </>
            }
          >
            <MoneyInput id="pay-tds" value={tds} invalid={!!errors.tds} onChange={setTdsAndAmount} />
          </Field>
          {tdsValue > 0 && (
            <Field label="TDS section" htmlFor="pay-section">
              <Select id="pay-section" value={section} onChange={(e) => setSection(e.target.value as typeof section)}>
                {TDS_SECTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s === "Other" ? "Other section" : `Section ${s}`}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Received on" htmlFor="pay-date" required error={errors.date}>
            <DateInput id="pay-date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Mode" htmlFor="pay-mode">
            <Select id="pay-mode" value={mode} onChange={(e) => setMode(e.target.value as PaymentReceipt["mode"])}>
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reference" htmlFor="pay-ref" hint="UTR, UPI or cheque number" className={tdsValue > 0 ? "" : "sm:col-span-2"}>
            <Input id="pay-ref" className="font-mono" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR or cheque no." />
          </Field>
        </div>

        <p className="rounded-[18px] bg-surface-2 px-4 py-3 text-[13px] text-ink-2">
          {after <= 0.5 ? (
            <>This settles the invoice. It will show as fully paid.</>
          ) : (
            <>
              Balance after this payment: <span className="font-medium tabular-nums text-ink">{formatInrFull(Math.max(0, after))}</span>
            </>
          )}
        </p>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}
