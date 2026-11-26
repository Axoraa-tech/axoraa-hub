"use client";

import React, { useMemo, useState } from "react";
import { Archive, Check, FileText, PenLine, Search, Trash2 } from "lucide-react";
import { AGENT_BY_KEY, AGENT_CATALOG } from "@/lib/agents/catalog";
import type { AgentKey, AgentRef } from "@/lib/agents/types";
import { formatDateIST, relativeTime } from "@/lib/format";
import { useHub } from "@/lib/hub/context";
import { useNow } from "@/lib/prefs";
import type { AgentDraft } from "@/lib/types";
import type { HubData } from "@/lib/useHubData";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Select } from "@/components/ui/form";
import { Avatar, EmptyState, Segmented, Toolbar } from "@/components/ui/primitives";
import { StatusDot, type Tone } from "@/components/ui/Status";
import { LANGUAGE_LABEL } from "./AgentRunner";

type StatusFilter = "all" | AgentDraft["status"];

export const DRAFT_STATUS: Record<AgentDraft["status"], { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "accent" },
  used: { label: "Used", tone: "positive" },
  archived: { label: "Archived", tone: "neutral" },
};

/** A readable name for the record a draft was made from. */
export function refLabel(data: HubData, ref?: AgentRef): string {
  if (!ref) return "";
  switch (ref.type) {
    case "deal":
      return data.deals.find((d) => d.id === ref.id)?.companyName ?? "Deal (not available)";
    case "visit": {
      const v = data.interactions.find((x) => x.id === ref.id);
      return v ? `${v.companyName}, ${formatDateIST(v.date)}` : "Visit (not available)";
    }
    case "invoice": {
      const p = data.payments.find((x) => x.id === ref.id);
      return p ? `${p.invoiceId}, ${p.companyName}` : "Invoice (not available)";
    }
    case "campaign":
      return data.campaigns.find((c) => c.id === ref.id)?.name ?? "Campaign (not available)";
    case "client":
      return data.clients.find((c) => c.id === ref.id)?.companyName ?? "Client (not available)";
  }
}

export function DraftHistory({ onRunAgent }: { onRunAgent?: () => void }) {
  const { data, viewer, openOverlay, registerSearch } = useHub();
  const toast = useToast();
  const confirm = useConfirm();
  const now = useNow();
  const [agent, setAgent] = useState<"all" | AgentKey>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [q, setQ] = useState("");
  const isAdmin = viewer.category === "admin";

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.drafts
      .filter((d) => (agent === "all" ? true : d.agentKey === agent))
      .filter((d) => (status === "all" ? true : d.status === status))
      .filter((d) => {
        if (!needle) return true;
        const hay = `${d.title} ${AGENT_BY_KEY[d.agentKey]?.name ?? ""} ${refLabel(data, d.ref)} ${d.createdByName}`.toLowerCase();
        return hay.includes(needle);
      })
      .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
  }, [data, agent, status, q]);

  const setDraftStatus = async (d: AgentDraft, next: AgentDraft["status"]) => {
    const before = d.status;
    const res = await data.saveDraft({ status: next }, d.id);
    toast({
      message: res.ok ? (next === "used" ? "Marked as used" : next === "archived" ? "Archived" : "Moved back to drafts") : "Saved on this device. Not saved to Google Sheets yet.",
      tone: res.ok ? "neutral" : "negative",
      action: { label: "Undo", onClick: () => void data.saveDraft({ status: before }, d.id) },
    });
  };

  const remove = async (d: AgentDraft) => {
    const ok = await confirm({ title: "Delete this draft?", body: `“${d.title}” and its earlier versions will be removed. This can't be undone.`, confirmLabel: "Delete draft", tone: "danger" });
    if (!ok) return;
    const res = await data.deleteDraft(d.id);
    toast(res.ok ? { message: "Draft deleted" } : { message: res.error || "Couldn't delete the draft.", tone: "negative" });
  };

  const columns: TableColumn<AgentDraft>[] = [
    {
      id: "title",
      header: "Draft",
      cell: (d) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2">
            <PenLine className="size-3.5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium text-ink">{d.title}</span>
            {d.language && d.language !== "en" && <span className="block text-[12px] text-ink-3">{LANGUAGE_LABEL[d.language]}</span>}
          </span>
        </span>
      ),
      sortValue: (d) => d.title,
    },
    { id: "agent", header: "Task", cell: (d) => AGENT_BY_KEY[d.agentKey]?.name ?? d.agentKey, sortValue: (d) => AGENT_BY_KEY[d.agentKey]?.name, hideBelow: "lg" },
    { id: "record", header: "Record", cell: (d) => refLabel(data, d.ref), truncate: true, hideBelow: "md" },
    ...(isAdmin
      ? [
          {
            id: "by",
            header: "Created by",
            cell: (d: AgentDraft) => (
              <span className="inline-flex items-center gap-2">
                <Avatar name={d.createdByName} size={24} />
                {d.createdByName}
              </span>
            ),
            sortValue: (d: AgentDraft) => d.createdByName,
            hideBelow: "lg" as const,
          },
        ]
      : []),
    { id: "created", header: "Created", cell: (d) => relativeTime(d.createdAt, now), sortValue: (d) => d.createdAt, width: 130 },
    { id: "status", header: "Status", cell: (d) => <StatusDot tone={DRAFT_STATUS[d.status]?.tone ?? "neutral"} label={DRAFT_STATUS[d.status]?.label ?? d.status} />, sortValue: (d) => d.status, width: 120 },
  ];

  const filtered = agent !== "all" || status !== "all" || q.trim() !== "";

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar>
        <label className="relative block min-w-0 flex-1 basis-[220px] sm:max-w-[320px]">
          <span className="sr-only">Search drafts</span>
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input ref={registerSearch} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search drafts" className="field pl-10" />
        </label>
        <Select aria-label="Task" value={agent} onChange={(e) => setAgent(e.target.value as "all" | AgentKey)} className="w-full sm:w-[220px]">
          <option value="all">All tasks</option>
          {AGENT_CATALOG.map((a) => (
            <option key={a.key} value={a.key}>
              {a.name}
            </option>
          ))}
        </Select>
        <Segmented<StatusFilter>
          label="Draft status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All" },
            { value: "draft", label: "Draft" },
            { value: "used", label: "Used" },
            { value: "archived", label: "Archived" },
          ]}
        />
      </Toolbar>

      <DataTable
        caption="Assistant drafts"
        rows={rows}
        columns={columns}
        rowKey={(d) => d.id}
        flashKey={data.lastSaved?.entity === "drafts" ? `${data.lastSaved.id}:${data.lastSaved.at}` : undefined}
        onRowClick={(d) => openOverlay({ kind: "draft", draftId: d.id })}
        rowLabel={(d) => d.title}
        rowStatus={(d) => (data.unsynced.some((u) => u.entity === "drafts" && u.id === d.id) ? "unsynced" : undefined)}
        rowActions={(d) => [
          { label: "Open", icon: <FileText />, onSelect: () => openOverlay({ kind: "draft", draftId: d.id }) },
          d.status !== "used"
            ? { label: "Mark as used", icon: <Check />, onSelect: () => void setDraftStatus(d, "used") }
            : { label: "Move back to drafts", icon: <PenLine />, onSelect: () => void setDraftStatus(d, "draft") },
          d.status !== "archived"
            ? { label: "Archive", icon: <Archive />, onSelect: () => void setDraftStatus(d, "archived") }
            : { label: "Unarchive", icon: <Archive />, onSelect: () => void setDraftStatus(d, "draft") },
          { label: "Delete", icon: <Trash2 />, tone: "danger", separatorBefore: true, onSelect: () => void remove(d) },
        ]}
        mobileCard={(d) => (
          <>
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 text-[14px] font-medium text-ink">{d.title}</span>
              <StatusDot tone={DRAFT_STATUS[d.status]?.tone ?? "neutral"} label={DRAFT_STATUS[d.status]?.label ?? d.status} />
            </div>
            <p className="mt-1 truncate text-[12.5px] text-ink-3">
              {AGENT_BY_KEY[d.agentKey]?.name}
              {d.ref ? `, ${refLabel(data, d.ref)}` : ""}
            </p>
            <p className="mt-0.5 text-[12px] text-ink-3">
              {relativeTime(d.createdAt, now)}
              {isAdmin ? `, by ${d.createdByName}` : ""}
            </p>
          </>
        )}
        empty={
          filtered ? (
            <EmptyState icon={<Search />} title="No drafts match" body="Try another task or status, or clear the search." />
          ) : (
            <EmptyState
              icon={<PenLine />}
              title="No drafts yet"
              body="Run a task and the result is saved here, ready to edit and send."
              action={
                onRunAgent ? (
                  <button type="button" className="btn btn-primary btn-sm" onClick={onRunAgent}>
                    Run a task
                  </button>
                ) : undefined
              }
            />
          )
        }
      />
    </div>
  );
}
