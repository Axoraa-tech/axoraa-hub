"use client";

import React, { useMemo, useState } from "react";
import { Download, Mail, MapPin, Pencil, PenLine, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { inRange, visitLinksDeal } from "@/lib/analytics";
import { clientFacingEmail, signature } from "@/lib/company";
import { INTERACTION_COLUMNS, downloadCsv } from "@/lib/export";
import { formatDateIST, todayKeyIST } from "@/lib/format";
import { useHub } from "@/lib/hub/context";
import { can } from "@/lib/hub/permissions";
import { MARKETING_NAMES } from "@/lib/people";
import { usePeriod } from "@/lib/usePeriod";
import type { MarketingDeal, MarketingInteraction } from "@/lib/types";
import { ComposeActions } from "@/components/ui/ComposeActions";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Select } from "@/components/ui/form";
import type { MenuItem } from "@/components/ui/Menu";
import { Avatar, EmptyState, PeriodPicker, Segmented } from "@/components/ui/primitives";
import { DelayedSkeleton, SkeletonRows } from "@/components/ui/Skeleton";
import { StatusDot, type Tone } from "@/components/ui/Status";

const INTEREST_TONE: Record<string, Tone> = { Hot: "negative", Warm: "warning", Cold: "neutral" };
const OUTCOMES = ["Positive - Advancing", "Needs Demo", "Proposal Requested", "Follow-up Required", "Cold / Unresponsive", "Closed - Lost"];
const MODE_SHORT: Record<string, string> = { "Physical (On-site)": "On-site", "Virtual (Video)": "Video", "Phone Call": "Phone" };
const lc = (s: string | null | undefined) => (s ?? "").toLowerCase();

/** Every visit and call, linked to its deal, with recap emails and the assistant. */
export function VisitsView() {
  const { data, viewer, features, params, openOverlay, registerSearch } = useHub();
  const toast = useToast();
  const confirm = useConfirm();

  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const [rep, setRep] = useState(() => params.get("rep") ?? "all");
  const [interest, setInterest] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [scope, setScope] = useState<"all" | "period">("all");
  const [recap, setRecap] = useState<MarketingInteraction | null>(null);

  const dates = useMemo(() => data.interactions.map((i) => i.date), [data.interactions]);
  const period = usePeriod(dates, "month");
  const privileged = viewer.privileged;
  const reps = useMemo(() => [...new Set([...MARKETING_NAMES, ...data.interactions.map((i) => i.marketingPerson).filter(Boolean)])], [data.interactions]);

  const dealFor = useMemo(() => {
    const map = new Map<string, MarketingDeal | null>();
    for (const v of data.interactions) map.set(v.id, data.deals.find((d) => visitLinksDeal(v, d)) ?? null);
    return map;
  }, [data.interactions, data.deals]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.interactions
      .filter((v) => {
        if (q && ![v.companyName, v.leadId, v.personsMet, v.agenda, v.discussionFeedback, v.marketingPerson].some((s) => lc(s).includes(q))) return false;
        if (privileged && rep !== "all" && v.marketingPerson !== rep) return false;
        if (interest !== "all" && v.interestLevel !== interest) return false;
        if (outcome !== "all" && v.interactionOutcome !== outcome) return false;
        if (scope === "period" && !inRange(v.date, period.range)) return false;
        return true;
      })
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [data.interactions, query, rep, interest, outcome, scope, period.range, privileged]);

  const filtered = query.trim() !== "" || (privileged && rep !== "all") || interest !== "all" || outcome !== "all" || scope !== "all";
  const clear = () => {
    setQuery("");
    setRep("all");
    setInterest("all");
    setOutcome("all");
    setScope("all");
  };
  const unsyncedIds = useMemo(() => new Set(data.unsynced.filter((u) => u.entity === "interactions").map((u) => u.id)), [data.unsynced]);
  const flashKey = data.lastSaved?.entity === "interactions" ? `${data.lastSaved.id}:${data.lastSaved.at}` : undefined;
  const hot = rows.filter((v) => v.interestLevel === "Hot").length;
  const advancing = rows.filter((v) => v.interactionOutcome === "Positive - Advancing").length;
  const onsite = rows.filter((v) => v.meetingMode === "Physical (On-site)").length;
  const canLog = can(viewer, "visit.edit");
  const canRecapAgent = features.assistant.configured && can(viewer, "agent.run", { agentKey: "visit_notes", data });

  if (!data.ready) {
    return (
      <DelayedSkeleton label="Loading visits">
        <SkeletonRows />
      </DelayedSkeleton>
    );
  }

  const remove = async (v: MarketingInteraction) => {
    const ok = await confirm({
      title: `Delete the visit to ${v.companyName || "this client"} on ${formatDateIST(v.date)}?`,
      body: "The visit is removed for everyone. The deal stays as it is.",
      confirmLabel: "Delete visit",
      tone: "danger",
    });
    if (!ok) return;
    const res = await data.deleteInteraction(v.id);
    toast(res.ok ? { message: "Deleted the visit" } : { message: `Couldn't delete the visit: ${res.error}`, tone: "negative" });
  };

  const columns: TableColumn<MarketingInteraction>[] = [
    { id: "date", header: "Date", sortValue: (v) => v.date, cell: (v) => <span className="whitespace-nowrap tabular-nums">{formatDateIST(v.date, { weekday: true })}</span> },
    {
      id: "company",
      header: "Company",
      sortValue: (v) => lc(v.companyName),
      cell: (v) => {
        const d = dealFor.get(v.id);
        return (
          <div className="min-w-0">
            {d ? (
              <button
                type="button"
                className="max-w-full truncate text-left font-medium text-ink underline decoration-ink/25 underline-offset-4 hover:decoration-ink"
                onClick={(e) => {
                  e.stopPropagation();
                  openOverlay({ kind: "deal", dealId: d.id });
                }}
              >
                {v.companyName || d.companyName}
              </button>
            ) : (
              <span className="block truncate font-medium text-ink">{v.companyName || "No company"}</span>
            )}
            <span className="block truncate text-[12px] text-ink-3">{d ? d.leadId : "Not linked to a deal"}</span>
          </div>
        );
      },
    },
    { id: "type", header: "Type", hideBelow: "lg", sortValue: (v) => v.interactionType, cell: (v) => <span className="whitespace-nowrap text-ink-2">{v.interactionType}</span> },
    { id: "mode", header: "Mode", hideBelow: "lg", sortValue: (v) => v.meetingMode, cell: (v) => <span className="chip chip-outline">{MODE_SHORT[v.meetingMode] ?? v.meetingMode}</span> },
    { id: "persons", header: "Persons met", hideBelow: "lg", truncate: true, cell: (v) => v.personsMet },
    { id: "interest", header: "Interest", sortValue: (v) => ["Hot", "Warm", "Cold"].indexOf(v.interestLevel), cell: (v) => (v.interestLevel ? <StatusDot tone={INTEREST_TONE[v.interestLevel] ?? "neutral"} label={v.interestLevel} /> : null) },
    { id: "outcome", header: "Outcome", hideBelow: "md", truncate: true, sortValue: (v) => v.interactionOutcome, cell: (v) => v.interactionOutcome },
    { id: "next", header: "Next follow-up", hideBelow: "lg", sortValue: (v) => v.nextFollowUpDate || null, cell: (v) => (v.nextFollowUpDate ? <span className="whitespace-nowrap tabular-nums text-ink-2">{formatDateIST(v.nextFollowUpDate)}</span> : null) },
    {
      id: "rep",
      header: "Rep",
      hideBelow: "md",
      sortValue: (v) => lc(v.marketingPerson),
      cell: (v) => (
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          <Avatar name={v.marketingPerson} size={24} />
          {v.marketingPerson}
        </span>
      ),
    },
  ];

  const rowActions = (v: MarketingInteraction): MenuItem[] => {
    const items: MenuItem[] = [{ label: can(viewer, "visit.edit", { record: v }) ? "Edit visit" : "Open visit", icon: <Pencil />, onSelect: () => openOverlay({ kind: "visit", visitId: v.id }) }];
    items.push({ label: "Send recap", icon: <Mail />, onSelect: () => setRecap(v) });
    if (canRecapAgent) items.push({ label: "Write recap with assistant", icon: <PenLine />, onSelect: () => openOverlay({ kind: "agent", agentKey: "visit_notes", ref: { type: "visit", id: v.id } }) });
    if (can(viewer, "visit.delete", { record: v })) items.push({ label: "Delete visit", icon: <Trash2 />, tone: "danger", separatorBefore: true, onSelect: () => void remove(v) });
    return items;
  };

  const mobileCard = (v: MarketingInteraction) => (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[14px] font-medium text-ink">{v.companyName || "No company"}</span>
        <span className="shrink-0 text-[12.5px] tabular-nums text-ink-3">{formatDateIST(v.date)}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-ink-2">
        {v.interestLevel && <StatusDot tone={INTEREST_TONE[v.interestLevel] ?? "neutral"} label={v.interestLevel} />}
        <span className="chip chip-outline">{MODE_SHORT[v.meetingMode] ?? v.meetingMode}</span>
        {privileged && <span className="text-ink-3">{v.marketingPerson}</span>}
      </div>
      {v.interactionOutcome && <p className="mt-2 truncate text-[12.5px] text-ink-2">{v.interactionOutcome}</p>}
    </div>
  );

  const empty =
    data.interactions.length === 0 ? (
      <EmptyState
        icon={<MapPin />}
        title="No visits logged yet"
        body="Log a field visit, call or video meeting and link it to its deal."
        action={
          canLog ? (
            <button type="button" className="btn btn-ink btn-sm" onClick={() => openOverlay({ kind: "visit" })}>
              <Plus aria-hidden /> Log a visit
            </button>
          ) : undefined
        }
      />
    ) : (
      <EmptyState
        icon={<Search />}
        title={query.trim() ? `No visits match "${query.trim()}"` : "No visits match these filters"}
        body={scope === "period" ? `Nothing in ${period.range.label}. Try another period or all time.` : "Try another rep or outcome, or clear the filters."}
        action={
          <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>
            Clear filters
          </button>
        }
      />
    );

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative w-full sm:w-72">
            <span className="sr-only">Search visits</span>
            <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input ref={registerSearch} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Company, lead ID, notes" className="field pl-10" />
          </label>
          <Segmented
            label="Time range"
            value={scope}
            onChange={setScope}
            options={[
              { value: "all", label: "All time" },
              { value: "period", label: "By period" },
            ]}
          />
          <button
            type="button"
            className="btn btn-ghost sm:ml-auto"
            disabled={!rows.length}
            onClick={() => {
              downloadCsv(`axoraa-visits-${todayKeyIST()}`, rows, INTERACTION_COLUMNS);
              toast({ message: `Downloaded ${rows.length} ${rows.length === 1 ? "visit" : "visits"} as CSV` });
            }}
          >
            <Download aria-hidden className="size-4" /> Export CSV
          </button>
        </div>
        {scope === "period" && (
          <PeriodPicker granularity={period.granularity} onGranularity={period.setGranularity} range={period.range} onShift={period.shift} onToday={period.reset} />
        )}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          {privileged && (
            <Select aria-label="Rep" fieldSize="sm" value={rep} onChange={(e) => setRep(e.target.value)} className="sm:w-40">
              <option value="all">All reps</option>
              {reps.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          )}
          <Select aria-label="Interest" fieldSize="sm" value={interest} onChange={(e) => setInterest(e.target.value)} className="sm:w-40">
            <option value="all">Any interest</option>
            <option value="Hot">Hot</option>
            <option value="Warm">Warm</option>
            <option value="Cold">Cold</option>
          </Select>
          <Select aria-label="Outcome" fieldSize="sm" value={outcome} onChange={(e) => setOutcome(e.target.value)} className="col-span-2 sm:col-span-1 sm:w-56">
            <option value="all">Any outcome</option>
            {OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
          {filtered && (
            <button type="button" className="btn btn-plain btn-sm col-span-2 justify-self-start sm:col-span-1" onClick={clear}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      <p className="px-1 text-[13px] text-ink-2" aria-live="polite">
        {rows.length} {rows.length === 1 ? "visit" : "visits"}, {onsite} on-site, {hot} hot, {advancing} advancing
        {scope === "period" ? <span className="text-ink-3"> in {period.range.label}</span> : null}
      </p>

      {unsyncedIds.size > 0 && (
        <div role="alert" className="flex flex-col gap-3 rounded-[22px] bg-coral-soft p-4 sm:flex-row sm:items-center">
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-coral text-white">
            <RefreshCw className="size-4" />
          </span>
          <p className="min-w-0 flex-1 text-[13.5px] text-ink">
            {unsyncedIds.size} {unsyncedIds.size === 1 ? "visit is" : "visits are"} not saved to Google Sheets yet. {unsyncedIds.size === 1 ? "It is" : "They are"} kept on this device.
          </p>
          <button type="button" className="btn btn-ink btn-sm self-start sm:self-auto" onClick={() => void data.retrySync()}>
            Retry
          </button>
        </div>
      )}

      <DataTable
        caption="Visits"
        rows={rows}
        columns={columns}
        rowKey={(v) => v.id}
        onRowClick={(v) => openOverlay({ kind: "visit", visitId: v.id })}
        flashKey={flashKey}
        rowStatus={(v) => (unsyncedIds.has(v.id) ? "unsynced" : undefined)}
        rowActions={rowActions}
        rowLabel={(v) => `${v.companyName}, ${formatDateIST(v.date)}`}
        mobileCard={mobileCard}
        empty={empty}
      />

      {recap && <RecapDialog visit={recap} deal={dealFor.get(recap.id) ?? null} onClose={() => setRecap(null)} />}
    </div>
  );
}

function RecapDialog({ visit, deal, onClose }: { visit: MarketingInteraction; deal: MarketingDeal | null; onClose: () => void }) {
  const { data, viewer } = useHub();
  const to = (visit.email || deal?.emailAddress || "").trim();
  const hello = (visit.personsMet || deal?.contactPerson || "").trim().split(/[\s,]+/)[0];
  const section = (title: string, text: string) => (text.trim() ? `${title}\n${text.trim()}\n\n` : "");
  const body =
    `${hello ? `Hi ${hello},` : "Hello,"}\n\nThank you for your time on ${formatDateIST(visit.date, { weekday: true })}. A short note of what we covered:\n\n` +
    section("Agenda", visit.agenda) +
    section("What we discussed", visit.discussionFeedback) +
    section("Action items", visit.actionItemsAgreed) +
    section("Next steps", visit.nextSteps + (visit.nextFollowUpDate ? `\nWe will follow up by ${formatDateIST(visit.nextFollowUpDate, { year: true })}.` : "")) +
    signature(data.settings.company, viewer.name === "Administrator" ? visit.marketingPerson : viewer.name);
  const email = { to: to || undefined, cc: clientFacingEmail(data.settings.company), subject: `Meeting notes: ${visit.companyName}, ${formatDateIST(visit.date)}`, body };

  return (
    <Dialog open onClose={onClose} title="Send a recap" description={`${visit.companyName}, ${formatDateIST(visit.date, { weekday: true })}`} icon={<Mail />} size="md" footer={<ComposeActions email={email} />}>
      <div className="space-y-3">
        {!to && <p className="rounded-[16px] bg-amber-soft px-4 py-2.5 text-[13px] text-warning">There is no email address on this visit or its deal. Add the recipient in your mail app.</p>}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
          <dt className="text-ink-3">To</dt>
          <dd className="truncate text-ink">{to || "Not set"}</dd>
          <dt className="text-ink-3">Cc</dt>
          <dd className="truncate text-ink">{email.cc}</dd>
          <dt className="text-ink-3">Subject</dt>
          <dd className="text-ink">{email.subject}</dd>
        </dl>
        <p className="card-inset max-h-72 overflow-y-auto whitespace-pre-line p-4 text-[13px] text-ink-2">{body}</p>
      </div>
    </Dialog>
  );
}
