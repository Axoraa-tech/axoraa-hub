"use client";

import React, { useState } from "react";
import { Briefcase, FileText, Mail, MapPin, MapPinned, MessageCircle, PenLine, Phone, RefreshCw, Trash2, UserRound } from "lucide-react";
import { STAGE_ORDER } from "@/lib/analytics";
import { addDaysKey, formatInr, formatInrFull, nowISO, todayKeyIST } from "@/lib/format";
import { useHub } from "@/lib/hub/context";
import { can } from "@/lib/hub/permissions";
import { FOUNDER_NAMES, MARKETING_NAMES } from "@/lib/people";
import { useNow } from "@/lib/prefs";
import type { LeadStageStatus, MarketingDeal } from "@/lib/types";
import type { Overlay } from "@/lib/views";
import { ComposeActions } from "@/components/ui/ComposeActions";
import { Sheet } from "@/components/ui/Dialog";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Field, Select } from "@/components/ui/form";
import { Menu, Popover, type MenuItem } from "@/components/ui/Menu";
import { EmptyState, Segmented } from "@/components/ui/primitives";
import { dueText, toneForDue } from "@/components/ui/Status";
import { DealForm } from "./DealForm";
import { DealTimeline } from "./DealTimeline";
import {
  clientPrefillFromDeal,
  dealEmailDraft,
  dealWhatsappText,
  draftFromDeal,
  mapsHref,
  telHref,
  useBelowMd,
  useDealMover,
  validateDealDraft,
  whatsappHref,
  type DealDraft,
  type FieldError,
} from "./dealActions";

const NOT_SAVED = "Not saved to Google Sheets. Your change is kept on this device.";
const CHIP = { negative: "chip-coral", warning: "chip-amber", positive: "chip-good", accent: "chip-lime", neutral: "" } as const;

type DealOverlay = Extract<Overlay, { kind: "deal" }>;

/** The deal drawer: header with stage and owner, contact actions, then Details and Timeline. A null dealId adds a deal. */
export function DealSheet({ overlay, onClose }: { overlay: DealOverlay; onClose: () => void }) {
  const { data, all, viewer, openOverlay } = useHub();
  const toast = useToast();
  const confirm = useConfirm();
  const move = useDealMover();
  const belowMd = useBelowMd();
  const now = useNow();
  const todayKey = now ? todayKeyIST(now) : "";

  const [savedId, setSavedId] = useState<string | null>(overlay.dealId ?? null);
  const deal: MarketingDeal | null = savedId ? data.deals.find((d) => d.id === savedId) ?? all.deals.find((d) => d.id === savedId) ?? null : null;
  const isNew = !savedId;

  const prefill = overlay.prefill ?? {};
  const [newStage, setNewStage] = useState<LeadStageStatus>(prefill.leadStatus ?? "New Lead");
  const [newOwner, setNewOwner] = useState<string>(() =>
    viewer.category === "marketing" ? viewer.name : prefill.marketingPerson ?? MARKETING_NAMES[0] ?? ""
  );
  const [draft, setDraft] = useState<DealDraft>(() => {
    if (deal) return draftFromDeal(deal);
    const today = todayKeyIST();
    return draftFromDeal({
      leadSource: "Field Visit / Direct Walk-in",
      stateRegion: data.settings.company.state || "Karnataka",
      followUpPriority: "Medium",
      demoRequired: "Not Needed",
      nextFollowUpDate: addDaysKey(today, data.settings.followUpDefaultDays || 3),
      ...prefill,
    });
  });
  const [baseline, setBaseline] = useState(() => JSON.stringify(draft));
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [saving, setSaving] = useState(false);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"details" | "timeline">("details");

  const dirty = JSON.stringify(draft) !== baseline;
  const stage: LeadStageStatus = deal?.leadStatus ?? newStage;
  const owner = deal ? deal.marketingPerson : newOwner;
  const canEdit = deal ? can(viewer, "deal.edit", { record: deal }) : can(viewer, "deal.edit");
  const canDelete = !!deal && can(viewer, "deal.delete", { record: deal });
  const canAssign = can(viewer, "deal.assign");
  const unsynced = !!failedId && data.unsynced.some((u) => u.entity === "deals" && u.id === failedId);

  const requestClose = async () => {
    if (dirty && canEdit) {
      const ok = await confirm({ title: "Discard your changes?", body: "The edits you made to this deal will be lost.", confirmLabel: "Discard changes", cancelLabel: "Keep editing", tone: "danger" });
      if (!ok) return;
    }
    onClose();
  };

  // A deal id that is not (or no longer) in the data.
  if (overlay.dealId && !deal) {
    return (
      <Sheet open onClose={onClose} title="Deal not found" width="lg">
        <EmptyState
          icon={<Briefcase />}
          title="This deal isn't available"
          body="It may have been deleted, or it belongs to someone else's pipeline."
          action={
            <button type="button" className="btn btn-ink btn-sm" onClick={onClose}>
              Close
            </button>
          }
        />
      </Sheet>
    );
  }

  const save = async () => {
    const errs = validateDealDraft(draft);
    setErrors(errs);
    if (errs.length) {
      setTab("details");
      return;
    }
    setSaving(true);
    const clean: DealDraft = { ...draft, companyName: draft.companyName.trim(), emailAddress: draft.emailAddress.trim() };
    let payload: Partial<MarketingDeal> = clean;
    if (isNew) {
      const today = todayKeyIST();
      payload = {
        ...prefill,
        ...clean,
        leadId: "",
        dateAdded: prefill.dateAdded || today,
        leadStatus: newStage,
        marketingPerson: newOwner,
        assignedAt: newOwner ? nowISO() : undefined,
        lastInteractionDate: prefill.lastInteractionDate ?? "",
        weightedValue: 0,
        daysSinceLastVisit: 0,
        dueStatus: "Upcoming",
        followUpStatus: "Pending",
        conversionDate: newStage === "Closed Won" ? today : undefined,
      };
    }
    const res = await data.saveDeal(payload, savedId ?? undefined);
    setSaving(false);
    setBaseline(JSON.stringify(clean));
    setDraft(clean);
    if (!res.ok) {
      setSavedId(res.record.id);
      setFailedId(res.record.id);
      return;
    }
    setFailedId(null);
    onClose();
    if (isNew) {
      const id = res.record.id;
      toast({ message: `Added ${res.record.companyName}${res.record.leadId ? ` as ${res.record.leadId}` : ""}`, tone: "positive", action: { label: "Open", onClick: () => openOverlay({ kind: "deal", dealId: id }) } });
    } else toast({ message: `Saved ${res.record.companyName}`, tone: "positive" });
  };

  const changeStage = async (next: LeadStageStatus) => {
    if (!deal) {
      setNewStage(next);
      return;
    }
    await move(deal, next);
  };

  const changeOwner = async (next: string) => {
    if (!deal) {
      setNewOwner(next);
      return;
    }
    const before = { marketingPerson: deal.marketingPerson, assignedAt: deal.assignedAt ?? "" };
    const res = await data.saveDeal({ marketingPerson: next, assignedAt: next ? nowISO() : "" }, deal.id);
    toast(
      res.ok
        ? {
            message: next ? `Assigned ${deal.companyName} to ${next}` : `${deal.companyName} is now unassigned`,
            action: { label: "Undo", onClick: () => void data.saveDeal(before, deal.id) },
          }
        : { message: NOT_SAVED, tone: "negative" }
    );
    if (!res.ok) setFailedId(deal.id);
  };

  const remove = async () => {
    if (!deal) return;
    const ok = await confirm({
      title: `Delete ${deal.companyName}?`,
      body: "The deal and its quotation are removed for everyone. Visits stay in the visit log.",
      confirmLabel: "Delete deal",
      tone: "danger",
    });
    if (!ok) return;
    const res = await data.deleteDeal(deal.id);
    if (res.ok) {
      onClose();
      toast({ message: `Deleted ${deal.companyName}` });
    } else toast({ message: `Couldn't delete ${deal.companyName}: ${res.error}`, tone: "negative" });
  };

  /* ---------------------------------------------------------------- header menu */

  const hasClient = !!deal && all.clients.some((c) => c.sourceDealId === deal.id);
  const menuItems: MenuItem[] = [];
  if (deal && deal.leadStatus === "Closed Won" && can(viewer, "client.edit")) {
    const existing = all.clients.find((c) => c.sourceDealId === deal.id);
    menuItems.push(
      existing
        ? { label: "Open client record", icon: <UserRound />, onSelect: () => openOverlay({ kind: "client", clientId: existing.id }) }
        : { label: "Create client", icon: <UserRound />, onSelect: () => openOverlay({ kind: "client", prefill: clientPrefillFromDeal(deal, todayKeyIST()) }) }
    );
  }
  if (deal) menuItems.push({ label: "Print quotation", icon: <FileText />, onSelect: () => openOverlay({ kind: "quote_print", dealId: deal.id }) });
  if (canDelete) menuItems.push({ label: "Delete deal", icon: <Trash2 />, tone: "danger", separatorBefore: true, onSelect: () => void remove() });

  /* ---------------------------------------------------------------- render */

  const value = deal ? deal.estimatedDealValue : draft.estimatedDealValue;
  const weighted = deal && !dirty ? deal.weightedValue : Math.round((Number(draft.estimatedDealValue) || 0) * (Number(data.settings.stageProbabilities[stage]) || 0));
  const due = todayKey ? dueText({ nextFollowUpDate: draft.nextFollowUpDate, leadStatus: stage }, todayKey) : "";
  const dueTone = deal ? toneForDue(deal.dueStatus) : "neutral";
  const ownerOptions = [...new Set([...MARKETING_NAMES, ...FOUNDER_NAMES, ...(owner ? [owner] : [])])];

  return (
    <Sheet
      open
      onClose={() => void requestClose()}
      width="lg"
      title={deal?.companyName || draft.companyName.trim() || "Add deal"}
      description={
        deal
          ? `${deal.leadId || "No lead ID yet"}, ${deal.marketingPerson ? `owned by ${deal.marketingPerson}` : "not assigned yet"}`
          : newOwner
          ? `Goes into ${newOwner}'s pipeline`
          : "Not assigned to anyone yet"
      }
      headerActions={menuItems.length ? <Menu label="Deal actions" items={menuItems} /> : undefined}
      footer={
        tab === "details" && canEdit ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => void requestClose()}>
              Cancel
            </button>
            <button type="button" className="btn btn-ink" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving" : isNew ? "Add deal" : "Save deal"}
            </button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-5">
        {unsynced && failedId && (
          <div role="alert" className="rounded-[20px] bg-coral-soft p-4">
            <div className="flex items-start gap-3">
              <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-coral text-white">
                <RefreshCw className="size-4" />
              </span>
              <p className="min-w-0 pt-1.5 text-[13.5px] text-ink">{NOT_SAVED}</p>
            </div>
            <button type="button" className="btn btn-ink btn-sm mt-3" onClick={() => void data.retrySync(failedId)}>
              Retry
            </button>
          </div>
        )}

        {/* Value and follow-up */}
        <div className="grid grid-cols-2 gap-2">
          <div className="card-ink min-w-0 p-4">
            <div className="text-[12px] text-white/55">Value</div>
            <div className="num mt-3 truncate text-[28px]" title={formatInrFull(value)}>
              {formatInr(value)}
            </div>
            <div className="mt-1 truncate text-[12px] text-white/55">
              Weighted <span className="text-lime">{formatInr(weighted)}</span>
            </div>
          </div>
          <div className="card-inset min-w-0 p-4">
            <div className="text-[12px] text-ink-3">Next follow-up</div>
            <div className="mt-3">{due ? <span className={`chip ${CHIP[dueTone]}`}>{due}</span> : <span className="text-[13px] text-ink-3">Not set</span>}</div>
            {draft.followUpAction && <div className="mt-2 line-clamp-2 text-[12px] text-ink-2">{draft.followUpAction}</div>}
          </div>
        </div>

        {/* Stage and owner */}
        <div className={`grid gap-3 ${canAssign ? "sm:grid-cols-2" : ""}`}>
          <Field label="Stage" htmlFor="deal-stage">
            <Select id="deal-stage" value={stage} disabled={!canEdit} onChange={(e) => void changeStage(e.target.value as LeadStageStatus)}>
              {STAGE_ORDER.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          {canAssign ? (
            <Field label="Owner" htmlFor="deal-owner" hint={deal?.externalSource === "meta_lead_ads" && !deal.marketingPerson ? "A new Meta lead. Assign it to a rep." : undefined}>
              <Select id="deal-owner" value={owner} onChange={(e) => void changeOwner(e.target.value)}>
                <option value="">Unassigned</option>
                <optgroup label="Marketing">
                  {ownerOptions.filter((n) => !FOUNDER_NAMES.includes(n)).map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </optgroup>
                <optgroup label="Founders">
                  {FOUNDER_NAMES.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </optgroup>
              </Select>
            </Field>
          ) : null}
        </div>

        {deal && <DealActionRow deal={deal} />}
        {deal && hasClient && deal.leadStatus === "Closed Won" && <p className="text-[12.5px] text-ink-3">A client record already exists for this deal.</p>}

        {deal && (
          <Segmented
            label="Deal section"
            value={tab}
            onChange={setTab}
            options={[
              { value: "details", label: "Details" },
              { value: "timeline", label: "Timeline" },
            ]}
          />
        )}

        {tab === "details" || !deal ? (
          <DealForm
            draft={draft}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            errors={errors}
            isNew={isNew}
            quick={isNew && belowMd}
            readOnly={!canEdit}
            deal={deal}
            stage={stage}
          />
        ) : (
          <DealTimeline deal={deal} />
        )}
      </div>
    </Sheet>
  );
}

/** Email, call, WhatsApp, maps, log a visit and the assistant shortcuts for one deal. */
function DealActionRow({ deal }: { deal: MarketingDeal }) {
  const { data, viewer, features, openOverlay } = useHub();
  const sender = viewer.name;
  const email = dealEmailDraft(deal, data.settings, sender);
  const tel = telHref(deal.phoneNumber);
  const wa = whatsappHref(deal.phoneNumber, dealWhatsappText(deal, sender));
  const maps = mapsHref(deal);
  const agents = features.assistant.configured
    ? (
        [
          { key: "follow_up", label: "Draft follow-up" },
          { key: "proposal_outline", label: "Outline a proposal" },
        ] as const
      ).filter((a) => can(viewer, "agent.run", { agentKey: a.key, data }))
    : [];
  const hintId = `deal-email-hint-${deal.id}`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Contact and next steps">
        {email.to ? (
          <Popover
            label={`Email ${deal.contactPerson || deal.companyName}`}
            triggerClassName="btn btn-ghost btn-sm"
            panelClassName="w-[340px]"
            trigger={
              <>
                <Mail aria-hidden /> Email
              </>
            }
          >
            <div className="space-y-3">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]">
                <dt className="text-ink-3">To</dt>
                <dd className="truncate text-ink">{email.to}</dd>
                <dt className="text-ink-3">Cc</dt>
                <dd className="truncate text-ink">{email.cc}</dd>
                <dt className="text-ink-3">Subject</dt>
                <dd className="truncate text-ink">{email.subject}</dd>
              </dl>
              <p className="card-inset max-h-40 overflow-y-auto whitespace-pre-line p-3 text-[12.5px] text-ink-2">{email.body}</p>
              <ComposeActions size="sm" email={email} />
            </div>
          </Popover>
        ) : (
          <>
            <button type="button" className="btn btn-ghost btn-sm" disabled aria-describedby={hintId} title="Add an email address first">
              <Mail aria-hidden /> Email
            </button>
            <span id={hintId} className="sr-only">
              Add an email address first
            </span>
          </>
        )}
        {tel ? (
          <a href={tel} className="btn btn-ghost btn-sm">
            <Phone aria-hidden /> Call
          </a>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" disabled title="Add a phone number first">
            <Phone aria-hidden /> Call
          </button>
        )}
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
            <MessageCircle aria-hidden /> WhatsApp
          </a>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" disabled title="Add a 10-digit Indian mobile number first">
            <MessageCircle aria-hidden /> WhatsApp
          </button>
        )}
        {maps && (
          <a href={maps} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
            <MapPinned aria-hidden /> Open in Maps
          </a>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openOverlay({ kind: "visit", dealId: deal.id })}>
          <MapPin aria-hidden /> Log visit
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openOverlay({ kind: "quote_print", dealId: deal.id })}>
          <FileText aria-hidden /> Quotation
        </button>
      </div>
      {!email.to && <p className="text-[12px] text-ink-3">Add an email address in Contact to email {deal.contactPerson || "the client"} from here.</p>}
      {agents.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[12px] text-ink-3">Assistant</span>
          {agents.map((a) => (
            <button
              key={a.key}
              type="button"
              className="btn btn-lime btn-sm"
              onClick={() => openOverlay({ kind: "agent", agentKey: a.key, ref: { type: "deal", id: deal.id } })}
            >
              <PenLine aria-hidden /> {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
