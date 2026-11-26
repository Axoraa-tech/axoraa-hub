"use client";

import React, { useMemo, useState } from "react";
import { Download, IndianRupee, Mail, MessageCircle, PenLine, Pencil, Plus, Printer, ReceiptIndianRupee, Search, Trash2 } from "lucide-react";
import { useHub } from "@/lib/hub/context";
import { can } from "@/lib/hub/permissions";
import type { ClientMasterRecord, PaymentBillingRecord } from "@/lib/types";
import { delta, inRange, invoiceTds, type Range } from "@/lib/analytics";
import { usePeriod } from "@/lib/usePeriod";
import { formatDateIST, formatInr, formatInrFull } from "@/lib/format";
import { PAYMENT_COLUMNS, downloadCsv } from "@/lib/export";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import type { MenuItem } from "@/components/ui/Menu";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { CardHeader, Delta, EmptyState, PeriodPicker, Segmented, StatusPill } from "@/components/ui/primitives";
import { ComposeActions } from "@/components/ui/ComposeActions";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { SplitBar, StackedBars } from "@/components/charts/Charts";
import { RecordPaymentDialog } from "@/components/finance/RecordPaymentDialog";
import { emailReminder, whatsappReminder } from "@/components/finance/reminders";
import { SearchField, UnsyncedNotice, flashFor } from "./ClientsView";

type StatusFilter = "all" | "pending" | "overdue" | "paid";
const STATUS_FILTERS: StatusFilter[] = ["all", "pending", "overdue", "paid"];
const STATUS_OF: Record<Exclude<StatusFilter, "all">, PaymentBillingRecord["status"]> = { pending: "Pending", overdue: "Overdue", paid: "Fully Paid" };

/** The day an invoice belongs to for period filters. */
function invoiceDay(p: PaymentBillingRecord): string | undefined {
  return p.issueDate || p.dueDate || p.createdAt?.slice(0, 10);
}

function totals(rows: PaymentBillingRecord[]) {
  let invoiced = 0;
  let received = 0;
  let tds = 0;
  let balance = 0;
  let overdue = 0;
  for (const p of rows) {
    invoiced += Number(p.invoicedAmount) || 0;
    received += Number(p.receivedAmount) || 0;
    tds += invoiceTds(p);
    balance += Number(p.pendingAmount) || 0;
    overdue += Number(p.overdueAmount) || 0;
  }
  return { invoiced, received, tds, balance, overdue, count: rows.length };
}

function inPeriod(rows: PaymentBillingRecord[], r: Pick<Range, "start" | "end">) {
  return rows.filter((p) => inRange(invoiceDay(p), r));
}

/* ------------------------------------------------------------------ stat card */

function StatCard({
  label,
  value,
  sub,
  tone = "light",
  change,
  invert = false,
  baseline,
  delay,
}: {
  label: string;
  value: number;
  sub: string;
  tone?: "light" | "ink" | "coral";
  change: number | null;
  invert?: boolean;
  baseline: string;
  delay: number;
}) {
  const shell = tone === "ink" ? "card-ink" : tone === "coral" ? "card bg-coral! text-white" : "card";
  const muted = tone === "light" ? "text-ink-3" : "text-white/65";
  return (
    <div className={`${shell} flex min-h-[150px] min-w-0 animate-rise flex-col justify-between p-5 sm:p-6`} style={{ animationDelay: `${delay}ms` }}>
      <span className={`text-[13px] ${muted}`}>{label}</span>
      <div className="mt-4 min-w-0">
        <div className="num truncate text-[34px] sm:text-[40px]">{formatInr(value)}</div>
        <div className={`mt-2 truncate text-[12.5px] ${muted}`}>{sub}</div>
        <div className="mt-1 truncate">
          {tone === "coral" ? (
            <span className="text-[12px] text-white/80">
              {change === null ? `nothing in ${baseline}` : `${change > 0 ? "+" : ""}${change}% vs ${baseline}`}
            </span>
          ) : (
            <Delta value={change} invert={invert} baseline={baseline} dark={tone === "ink"} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ reminder dialog */

function ReminderDialog({
  invoice,
  client,
  channel,
  onClose,
}: {
  invoice: PaymentBillingRecord;
  client: ClientMasterRecord | null;
  channel: "email" | "whatsapp";
  onClose: () => void;
}) {
  const { data, viewer, openOverlay } = useHub();
  const company = data.settings?.company;
  const email = channel === "email" ? emailReminder(invoice, client, company, viewer.name) : null;
  const text = channel === "whatsapp" ? whatsappReminder(invoice, client, company, viewer.name) : "";
  const phone = client?.contactPhone?.trim();
  const missing = channel === "email" ? !email?.to : !phone;

  return (
    <Dialog
      open
      onClose={onClose}
      icon={channel === "email" ? <Mail /> : <MessageCircle />}
      title={channel === "email" ? "Email reminder" : "WhatsApp reminder"}
      description={`${invoice.invoiceId}, ${invoice.companyName}`}
      size="md"
      footer={
        <>
          <button type="button" className="btn btn-plain" onClick={onClose}>
            Close
          </button>
          {email ? <ComposeActions email={email} size="sm" /> : <ComposeActions whatsapp={{ phone: phone || undefined, text }} size="sm" />}
        </>
      }
    >
      <div className="space-y-3">
        {missing && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-amber-soft px-4 py-3">
            <p className="min-w-0 text-[13px] text-ink">
              {channel === "email"
                ? "This client has no email address. Add one, or type it in your mail app."
                : "This client has no mobile number, so copy the text and send it yourself."}
            </p>
            {client && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  onClose();
                  openOverlay({ kind: "client", clientId: client.id });
                }}
              >
                Edit client
              </button>
            )}
          </div>
        )}
        <div className="card-inset p-4">
          {email ? (
            <>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]">
                <dt className="text-ink-3">To</dt>
                <dd className="min-w-0 truncate text-ink">{email.to || "Not set"}</dd>
                <dt className="text-ink-3">Cc</dt>
                <dd className="min-w-0 truncate text-ink">{email.cc}</dd>
              </dl>
              <p className="mt-3 text-[14px] font-medium text-ink">{email.subject}</p>
              <p className="mt-2 whitespace-pre-line text-[13px] text-ink-2">{email.body}</p>
            </>
          ) : (
            <>
              <p className="text-[12.5px] text-ink-3">To {phone || "no number on file"}</p>
              <p className="mt-2 whitespace-pre-line text-[13.5px] text-ink">{text}</p>
            </>
          )}
        </div>
        <p className="text-[12px] text-ink-3">Read it before sending. Nothing is sent from the hub.</p>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ view */

export function InvoicesView() {
  const { data, viewer, features, params, setParams, openOverlay, registerSearch } = useHub();
  const toast = useToast();
  const confirm = useConfirm();

  const dates = useMemo(() => data.payments.map(invoiceDay), [data.payments]);
  const period = usePeriod(dates, "year");
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const [status, setStatus] = useState<StatusFilter>(() => {
    const s = params.get("status");
    return STATUS_FILTERS.includes(s as StatusFilter) ? (s as StatusFilter) : "all";
  });
  const [paying, setPaying] = useState<string | null>(null);
  const [reminder, setReminder] = useState<{ id: string; channel: "email" | "whatsapp" } | null>(null);

  const q = query.trim().toLowerCase();
  const canEdit = can(viewer, "invoice.edit");
  const canAssist = features.assistant.configured && can(viewer, "agent.run", { data, agentKey: "payment_reminder" });

  const clientsById = useMemo(() => new Map(data.clients.map((c) => [c.clientId, c])), [data.clients]);
  const unsyncedIds = useMemo(() => new Set(data.unsynced.map((u) => u.id)), [data.unsynced]);

  const current = useMemo(() => inPeriod(data.payments, period.range), [data.payments, period.range]);
  const previous = useMemo(() => inPeriod(data.payments, period.prev), [data.payments, period.prev]);
  const now = totals(current);
  const before = totals(previous);

  // Outstanding money and searches look across every period; otherwise the table follows the period.
  const acrossPeriods = !!q || status === "pending" || status === "overdue";
  const rows = useMemo(() => {
    const base = acrossPeriods ? data.payments : current;
    return base.filter(
      (p) =>
        (status === "all" || p.status === STATUS_OF[status]) &&
        (!q ||
          [p.invoiceId, p.companyName, p.clientId, p.milestoneDescription, p.projectName, clientsById.get(p.clientId)?.contactPerson].some((f) =>
            (f ?? "").toLowerCase().includes(q)
          ))
    );
  }, [acrossPeriods, data.payments, current, status, q, clientsById]);

  const chartData = useMemo(
    () =>
      period.range.buckets.map((b) => {
        const inBucket = current.filter((p) => inRange(invoiceDay(p), b));
        const paid = inBucket.reduce((s, p) => s + (Number(p.receivedAmount) || 0) + invoiceTds(p), 0);
        const overdue = inBucket.reduce((s, p) => s + (Number(p.overdueAmount) || 0), 0);
        const due = inBucket.reduce((s, p) => s + (Number(p.pendingAmount) || 0), 0) - overdue;
        return {
          label: b.label,
          title: b.title,
          parts: [
            { key: "paid" as const, value: paid },
            { key: "due" as const, value: Math.max(0, due) },
            { key: "overdue" as const, value: overdue },
          ],
        };
      }),
    [period.range.buckets, current]
  );

  if (!data.ready) return <SkeletonPage />;

  const baseline = period.prev.label;
  const updateQuery = (v: string) => {
    setQuery(v);
    setParams({ q: v.trim() || null });
  };
  const updateStatus = (v: StatusFilter) => {
    setStatus(v);
    setParams({ status: v === "all" ? null : v });
  };

  const remove = async (p: PaymentBillingRecord) => {
    const ok = await confirm({
      title: `Delete invoice ${p.invoiceId}?`,
      body: "The invoice and every payment recorded against it are removed for everyone.",
      confirmLabel: "Delete invoice",
      tone: "danger",
    });
    if (!ok) return;
    const res = await data.deletePayment(p.id);
    toast(res.ok ? { message: `Deleted ${p.invoiceId}` } : { message: `Couldn't delete ${p.invoiceId}. ${res.error}`, tone: "negative" });
  };

  const actions = (p: PaymentBillingRecord): MenuItem[] => {
    const open = p.status !== "Fully Paid";
    return [
      ...(canEdit ? [{ label: "Record payment", icon: <IndianRupee />, disabled: !open, onSelect: () => setPaying(p.id) }] : []),
      { label: "Print invoice", icon: <Printer />, onSelect: () => openOverlay({ kind: "invoice_print", invoiceId: p.id }) },
      { label: "Email reminder", icon: <Mail />, disabled: !open, separatorBefore: true, onSelect: () => setReminder({ id: p.id, channel: "email" }) },
      { label: "WhatsApp reminder", icon: <MessageCircle />, disabled: !open, onSelect: () => setReminder({ id: p.id, channel: "whatsapp" }) },
      ...(canAssist
        ? [
            {
              label: "Draft reminder with assistant",
              icon: <PenLine />,
              disabled: !open,
              onSelect: () => openOverlay({ kind: "agent", agentKey: "payment_reminder", ref: { type: "invoice", id: p.id } }),
            },
          ]
        : []),
      ...(canEdit
        ? [
            { label: "Edit invoice", icon: <Pencil />, separatorBefore: true, onSelect: () => openOverlay({ kind: "invoice", invoiceId: p.id }) },
            { label: "Delete invoice", icon: <Trash2 />, tone: "danger" as const, onSelect: () => void remove(p) },
          ]
        : []),
    ];
  };

  const columns: TableColumn<PaymentBillingRecord>[] = [
    { id: "no", header: "Invoice no.", mono: true, sortValue: (p) => p.invoiceId, cell: (p) => <span className="whitespace-nowrap text-[12.5px]">{p.invoiceId || "Pending number"}</span> },
    {
      id: "client",
      header: "Client",
      sortValue: (p) => p.companyName,
      cell: (p) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-ink">{p.companyName}</div>
          {p.projectName && <div className="truncate text-[12px] text-ink-3">{p.projectName}</div>}
        </div>
      ),
    },
    { id: "milestone", header: "Milestone", truncate: true, hideBelow: "lg", width: "18%", cell: (p) => p.milestoneDescription },
    { id: "issued", header: "Issued", hideBelow: "lg", sortValue: (p) => invoiceDay(p), cell: (p) => (p.issueDate ? <span className="whitespace-nowrap tabular-nums text-ink-2">{formatDateIST(p.issueDate, { year: true })}</span> : null) },
    {
      id: "due",
      header: "Due",
      sortValue: (p) => p.dueDate,
      cell: (p) =>
        p.dueDate ? (
          <span className={`whitespace-nowrap tabular-nums ${p.status === "Overdue" ? "font-medium text-negative" : "text-ink-2"}`}>{formatDateIST(p.dueDate, { year: true })}</span>
        ) : null,
    },
    { id: "amount", header: "Amount", align: "right", sortValue: (p) => Number(p.invoicedAmount) || 0, cell: (p) => formatInrFull(p.invoicedAmount) },
    {
      id: "received",
      header: "Received",
      align: "right",
      sortValue: (p) => Number(p.receivedAmount) || 0,
      cell: (p) => (
        <div className="ml-auto w-[112px]">
          <div className="font-medium">{formatInrFull(p.receivedAmount)}</div>
          <div className="mt-1.5">
            <SplitBar
              height={6}
              parts={[
                { key: "r", value: (Number(p.receivedAmount) || 0) + invoiceTds(p), className: "bg-ink", label: "Settled" },
                { key: "p", value: (Number(p.pendingAmount) || 0) - (Number(p.overdueAmount) || 0), className: "hatch", label: "Due" },
                { key: "o", value: Number(p.overdueAmount) || 0, className: "bg-coral", label: "Overdue" },
              ]}
            />
          </div>
        </div>
      ),
    },
    { id: "tds", header: "TDS", align: "right", hideBelow: "lg", sortValue: (p) => invoiceTds(p), cell: (p) => (invoiceTds(p) > 0 ? formatInrFull(invoiceTds(p)) : <span className="text-ink-3">₹0</span>) },
    {
      id: "balance",
      header: "Balance",
      align: "right",
      sortValue: (p) => Number(p.pendingAmount) || 0,
      cell: (p) => <span className={p.pendingAmount > 0 ? "font-medium text-ink" : "text-ink-3"}>{formatInrFull(p.pendingAmount)}</span>,
    },
    { id: "status", header: "Status", sortValue: (p) => p.status, cell: (p) => <StatusPill status={p.status} /> },
  ];

  const payingInvoice = paying ? data.payments.find((p) => p.id === paying) ?? null : null;
  const reminderInvoice = reminder ? data.payments.find((p) => p.id === reminder.id) ?? null : null;

  const tableTitle =
    q && acrossPeriods
      ? "Matching invoices"
      : status === "overdue"
      ? "Overdue invoices"
      : status === "pending"
      ? "Invoices waiting for payment"
      : status === "paid"
      ? "Fully paid invoices"
      : "Invoices & collections";
  const tableSub = acrossPeriods ? "From every period" : `Issued in ${period.range.label}`;

  const empty =
    data.payments.length === 0 ? (
      <EmptyState
        icon={<ReceiptIndianRupee />}
        title="No invoices yet"
        body="Raise the first milestone invoice. It gets the next number, like AX/FY26/001."
        action={
          canEdit ? (
            <button type="button" className="btn btn-ink btn-sm" onClick={() => openOverlay({ kind: "invoice" })}>
              <Plus aria-hidden /> Add invoice
            </button>
          ) : undefined
        }
      />
    ) : (
      <EmptyState
        icon={<Search />}
        title={q ? `No invoices match "${query.trim()}"` : `No invoices in ${period.range.label} with this status`}
        body={q ? "Search by invoice number, client or milestone." : "Try another period, or show every status."}
        action={
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              updateQuery("");
              updateStatus("all");
            }}
          >
            Clear filters
          </button>
        }
      />
    );

  return (
    <div className="space-y-3 sm:space-y-4">
      <UnsyncedNotice entities={["payments"]} />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <PeriodPicker
          granularity={period.granularity}
          onGranularity={period.setGranularity}
          range={period.range}
          onShift={period.shift}
          onToday={period.reset}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="-mx-1 overflow-x-auto px-1 no-scrollbar">
            <Segmented
              label="Invoice status"
              value={status}
              onChange={updateStatus}
              options={[
                { value: "all", label: "All" },
                { value: "pending", label: "Pending" },
                { value: "overdue", label: "Overdue" },
                { value: "paid", label: "Fully paid" },
              ]}
            />
          </div>
          <SearchField value={query} onChange={updateQuery} label="Search invoices" placeholder="Invoice no., client or milestone" inputRef={registerSearch} />
        </div>
      </div>

      <section aria-label={`Collections for ${period.range.label}`} className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <div className="col-span-2 lg:col-span-1">
          <StatCard
            label="Invoiced"
            value={now.invoiced}
            sub={`${now.count} ${now.count === 1 ? "invoice" : "invoices"} in ${period.range.label}`}
            tone="ink"
            change={delta(now.invoiced, before.invoiced)}
            baseline={baseline}
            delay={0}
          />
        </div>
        <StatCard
          label="Received"
          value={now.received}
          sub={now.invoiced ? `${Math.round(((now.received + now.tds) / now.invoiced) * 100)}% settled` : "Nothing invoiced yet"}
          change={delta(now.received, before.received)}
          baseline={baseline}
          delay={50}
        />
        <StatCard
          label="TDS deducted"
          value={now.tds}
          sub="Claim it against Form 26AS"
          change={delta(now.tds, before.tds)}
          baseline={baseline}
          delay={100}
        />
        <StatCard
          label="Balance"
          value={now.balance}
          sub="Still to be paid"
          change={delta(now.balance, before.balance)}
          invert
          baseline={baseline}
          delay={150}
        />
        <StatCard
          label="Overdue"
          value={now.overdue}
          sub={`${current.filter((p) => p.status === "Overdue").length} past the due date`}
          tone={now.overdue > 0 ? "coral" : "light"}
          change={delta(now.overdue, before.overdue)}
          invert
          baseline={baseline}
          delay={200}
        />
      </section>

      <section className="card min-w-0 p-4 sm:p-6">
        <CardHeader
          title={period.granularity === "year" ? "Collections by month" : period.granularity === "quarter" ? "Collections by week" : "Collections by day"}
          subtitle={`Paid, due and overdue for invoices issued in ${period.range.label}`}
        />
        <div className="mt-6">
          <StackedBars
            ariaLabel={`Invoices issued in ${period.range.label}, split into paid, due and overdue`}
            data={chartData}
            format={(v) => formatInr(v)}
            height={220}
            emptyLabel={`No invoices issued in ${period.range.label}.`}
          />
        </div>
      </section>

      <section aria-labelledby="invoices-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div className="min-w-0">
            <h2 id="invoices-heading" className="text-[20px] font-medium leading-tight tracking-[-0.03em] text-ink">
              {tableTitle}
            </h2>
            <p className="mt-1 text-[13px] text-ink-3">{tableSub}</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!rows.length} onClick={() => downloadCsv(`axoraa-invoices-${period.range.label.replace(/[^\w]+/g, "-")}`, rows, PAYMENT_COLUMNS)}>
            <Download aria-hidden className="h-3.5 w-3.5" /> CSV
          </button>
        </div>
        <DataTable
          caption="Invoices"
          rows={rows}
          columns={columns}
          rowKey={(p) => p.id}
          onRowClick={(p) => openOverlay({ kind: "invoice", invoiceId: p.id })}
          flashKey={flashFor(data.lastSaved, "payments")}
          rowStatus={(p) => (unsyncedIds.has(p.id) ? "unsynced" : undefined)}
          rowActions={actions}
          rowLabel={(p) => `${p.invoiceId} ${p.companyName}`}
          initialSort={{ id: "due", dir: "desc" }}
          empty={empty}
          mobileCard={(p) => (
            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[14px] font-medium text-ink">{p.companyName}</span>
                <span className="shrink-0 text-[14px] font-medium tabular-nums text-ink">{formatInrFull(p.invoicedAmount)}</span>
              </div>
              <div className="mt-0.5 truncate font-mono text-[12px] text-ink-3">{p.invoiceId}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-ink-2">
                <StatusPill status={p.status} />
                {p.pendingAmount > 0 && <span className="chip chip-outline">{formatInrFull(p.pendingAmount)} due</span>}
                {p.dueDate && <span className="tabular-nums">Due {formatDateIST(p.dueDate, { year: true })}</span>}
              </div>
            </div>
          )}
          footer={
            rows.length
              ? `${rows.length} ${rows.length === 1 ? "invoice" : "invoices"}, ${formatInrFull(rows.reduce((s, p) => s + (Number(p.pendingAmount) || 0), 0))} still to collect`
              : undefined
          }
        />
        <div className="flex flex-wrap items-center gap-4 px-1 text-[12px] text-ink-3">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-ink" />
            Paid or TDS
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="hatch h-2.5 w-2.5 rounded-full" />
            Due
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-coral" />
            Overdue
          </span>
        </div>
      </section>

      {payingInvoice && <RecordPaymentDialog key={payingInvoice.id} invoice={payingInvoice} onClose={() => setPaying(null)} />}
      {reminderInvoice && reminder && (
        <ReminderDialog
          key={`${reminderInvoice.id}:${reminder.channel}`}
          invoice={reminderInvoice}
          client={clientsById.get(reminderInvoice.clientId) ?? null}
          channel={reminder.channel}
          onClose={() => setReminder(null)}
        />
      )}
    </div>
  );
}
