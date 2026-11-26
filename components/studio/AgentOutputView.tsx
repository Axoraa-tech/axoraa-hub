"use client";

import React, { useState } from "react";
import {
  ArrowUpRight,
  CalendarPlus,
  Check,
  ClipboardCopy,
  Copy,
  FileText,
  Megaphone,
  MapPin,
  PencilLine,
  Phone,
  PenLine,
} from "lucide-react";
import { visitLinksDeal } from "@/lib/analytics";
import type { AgentOutput, AgentRef, EmailDraft } from "@/lib/agents/types";
import { clientFacingEmail } from "@/lib/company";
import { addDaysKey, dayKeyOf, formatDateIST, formatInr, formatInrFull, todayKeyIST } from "@/lib/format";
import { DEFAULT_SAC } from "@/lib/gst";
import { useHub } from "@/lib/hub/context";
import { can } from "@/lib/hub/permissions";
import { CHANNEL_LABEL, CHANNEL_LIMITS } from "@/lib/integrations/types";
import type { Campaign, CampaignPlan, ContentPost, MarketingDeal } from "@/lib/types";
import { ChannelMark, channelMarkFor } from "@/components/ui/ChannelMark";
import { ComposeActions } from "@/components/ui/ComposeActions";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/form";
import { StatusDot, type Tone } from "@/components/ui/Status";
import { Markdown } from "./Markdown";

/* ------------------------------------------------------------------ shared helpers */

/** Copies text, falling back to a hidden textarea. Resolves false when the browser refuses. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function useCopy() {
  const toast = useToast();
  return async (text: string, what = "Copied") => {
    const ok = await copyToClipboard(text);
    toast(ok ? { message: what } : { message: "Couldn't copy. Select the text and copy it yourself.", tone: "negative" });
  };
}

/** 10:00 IST on a day, as an ISO timestamp. */
export function istMorningIso(day: string): string {
  return new Date(`${day}T10:00:00+05:30`).toISOString();
}

/** The person and contact details behind a draft's record, looked up in the browser. */
export function useRecipient(ref?: AgentRef) {
  const { data } = useHub();
  let deal: MarketingDeal | undefined;
  let email: string | undefined;
  let phone: string | undefined;
  let name: string | undefined;
  let campaign: Campaign | undefined;
  if (ref?.type === "deal") {
    deal = data.deals.find((d) => d.id === ref.id);
    email = deal?.emailAddress;
    phone = deal?.phoneNumber;
    name = deal?.companyName;
  } else if (ref?.type === "visit") {
    const v = data.interactions.find((i) => i.id === ref.id);
    deal = v ? data.deals.find((d) => visitLinksDeal(v, d)) : undefined;
    email = v?.email || deal?.emailAddress;
    phone = v?.phoneNumber || deal?.phoneNumber;
    name = v?.companyName ?? deal?.companyName;
  } else if (ref?.type === "invoice") {
    const inv = data.payments.find((p) => p.id === ref.id);
    const client = inv ? data.clients.find((c) => c.clientId === inv.clientId) : undefined;
    email = client?.contactEmail;
    phone = client?.contactPhone;
    name = inv ? `${inv.invoiceId}, ${inv.companyName}` : undefined;
  } else if (ref?.type === "client") {
    const client = data.clients.find((c) => c.id === ref.id);
    email = client?.contactEmail;
    phone = client?.contactPhone;
    name = client?.companyName;
  } else if (ref?.type === "campaign") {
    campaign = data.campaigns.find((c) => c.id === ref.id);
    name = campaign?.name;
  }
  return { deal, email: email?.trim() || undefined, phone: phone?.trim() || undefined, name, campaign };
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="card-inset min-w-0 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[14px] font-medium tracking-[-0.01em] text-ink">{title}</h4>
        {action}
      </div>
      {children}
    </section>
  );
}

function Bullets({ items, empty = "None listed." }: { items: string[]; empty?: string }) {
  if (!items.length) return <p className="text-[13px] text-ink-3">{empty}</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((s, i) => (
        <li key={i} className="flex gap-2.5 text-[13.5px] text-ink-2">
          <span aria-hidden className="mt-[8px] size-1.5 shrink-0 rounded-full bg-ink-3" />
          <span className="min-w-0">{s}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ email block */

function EmailBlock({
  email,
  to,
  onChange,
  idBase,
  title = "Email",
}: {
  email: EmailDraft;
  to?: string;
  onChange?: (e: EmailDraft) => void;
  idBase: string;
  title?: string;
}) {
  const { data } = useHub();
  const cc = email.cc || clientFacingEmail(data.settings.company);
  return (
    <Section
      title={title}
      action={
        <span className="flex flex-wrap gap-1.5">
          <span className="chip chip-outline max-w-[220px] truncate" title={to ? `To ${to}` : undefined}>
            {to ? `To ${to}` : "No email on file"}
          </span>
          <span className="chip chip-outline max-w-[220px] truncate">Cc {cc}</span>
        </span>
      }
    >
      {onChange ? (
        <div className="space-y-3">
          <Field label="Subject" htmlFor={`${idBase}-subject`}>
            <Input id={`${idBase}-subject`} value={email.subject} onChange={(e) => onChange({ ...email, subject: e.target.value })} />
          </Field>
          <Field label="Body" htmlFor={`${idBase}-body`}>
            <Textarea id={`${idBase}-body`} rows={10} value={email.body} onChange={(e) => onChange({ ...email, body: e.target.value })} className="leading-relaxed" />
          </Field>
        </div>
      ) : (
        <div>
          <p className="text-[13.5px] font-medium text-ink">{email.subject || "No subject"}</p>
          <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-2">{email.body}</p>
        </div>
      )}
      {!to && <p className="mt-3 text-[12px] text-ink-3">Add the recipient in your email app; the record has no email address.</p>}
      <div className="mt-4">
        <ComposeActions size="sm" email={{ to, cc, subject: email.subject, body: email.body }} />
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ message */

function MessageView({ output, onChange, agentRef }: { output: Extract<AgentOutput, { kind: "message" }>; onChange?: (o: AgentOutput) => void; agentRef?: AgentRef }) {
  const r = useRecipient(agentRef);
  const copy = useCopy();
  const set = onChange ? (patch: Partial<typeof output>) => onChange({ ...output, ...patch }) : undefined;
  if (!output.email && !output.whatsapp && !output.callPoints?.length) {
    return <p className="text-[13px] text-ink-3">The assistant returned an empty draft. Try again with a little more detail.</p>;
  }
  return (
    <div className="space-y-3">
      {output.email && <EmailBlock email={output.email} to={r.email} idBase="out-email" onChange={set ? (email) => set({ email }) : undefined} />}
      {output.whatsapp !== undefined && output.whatsapp !== "" && (
        <Section
          title="WhatsApp"
          action={
            <span className="chip chip-outline">
              <ChannelMark channel="whatsapp" size={13} />
              {r.phone ? "Number on file" : "No number on file"}
            </span>
          }
        >
          {set ? (
            <Field label="Message" htmlFor="out-wa">
              <Textarea id="out-wa" rows={4} value={output.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} />
            </Field>
          ) : (
            <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-ink-2">{output.whatsapp}</p>
          )}
          <div className="mt-4">
            <ComposeActions size="sm" whatsapp={{ phone: r.phone, text: output.whatsapp }} />
          </div>
        </Section>
      )}
      {!!output.callPoints?.length && (
        <Section
          title="Call points"
          action={
            <span className="flex gap-1.5">
              {r.phone && (
                <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} className="btn btn-ghost btn-sm">
                  <Phone aria-hidden /> Call
                </a>
              )}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(output.callPoints!.map((p) => `- ${p}`).join("\n"))}>
                <Copy aria-hidden /> Copy
              </button>
            </span>
          }
        >
          <Bullets items={output.callPoints} />
        </Section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ visit notes */

const VISIT_LABELS: [string, string][] = [
  ["date", "Date"],
  ["interactionType", "Type"],
  ["meetingMode", "Mode"],
  ["personsMet", "Met"],
  ["designation", "Designation"],
  ["interestLevel", "Interest"],
  ["probabilityPct", "Likelihood"],
  ["interactionOutcome", "Outcome"],
  ["demoRequired", "Demo"],
  ["nextFollowUpDate", "Next follow-up"],
  ["followUpPriority", "Priority"],
  ["agenda", "Agenda"],
  ["discussionFeedback", "Discussion"],
  ["actionItemsAgreed", "Agreed"],
  ["nextSteps", "Next steps"],
];

const PATCH_LABELS: Record<string, string> = {
  leadStatus: "Stage",
  nextFollowUpDate: "Next follow-up",
  followUpAction: "Follow-up action",
  followUpPriority: "Priority",
  notesNextSteps: "Notes",
};

function fmtField(k: string, v: unknown): string {
  if (v === undefined || v === null || v === "") return "";
  if (k === "probabilityPct") return `${v}%`;
  if ((k === "date" || k === "nextFollowUpDate") && typeof v === "string") return formatDateIST(v, { year: true });
  return String(v);
}

function VisitNotesView({ output, onChange, agentRef }: { output: Extract<AgentOutput, { kind: "visit_notes" }>; onChange?: (o: AgentOutput) => void; agentRef?: AgentRef }) {
  const { data, viewer, openOverlay } = useHub();
  const toast = useToast();
  const r = useRecipient(agentRef);
  const deal = r.deal;
  const [applying, setApplying] = useState(false);
  const canEditDeal = !!deal && can(viewer, "deal.edit", { data, record: deal });
  const patchEntries = Object.entries(output.dealPatch ?? {}).filter(([, v]) => v !== undefined && v !== "");

  const apply = async () => {
    if (!deal || !output.dealPatch) return;
    setApplying(true);
    const before: Partial<MarketingDeal> = {};
    for (const k of Object.keys(output.dealPatch) as (keyof MarketingDeal)[]) (before as Record<string, unknown>)[k] = deal[k];
    const res = await data.saveDeal(output.dealPatch, deal.id);
    setApplying(false);
    toast({
      message: res.ok ? `Updated ${deal.companyName}` : "Saved on this device. Not saved to Google Sheets yet.",
      tone: res.ok ? "positive" : "negative",
      action: { label: "Undo", onClick: () => void data.saveDeal(before, deal.id) },
    });
  };

  return (
    <div className="space-y-3">
      <Section title="Visit record">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {VISIT_LABELS.map(([k, label]) => {
            const v = fmtField(k, (output.fields as Record<string, unknown>)[k]);
            if (!v) return null;
            const long = ["agenda", "discussionFeedback", "actionItemsAgreed", "nextSteps"].includes(k);
            return (
              <div key={k} className={`min-w-0 ${long ? "sm:col-span-2" : ""}`}>
                <dt className="text-[12px] text-ink-3">{label}</dt>
                <dd className="mt-0.5 whitespace-pre-line text-[13.5px] text-ink">{v}</dd>
              </div>
            );
          })}
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => openOverlay({ kind: "visit", dealId: deal?.id, prefill: { ...output.fields } })}
          >
            <MapPin aria-hidden /> Create visit from this
          </button>
        </div>
      </Section>

      {patchEntries.length > 0 && (
        <Section title={deal ? `Update for ${deal.companyName}` : "Deal update"}>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {patchEntries.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[12px] text-ink-3">{PATCH_LABELS[k] ?? k}</dt>
                <dd className="mt-0.5 text-[13.5px] text-ink">{fmtField(k, v)}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4">
            {deal ? (
              <button type="button" className="btn btn-ghost btn-sm" disabled={!canEditDeal || applying} onClick={apply} title={canEditDeal ? undefined : "You can't edit this deal"}>
                <Check aria-hidden /> {applying ? "Applying…" : "Apply to deal"}
              </button>
            ) : (
              <p className="text-[12px] text-ink-3">Run this on a deal to apply the update.</p>
            )}
          </div>
        </Section>
      )}

      {output.recapEmail && (
        <EmailBlock
          title="Recap email"
          idBase="out-recap"
          email={output.recapEmail}
          to={r.email}
          onChange={onChange ? (recapEmail) => onChange({ ...output, recapEmail }) : undefined}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ brief */

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function BriefView({ output, onChange }: { output: Extract<AgentOutput, { kind: "brief" }>; onChange?: (o: AgentOutput) => void }) {
  const [editing, setEditing] = useState(false);
  const copy = useCopy();
  return (
    <div className="space-y-3">
      <Section
        title="Brief"
        action={
          <span className="flex gap-1.5">
            {onChange && (
              <button type="button" className="btn btn-ghost btn-sm" aria-pressed={editing} onClick={() => setEditing((v) => !v)}>
                <PencilLine aria-hidden /> {editing ? "Done editing" : "Edit text"}
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(output.markdown)}>
              <Copy aria-hidden /> Copy
            </button>
          </span>
        }
      >
        {editing && onChange ? (
          <Field label="Brief (Markdown)" htmlFor="out-brief">
            <Textarea id="out-brief" rows={18} value={output.markdown} onChange={(e) => onChange({ ...output, markdown: e.target.value })} className="font-mono text-[13px]" />
          </Field>
        ) : (
          <Markdown source={output.markdown} />
        )}
      </Section>
      <Section title={`Sources (${output.sources.length})`}>
        {output.sources.length ? (
          <ol className="space-y-2">
            {output.sources.map((s, i) => {
              const safe = /^https?:\/\//i.test(s.url);
              return (
                <li key={s.url + i} className="flex min-w-0 items-start gap-2.5 text-[13px]">
                  <span className="w-5 shrink-0 text-right tabular-nums text-ink-3">{i + 1}.</span>
                  {safe ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="min-w-0 text-ink underline decoration-ink-3/40 underline-offset-2 hover:decoration-ink">
                      <span className="block truncate">{s.title}</span>
                      <span className="block truncate text-[12px] text-ink-3 no-underline">{hostOf(s.url)}</span>
                    </a>
                  ) : (
                    <span className="min-w-0 truncate">{s.title}</span>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-[13px] text-ink-3">No sources were cited. Check the facts before you rely on them.</p>
        )}
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ proposal */

function proposalText(o: Extract<AgentOutput, { kind: "proposal" }>): string {
  const lines = [o.summary, "", "Scope:", ...o.scope.map((s) => `- ${s}`), "", "Not included:", ...o.outOfScope.map((s) => `- ${s}`), "", "Milestones:"];
  o.milestones.forEach((m, i) => lines.push(`${i + 1}. ${m.name} (${m.weeks} weeks, ${m.percent}%): ${m.deliverables.join(", ")}`));
  lines.push("", "Assumptions:", ...o.assumptions.map((s) => `- ${s}`));
  if (o.priceBand) lines.push("", `Price range: ${formatInrFull(o.priceBand.lowInr)} to ${formatInrFull(o.priceBand.highInr)}${o.priceBand.note ? `. ${o.priceBand.note}` : ""}`);
  return lines.join("\n");
}

function ProposalView({ output, agentRef }: { output: Extract<AgentOutput, { kind: "proposal" }>; agentRef?: AgentRef }) {
  const { openOverlay } = useHub();
  const r = useRecipient(agentRef);
  const copy = useCopy();
  const deal = r.deal;
  const totalWeeks = output.milestones.reduce((s, m) => s + m.weeks, 0);
  const useInQuote = () => {
    if (!deal) return;
    const value = Number(deal.estimatedDealValue) || 0;
    openOverlay({
      kind: "quote_print",
      dealId: deal.id,
      lines: output.milestones.map((m) => ({
        description: `${m.name}: ${m.deliverables.join(", ")}`,
        sac: DEFAULT_SAC,
        amount: Math.round((value * m.percent) / 100),
      })),
    });
  };
  return (
    <div className="space-y-3">
      <Section title="Summary">
        <p className="text-[14px] leading-relaxed text-ink-2">{output.summary || "No summary."}</p>
      </Section>
      <div className="grid gap-3 md:grid-cols-2">
        <Section title="In scope">
          <Bullets items={output.scope} />
        </Section>
        <Section title="Not included">
          <Bullets items={output.outOfScope} />
        </Section>
      </div>
      <Section title={`Milestones${totalWeeks ? `, about ${totalWeeks} weeks` : ""}`}>
        {output.milestones.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="table">
                <caption className="sr-only">Milestones</caption>
                <thead>
                  <tr>
                    <th scope="col">Milestone</th>
                    <th scope="col">Deliverables</th>
                    <th scope="col" className="text-right">
                      Weeks
                    </th>
                    <th scope="col" className="text-right">
                      Billing
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {output.milestones.map((m, i) => (
                    <tr key={i}>
                      <td className="font-medium text-ink">{m.name}</td>
                      <td className="text-ink-2">{m.deliverables.join(", ")}</td>
                      <td className="text-right tabular-nums">{m.weeks}</td>
                      <td className="text-right tabular-nums">{m.percent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ol className="space-y-2 md:hidden">
              {output.milestones.map((m, i) => (
                <li key={i} className="rounded-[16px] bg-surface p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13.5px] font-medium text-ink">{m.name}</span>
                    <span className="shrink-0 text-[12px] tabular-nums text-ink-3">
                      {m.weeks} wk, {m.percent}%
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-ink-2">{m.deliverables.join(", ")}</p>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-surface" aria-hidden>
              {output.milestones.map((m, i) => (
                <span key={i} className={i % 2 ? "hatch" : "bg-lime"} style={{ width: `${m.percent}%` }} />
              ))}
            </div>
          </>
        ) : (
          <p className="text-[13px] text-ink-3">No milestones.</p>
        )}
      </Section>
      <div className="grid gap-3 md:grid-cols-2">
        <Section title="Assumptions">
          <Bullets items={output.assumptions} />
        </Section>
        <Section title="Price range">
          {output.priceBand ? (
            <>
              <p className="num text-[30px] text-ink">
                {formatInr(output.priceBand.lowInr)} to {formatInr(output.priceBand.highInr)}
              </p>
              <p className="mt-1 text-[12px] tabular-nums text-ink-3">
                {formatInrFull(output.priceBand.lowInr)} to {formatInrFull(output.priceBand.highInr)}, before GST
              </p>
              {output.priceBand.note && <p className="mt-3 text-[13px] text-ink-2">{output.priceBand.note}</p>}
            </>
          ) : (
            <p className="text-[13px] text-ink-3">Not enough information for a price range.</p>
          )}
        </Section>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(proposalText(output), "Outline copied")}>
          <ClipboardCopy aria-hidden /> Copy outline
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!deal || !output.milestones.length}
          title={deal ? undefined : "Run this on a deal to build a quotation"}
          onClick={useInQuote}
        >
          <FileText aria-hidden /> Use in quotation
        </button>
      </div>
      {deal && !(Number(deal.estimatedDealValue) > 0) && (
        <p className="text-[12px] text-ink-3">The deal has no estimated value yet, so the quotation lines start at ₹0.</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ social posts */

type SocialPost = Extract<AgentOutput, { kind: "social_posts" }>["posts"][number];

function postTitle(p: SocialPost): string {
  const first = p.caption.split(/\n/)[0].trim();
  return first.length > 60 ? `${first.slice(0, 57).trimEnd()}…` : first;
}

function SocialPostsView({ output, onChange, draftId }: { output: Extract<AgentOutput, { kind: "social_posts" }>; onChange?: (o: AgentOutput) => void; draftId?: string }) {
  const { data, viewer } = useHub();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [addedLocal, setAddedLocal] = useState<Set<number>>(() => new Set());
  const canAdd = can(viewer, "content.edit", { data });

  const isAdded = (p: SocialPost, i: number) =>
    addedLocal.has(i) || (!!draftId && data.posts.some((x) => x.draftId === draftId && x.channel === p.channel && dayKeyOf(x.scheduledAt) === p.date));

  const toPost = (p: SocialPost): Partial<ContentPost> => ({
    channel: p.channel,
    status: "draft",
    title: postTitle(p),
    caption: p.cta && !p.caption.includes(p.cta) ? `${p.caption}\n\n${p.cta}` : p.caption,
    hashtags: p.hashtags,
    imageBrief: p.imageBrief,
    scheduledAt: istMorningIso(p.date),
    ownerName: viewer.name,
    draftId,
  });

  const add = async (indices: number[]) => {
    setBusy(true);
    let failed = 0;
    const ids: string[] = [];
    for (const i of indices) {
      const res = await data.savePost(toPost(output.posts[i]));
      if (!res.ok) failed++;
      ids.push(res.record.id);
    }
    setAddedLocal((s) => new Set([...s, ...indices]));
    setBusy(false);
    toast({
      message: failed ? `Added ${indices.length} to the calendar. ${failed} not saved to Google Sheets yet.` : indices.length === 1 ? "Added to the content calendar" : `Added ${indices.length} posts to the content calendar`,
      tone: failed ? "negative" : "positive",
      action: {
        label: "Undo",
        onClick: () => {
          ids.forEach((id) => void data.deletePost(id));
          setAddedLocal((s) => new Set([...s].filter((x) => !indices.includes(x))));
        },
      },
    });
  };

  const remaining = output.posts.map((p, i) => (isAdded(p, i) ? -1 : i)).filter((i) => i >= 0);
  const setCaption = (i: number, caption: string) => onChange?.({ ...output, posts: output.posts.map((p, j) => (j === i ? { ...p, caption } : p)) });

  if (!output.posts.length) return <p className="text-[13px] text-ink-3">No posts came back. Try a clearer goal or fewer channels.</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-ink-3">
          {output.posts.length} posts from {formatDateIST(output.posts[0].date, { weekday: true })} to {formatDateIST(output.posts[output.posts.length - 1].date, { weekday: true })}
        </p>
        <button type="button" className="btn btn-primary btn-sm" disabled={!canAdd || busy || !remaining.length} onClick={() => add(remaining)}>
          <CalendarPlus aria-hidden /> {remaining.length ? `Add all ${remaining.length}` : "All added"}
        </button>
      </div>
      <ul className="space-y-2.5">
        {output.posts.map((p, i) => {
          const max = CHANNEL_LIMITS[p.channel].captionMax;
          const over = p.caption.length > max;
          const added = isAdded(p, i);
          return (
            <li key={i} className="card-inset p-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="chip chip-ink tabular-nums">{formatDateIST(p.date, { weekday: true })}</span>
                <span className="chip chip-outline">
                  <ChannelMark channel={channelMarkFor(p.channel)} size={13} />
                  {CHANNEL_LABEL[p.channel]}
                </span>
                <span className={`ml-auto text-[12px] tabular-nums ${over ? "font-medium text-negative" : "text-ink-3"}`}>
                  {p.caption.length.toLocaleString("en-IN")} / {max.toLocaleString("en-IN")}
                  {over && " (too long)"}
                </span>
              </div>
              {onChange ? (
                <Textarea
                  aria-label={`Caption for ${CHANNEL_LABEL[p.channel]} on ${formatDateIST(p.date)}`}
                  rows={5}
                  value={p.caption}
                  invalid={over}
                  onChange={(e) => setCaption(i, e.target.value)}
                  className="mt-3 bg-surface"
                />
              ) : (
                <p className="mt-3 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-2">{p.caption}</p>
              )}
              {p.hashtags.length > 0 && (
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {p.hashtags.map((h) => (
                    <span key={h} className="chip">
                      #{h}
                    </span>
                  ))}
                </p>
              )}
              {p.imageBrief && (
                <p className="mt-3 text-[12.5px] text-ink-3">
                  <span className="font-medium text-ink-2">Image: </span>
                  {p.imageBrief}
                </p>
              )}
              <div className="mt-3 flex justify-end">
                {added ? (
                  <span className="chip chip-good">
                    <Check aria-hidden className="size-3.5" /> In the calendar
                  </span>
                ) : (
                  <button type="button" className="btn btn-ghost btn-sm" disabled={!canAdd || busy} onClick={() => add([i])}>
                    <CalendarPlus aria-hidden /> Add to calendar
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ campaign plan */

function adText(c: CampaignPlan["creatives"][number]): string {
  return [`Headline: ${c.headline}`, `Primary text: ${c.primaryText}`, c.description && `Description: ${c.description}`, c.cta && `Button: ${c.cta}`].filter(Boolean).join("\n");
}

/** Read-only view of a campaign plan; also used by the campaign editor. */
export function CampaignPlanView({ plan }: { plan: CampaignPlan }) {
  const copy = useCopy();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Daily budget", formatInr(plan.budget.dailyInr)],
          ["Total budget", formatInr(plan.budget.totalInr)],
          ["Target cost per lead", plan.kpis.targetCplInr ? formatInr(plan.kpis.targetCplInr) : "–"],
          ["Expected leads", plan.kpis.expectedLeads ? String(plan.kpis.expectedLeads) : "–"],
        ].map(([label, value]) => (
          <div key={label} className="card-inset p-4">
            <div className="text-[12px] text-ink-3">{label}</div>
            <div className="num mt-3 text-[26px] text-ink">{value}</div>
          </div>
        ))}
      </div>

      {plan.budget.split.length > 0 && (
        <Section title="Budget split">
          <ul className="space-y-3">
            {plan.budget.split.map((s, i) => (
              <li key={i}>
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate text-ink">{s.label}</span>
                  <span className="shrink-0 tabular-nums text-ink-3">
                    {s.percent}%{plan.budget.totalInr ? `, ${formatInr((plan.budget.totalInr * s.percent) / 100)}` : ""}
                  </span>
                </div>
                <div className="hatch mt-1.5 h-2.5 overflow-hidden rounded-full">
                  <div className="h-full rounded-full bg-lime animate-grow-x" style={{ width: `${Math.min(100, s.percent)}%`, transformOrigin: "left" }} />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {plan.audiences.length > 0 && (
        <Section title="Audiences">
          <ul className="grid gap-3 md:grid-cols-2">
            {plan.audiences.map((a, i) => (
              <li key={i} className="rounded-[16px] bg-surface p-3.5">
                <p className="text-[13.5px] font-medium text-ink">{a.name}</p>
                <p className="mt-1 text-[12.5px] text-ink-3">
                  Ages {a.ageMin} to {a.ageMax}
                  {a.locations.length ? `, ${a.locations.join(", ")}` : ""}
                </p>
                {a.interests.length > 0 && (
                  <p className="mt-2 flex flex-wrap gap-1.5">
                    {a.interests.map((t) => (
                      <span key={t} className="chip">
                        {t}
                      </span>
                    ))}
                  </p>
                )}
                {a.notes && <p className="mt-2 text-[12.5px] text-ink-2">{a.notes}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {plan.creatives.length > 0 && (
        <Section title="Ad text">
          <ul className="space-y-2.5">
            {plan.creatives.map((c, i) => {
              const hOver = c.headline.length > 40;
              const pOver = c.primaryText.length > 125;
              return (
                <li key={i} className="rounded-[16px] bg-surface p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-[14px] font-medium text-ink">{c.headline || "No headline"}</p>
                    <button type="button" className="btn btn-ghost btn-sm shrink-0" onClick={() => copy(adText(c), "Ad text copied")}>
                      <Copy aria-hidden /> Copy ad text
                    </button>
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-[13.5px] text-ink-2">{c.primaryText}</p>
                  {c.description && <p className="mt-1.5 text-[12.5px] text-ink-3">{c.description}</p>}
                  <p className="mt-2.5 flex flex-wrap gap-1.5 text-[12px]">
                    <span className={`chip ${hOver ? "chip-coral" : ""}`}>Headline {c.headline.length}/40</span>
                    <span className={`chip ${pOver ? "chip-amber" : ""}`}>Primary text {c.primaryText.length}/125</span>
                    {c.cta && <span className="chip chip-outline">{c.cta}</span>}
                  </p>
                  {c.imageBrief && (
                    <p className="mt-2 text-[12.5px] text-ink-3">
                      <span className="font-medium text-ink-2">Image: </span>
                      {c.imageBrief}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {plan.leadFormQuestions.length > 0 && (
        <Section title="Lead form questions">
          <ol className="space-y-1.5">
            {plan.leadFormQuestions.map((q, i) => (
              <li key={i} className="flex gap-2.5 text-[13.5px] text-ink-2">
                <span className="w-5 shrink-0 text-right tabular-nums text-ink-3">{i + 1}.</span>
                <span>{q}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {plan.notes && (
        <Section title="Notes">
          <p className="whitespace-pre-line text-[13.5px] text-ink-2">{plan.notes}</p>
        </Section>
      )}
    </div>
  );
}

function CampaignOutputView({ output, agentRef, draftId }: { output: Extract<AgentOutput, { kind: "campaign_plan" }>; agentRef?: AgentRef; draftId?: string }) {
  const { data, viewer, navigate } = useHub();
  const toast = useToast();
  const r = useRecipient(agentRef);
  const [saving, setSaving] = useState(false);
  const canSave = can(viewer, "campaign.edit", { data });
  const linked = r.campaign;

  const save = async () => {
    setSaving(true);
    const p = output.plan;
    const objective: Campaign["objective"] = /traffic/i.test(p.objective) ? "traffic" : /aware/i.test(p.objective) ? "awareness" : /engage/i.test(p.objective) ? "engagement" : "leads";
    const today = todayKeyIST();
    const days = p.budget.dailyInr > 0 ? Math.round(p.budget.totalInr / p.budget.dailyInr) : 0;
    const patch: Partial<Campaign> = linked
      ? { plan: p, draftId, dailyBudget: p.budget.dailyInr || linked.dailyBudget, totalBudget: p.budget.totalInr || linked.totalBudget }
      : {
          name: p.name,
          platform: "Meta",
          objective,
          status: "Planning",
          source: "manual",
          startDate: today,
          endDate: days > 0 ? addDaysKey(today, days - 1) : undefined,
          dailyBudget: p.budget.dailyInr,
          totalBudget: p.budget.totalInr,
          spend: 0,
          leads: 0,
          ownerName: viewer.name,
          audience: p.audiences.map((a) => a.name).join(", "),
          notes: p.notes,
          plan: p,
          draftId,
        };
    const res = await data.saveCampaign(patch, linked?.id);
    setSaving(false);
    toast({
      message: res.ok ? (linked ? `Plan saved to ${linked.name}` : `Saved ${p.name} as a campaign`) : "Saved on this device. Not saved to Google Sheets yet.",
      tone: res.ok ? "positive" : "negative",
    });
    navigate("campaigns");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[16px] font-medium tracking-[-0.02em] text-ink">{output.plan.name}</p>
          {output.plan.objective && <p className="text-[12.5px] text-ink-3">{output.plan.objective}</p>}
        </div>
        <button type="button" className="btn btn-primary btn-sm" disabled={!canSave || saving} onClick={save}>
          <Megaphone aria-hidden /> {linked ? `Save plan to ${linked.name}` : "Save as campaign"}
        </button>
      </div>
      <CampaignPlanView plan={output.plan} />
    </div>
  );
}

/* ------------------------------------------------------------------ pipeline review */

const RISK_TONE: Record<"high" | "medium" | "low", Tone> = { high: "negative", medium: "warning", low: "neutral" };
const RISK_LABEL = { high: "High", medium: "Medium", low: "Low" } as const;
type ReviewRow = Extract<AgentOutput, { kind: "pipeline_review" }>["deals"][number];

function PipelineReviewView({ output }: { output: Extract<AgentOutput, { kind: "pipeline_review" }> }) {
  const { data, viewer, openOverlay } = useHub();
  const toast = useToast();

  const setFollowUp = async (row: ReviewRow) => {
    const deal = data.deals.find((d) => d.id === row.dealId);
    if (!deal) return;
    const date = row.followUpDate ?? addDaysKey(todayKeyIST(), 2);
    const before = { nextFollowUpDate: deal.nextFollowUpDate, followUpAction: deal.followUpAction };
    const res = await data.saveDeal({ nextFollowUpDate: date, followUpAction: row.nextAction }, deal.id);
    toast({
      message: res.ok ? `Follow-up for ${deal.companyName} set to ${formatDateIST(date)}` : "Saved on this device. Not saved to Google Sheets yet.",
      tone: res.ok ? "positive" : "negative",
      action: { label: "Undo", onClick: () => void data.saveDeal(before, deal.id) },
    });
  };

  const columns: TableColumn<ReviewRow>[] = [
    { id: "company", header: "Company", cell: (r) => <span className="font-medium text-ink">{r.company}</span>, sortValue: (r) => r.company },
    {
      id: "risk",
      header: "Risk",
      cell: (r) => <StatusDot tone={RISK_TONE[r.risk]} label={RISK_LABEL[r.risk]} />,
      sortValue: (r) => ({ high: 0, medium: 1, low: 2 })[r.risk],
      width: 110,
    },
    { id: "reason", header: "Why", cell: (r) => <span className="text-ink-2">{r.reason}</span>, hideBelow: "lg" },
    { id: "next", header: "Next action", cell: (r) => r.nextAction },
    { id: "date", header: "Suggested", cell: (r) => (r.followUpDate ? formatDateIST(r.followUpDate, { weekday: true }) : ""), sortValue: (r) => r.followUpDate, width: 120 },
  ];

  return (
    <div className="space-y-3">
      {output.summary && (
        <Section title="Summary">
          <p className="text-[14px] leading-relaxed text-ink-2">{output.summary}</p>
        </Section>
      )}
      <DataTable
        caption="Deals that have gone quiet"
        rows={output.deals}
        columns={columns}
        rowKey={(r) => r.dealId}
        initialSort={{ id: "risk", dir: "asc" }}
        onRowClick={(r) => openOverlay({ kind: "deal", dealId: r.dealId })}
        rowLabel={(r) => r.company}
        rowActions={(r) => {
          const deal = data.deals.find((d) => d.id === r.dealId);
          return [
            { label: "Open deal", icon: <ArrowUpRight />, onSelect: () => openOverlay({ kind: "deal", dealId: r.dealId }), disabled: !deal },
            {
              label: r.followUpDate ? `Set follow-up for ${formatDateIST(r.followUpDate)}` : "Set follow-up",
              icon: <CalendarPlus />,
              onSelect: () => void setFollowUp(r),
              disabled: !deal || !can(viewer, "deal.edit", { data, record: deal }),
            },
          ];
        }}
        empty={<p className="px-6 py-10 text-center text-[13px] text-ink-3">Nothing has gone quiet. Every open deal has a follow-up ahead and a recent visit.</p>}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ entry */

export function AgentOutputView({
  output,
  onChange,
  agentRef,
  draftId,
}: {
  output: AgentOutput;
  /** When given, the text fields are editable. */
  onChange?: (o: AgentOutput) => void;
  agentRef?: AgentRef;
  draftId?: string;
}) {
  let body: React.ReactNode;
  switch (output.kind) {
    case "message":
      body = <MessageView output={output} onChange={onChange} agentRef={agentRef} />;
      break;
    case "visit_notes":
      body = <VisitNotesView output={output} onChange={onChange} agentRef={agentRef} />;
      break;
    case "brief":
      body = <BriefView output={output} onChange={onChange} />;
      break;
    case "proposal":
      body = <ProposalView output={output} agentRef={agentRef} />;
      break;
    case "social_posts":
      body = <SocialPostsView output={output} onChange={onChange} draftId={draftId} />;
      break;
    case "campaign_plan":
      body = <CampaignOutputView output={output} agentRef={agentRef} draftId={draftId} />;
      break;
    case "pipeline_review":
      body = <PipelineReviewView output={output} />;
      break;
  }
  return (
    <div className="min-w-0 space-y-3">
      <p className="flex items-center gap-2 text-[12.5px] text-ink-3">
        <PenLine aria-hidden className="size-3.5" />
        Drafted by the assistant. Review it before sending.
      </p>
      {body}
    </div>
  );
}
