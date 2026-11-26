"use client";

import React, { useState } from "react";
import { Archive, Check, ChevronDown, PenLine, Save, Trash2 } from "lucide-react";
import { AGENT_BY_KEY } from "@/lib/agents/catalog";
import type { AgentOutput } from "@/lib/agents/types";
import { formatDateTimeIST, relativeTime } from "@/lib/format";
import { useHub } from "@/lib/hub/context";
import { useNow } from "@/lib/prefs";
import type { AgentDraft } from "@/lib/types";
import type { Overlay } from "@/lib/views";
import { Sheet } from "@/components/ui/Dialog";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { EmptyState } from "@/components/ui/primitives";
import { StatusDot } from "@/components/ui/Status";
import { AgentOutputView } from "./AgentOutputView";
import { LANGUAGE_LABEL } from "./AgentRunner";
import { DRAFT_STATUS, refLabel } from "./DraftHistory";

type DraftOverlay = Extract<Overlay, { kind: "draft" }>;

function inputSummary(input: Record<string, unknown>): [string, string][] {
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(input ?? {})) {
    if (v === undefined || v === null || v === "") continue;
    const label = k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
    out.push([label, Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v)]);
  }
  return out;
}

function DraftEditor({ draft, onClose }: { draft: AgentDraft; onClose: () => void }) {
  const { data, navigate } = useHub();
  const toast = useToast();
  const confirm = useConfirm();
  const now = useNow();
  const [output, setOutput] = useState<AgentOutput>(draft.output);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const entry = AGENT_BY_KEY[draft.agentKey];
  const versions = draft.versions ?? [];
  const record = refLabel(data, draft.ref);

  const save = async (patch: Partial<AgentDraft>, message: string) => {
    setBusy(true);
    const before: Partial<AgentDraft> = { status: draft.status, output: draft.output };
    const res = await data.saveDraft(patch, draft.id);
    setBusy(false);
    setDirty(false);
    toast({
      message: res.ok ? message : "Saved on this device. Not saved to Google Sheets yet.",
      tone: res.ok ? "neutral" : "negative",
      action: patch.status ? { label: "Undo", onClick: () => void data.saveDraft(before, draft.id) } : undefined,
    });
  };

  const remove = async () => {
    const ok = await confirm({ title: "Delete this draft?", body: `“${draft.title}” and its earlier versions will be removed. This can't be undone.`, confirmLabel: "Delete draft", tone: "danger" });
    if (!ok) return;
    const res = await data.deleteDraft(draft.id);
    if (res.ok) {
      toast({ message: "Draft deleted" });
      onClose();
    } else toast({ message: res.error || "Couldn't delete the draft.", tone: "negative" });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      width="lg"
      title={draft.title}
      description={`${entry?.name ?? "Assistant"}${record ? `, ${record}` : ""}`}
      footer={
        <>
          <button type="button" className="btn btn-plain mr-auto text-negative" onClick={remove} disabled={busy}>
            <Trash2 aria-hidden /> Delete
          </button>
          {draft.status !== "archived" ? (
            <button type="button" className="btn btn-ghost" onClick={() => save({ status: "archived" }, "Archived")} disabled={busy}>
              <Archive aria-hidden /> Archive
            </button>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => save({ status: "draft" }, "Moved back to drafts")} disabled={busy}>
              <Archive aria-hidden /> Unarchive
            </button>
          )}
          {draft.status !== "used" && (
            <button type="button" className="btn btn-ghost" onClick={() => save({ status: "used" }, "Marked as used")} disabled={busy}>
              <Check aria-hidden /> Mark as used
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => save({ output }, "Changes saved")} disabled={busy || !dirty}>
            <Save aria-hidden /> Save changes
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusDot tone={DRAFT_STATUS[draft.status]?.tone ?? "neutral"} label={DRAFT_STATUS[draft.status]?.label ?? draft.status} />
          {draft.language && draft.language !== "en" && <span className="chip chip-outline">{LANGUAGE_LABEL[draft.language]}</span>}
          <span className="chip chip-outline" title={formatDateTimeIST(draft.createdAt)}>
            {relativeTime(draft.createdAt, now)}, {draft.createdByName}
          </span>
          {dirty && <span className="chip chip-amber">Unsaved changes</span>}
        </div>

        <AgentOutputView
          output={output}
          onChange={(o) => {
            setOutput(o);
            setDirty(true);
          }}
          agentRef={draft.ref}
          draftId={draft.id}
        />

        {inputSummary(draft.input).length > 0 && (
          <details className="group rounded-inset bg-surface-2 px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] font-medium text-ink-2 [&::-webkit-details-marker]:hidden">
              <ChevronDown aria-hidden className="size-4 -rotate-90 transition-transform group-open:rotate-0" />
              What the assistant was given
            </summary>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
              {inputSummary(draft.input).map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="min-w-0 break-words text-ink">{v}</dd>
                </React.Fragment>
              ))}
            </dl>
          </details>
        )}

        {versions.length > 0 && (
          <section className="card-inset p-4">
            <button type="button" className="btn btn-plain btn-sm -ml-2" aria-expanded={showVersions} onClick={() => setShowVersions((v) => !v)}>
              <ChevronDown aria-hidden className={`transition-transform ${showVersions ? "" : "-rotate-90"}`} />
              Previous versions ({versions.length})
            </button>
            {showVersions && (
              <ol className="mt-2 space-y-1.5">
                {versions
                  .map((v, i) => ({ v, i }))
                  .reverse()
                  .map(({ v, i }) => (
                    <li key={i} className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] text-ink">Version {i + 1}</p>
                        <p className="truncate text-[12px] text-ink-3">
                          {relativeTime(v.at, now)}, before “{v.instruction}”
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm shrink-0"
                        onClick={() => {
                          setOutput(v.output);
                          setDirty(true);
                          toast({ message: `Version ${i + 1} is in the editor. Save to keep it.` });
                        }}
                      >
                        Restore
                      </button>
                    </li>
                  ))}
              </ol>
            )}
          </section>
        )}

        <button
          type="button"
          className="btn btn-plain btn-sm -ml-2"
          onClick={() => {
            navigate("assistant", { agent: draft.agentKey, ref: draft.ref ? `${draft.ref.type}:${draft.ref.id}` : undefined, tab: null });
            onClose();
          }}
        >
          <PenLine aria-hidden /> Run this task again in the Assistant
        </button>
      </div>
    </Sheet>
  );
}

export function DraftSheet({ overlay, onClose }: { overlay: DraftOverlay; onClose: () => void }) {
  const { data } = useHub();
  const draft = data.drafts.find((d) => d.id === overlay.draftId);
  if (!draft) {
    return (
      <Sheet open onClose={onClose} title="Draft" width="md">
        <EmptyState icon={<PenLine />} title="This draft isn't available" body="It was deleted, or it belongs to someone else." />
      </Sheet>
    );
  }
  return <DraftEditor draft={draft} onClose={onClose} />;
}
