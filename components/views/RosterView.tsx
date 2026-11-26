"use client";

import React, { useState } from "react";
import { Download, GitBranch, Pencil, Plus, Trash2, Users } from "lucide-react";
import type { DeveloperRosterMember, RepositoryMapping } from "@/lib/types";
import { useHub } from "@/lib/hub/context";
import { can } from "@/lib/hub/permissions";
import { downloadCsv, REPOSITORY_COLUMNS, ROSTER_COLUMNS } from "@/lib/export";
import { formatDateIST } from "@/lib/format";
import { Avatar, EmptyState, SectionHeader } from "@/components/ui/primitives";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { SummaryBand } from "@/components/ui/SummaryBand";
import { StatusDot } from "@/components/ui/Status";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { RepositorySheet, RosterMemberSheet } from "@/components/engineering/RosterForms";

type Editing = { kind: "member"; row: DeveloperRosterMember | null } | { kind: "repo"; row: RepositoryMapping | null } | null;

const repoTone = (s: RepositoryMapping["status"]) => (s === "Active" ? "positive" : s === "Maintenance" ? "warning" : "neutral");

/** Team roster and repositories ('eng_roster', admin). */
export function RosterView() {
  const { data, viewer } = useHub();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState<Editing>(null);
  const canEdit = can(viewer, "roster.edit", { data });

  const roster = [...data.roster].sort((a, b) => (a.active === b.active ? a.developerName.localeCompare(b.developerName) : a.active === "Yes" ? -1 : 1));
  const repos = [...data.repositories].sort((a, b) => a.projectName.localeCompare(b.projectName) || a.repository.localeCompare(b.repository));
  const active = roster.filter((r) => r.active === "Yes").length;
  const activeRepos = repos.filter((r) => r.status === "Active").length;

  const unsynced = (entity: "roster" | "repositories") => (row: { id: string }) =>
    data.unsynced.some((o) => o.entity === entity && o.id === row.id) ? ("unsynced" as const) : undefined;
  const flash = (entity: "roster" | "repositories") =>
    data.lastSaved?.entity === entity ? `${data.lastSaved.id}:${data.lastSaved.at}` : undefined;

  const removeMember = async (m: DeveloperRosterMember) => {
    const ok = await confirm({
      title: `Remove ${m.developerName} from the roster?`,
      body: "Their work-log entries stay. To keep them on the roster without counting towards capacity, switch Active off instead.",
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    const res = await data.deleteRosterMember(m.id);
    toast(res.ok ? { message: `Removed ${m.developerName}` } : { message: `Couldn't remove ${m.developerName}. ${res.error}`, tone: "negative" });
  };

  const removeRepo = async (r: RepositoryMapping) => {
    const ok = await confirm({
      title: `Delete ${r.repository}?`,
      body: "Entries that name this repository keep the name. It just won't be offered in the work-log form.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const res = await data.deleteRepository(r.id);
    toast(res.ok ? { message: `Deleted ${r.repository}` } : { message: `Couldn't delete ${r.repository}. ${res.error}`, tone: "negative" });
  };

  const memberColumns: TableColumn<DeveloperRosterMember>[] = [
    {
      id: "name",
      header: "Name",
      cell: (m) => (
        <span className="flex items-center gap-2.5 whitespace-nowrap">
          <Avatar name={m.developerName} size={28} />
          <span className="font-medium text-ink">{m.developerName}</span>
        </span>
      ),
      sortValue: (m) => m.developerName,
    },
    { id: "role", header: "Role", cell: (m) => m.role, sortValue: (m) => m.role },
    { id: "area", header: "Area", cell: (m) => m.primaryArea, sortValue: (m) => m.primaryArea, hideBelow: "lg" },
    {
      id: "status",
      header: "Status",
      cell: (m) => <StatusDot tone={m.active === "Yes" ? "positive" : "neutral"} label={m.active === "Yes" ? "Active" : "Not active"} />,
      sortValue: (m) => (m.active === "Yes" ? 0 : 1),
    },
    {
      id: "joined",
      header: "Joined",
      cell: (m) => (m.joiningDate ? <span className="whitespace-nowrap tabular-nums text-ink-2">{formatDateIST(m.joiningDate, { year: true })}</span> : null),
      sortValue: (m) => m.joiningDate,
      hideBelow: "lg",
    },
    { id: "notes", header: "Notes", cell: (m) => <span className="text-ink-3">{m.notes}</span>, truncate: true },
  ];

  const repoColumns: TableColumn<RepositoryMapping>[] = [
    { id: "project", header: "Project", cell: (r) => <span className="font-medium text-ink">{r.projectName}</span>, sortValue: (r) => r.projectName },
    { id: "repo", header: "Repository", cell: (r) => r.repository, mono: true, sortValue: (r) => r.repository },
    { id: "type", header: "Type", cell: (r) => r.type, sortValue: (r) => r.type, hideBelow: "lg" },
    { id: "status", header: "Status", cell: (r) => <StatusDot tone={repoTone(r.status)} label={r.status} />, sortValue: (r) => r.status },
    { id: "desc", header: "Description", cell: (r) => <span className="text-ink-3">{r.description}</span>, truncate: true },
  ];

  return (
    <div className="space-y-6 lg:space-y-8">
      <SummaryBand
        ariaLabel="Team and repositories"
        items={[
          { label: "Active people", value: active, compare: { text: `${roster.length} on the roster` } },
          { label: "Not active", value: roster.length - active, compare: { text: "Not counted in capacity" } },
          { label: "Repositories", value: repos.length, compare: { text: `${activeRepos} active` } },
          { label: "Weekly target", value: `${data.settings.weeklyHoursTarget} h`, compare: { text: "Per person, set in Settings" } },
        ]}
      />

      <section aria-labelledby="roster-team" className="space-y-3">
        <SectionHeader
          id="roster-team"
          title="Team"
          description="Who is on the engineering team. Active people count towards capacity on the team dashboard."
          actions={
            <>
              {roster.length > 0 && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadCsv("axoraa-roster", roster, ROSTER_COLUMNS)}>
                  <Download aria-hidden className="size-4" /> Export CSV
                </button>
              )}
              {canEdit && (
                <button type="button" className="btn btn-ink btn-sm" onClick={() => setEditing({ kind: "member", row: null })}>
                  <Plus aria-hidden className="size-4" /> Add person
                </button>
              )}
            </>
          }
        />
        <DataTable
          caption="Team roster"
          rows={roster}
          columns={memberColumns}
          rowKey={(m) => m.id}
          rowLabel={(m) => m.developerName}
          flashKey={flash("roster")}
          rowStatus={unsynced("roster")}
          onRowClick={canEdit ? (m) => setEditing({ kind: "member", row: m }) : undefined}
          rowActions={
            canEdit
              ? (m) => [
                  { label: "Edit", icon: <Pencil />, onSelect: () => setEditing({ kind: "member", row: m }) },
                  { label: "Remove", icon: <Trash2 />, tone: "danger", separatorBefore: true, onSelect: () => void removeMember(m) },
                ]
              : undefined
          }
          mobileCard={(m) => (
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={m.developerName} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[14px] font-medium text-ink">{m.developerName}</span>
                  <StatusDot tone={m.active === "Yes" ? "positive" : "neutral"} label={m.active === "Yes" ? "Active" : "Not active"} />
                </div>
                <p className="mt-0.5 truncate text-[12.5px] text-ink-3">{[m.role, m.primaryArea].filter(Boolean).join(", ")}</p>
              </div>
            </div>
          )}
          empty={
            <EmptyState
              icon={<Users />}
              title="Nobody on the roster yet"
              body="Until someone is added, capacity counts every founder and developer."
              action={
                canEdit ? (
                  <button type="button" className="btn btn-ink btn-sm" onClick={() => setEditing({ kind: "member", row: null })}>
                    <Plus aria-hidden className="size-4" /> Add person
                  </button>
                ) : undefined
              }
            />
          }
        />
      </section>

      <section aria-labelledby="roster-repos" className="space-y-3">
        <SectionHeader
          id="roster-repos"
          title="Repositories"
          description="Offered in the work-log form under their project."
          actions={
            <>
              {repos.length > 0 && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadCsv("axoraa-repositories", repos, REPOSITORY_COLUMNS)}>
                  <Download aria-hidden className="size-4" /> Export CSV
                </button>
              )}
              {canEdit && (
                <button type="button" className="btn btn-ink btn-sm" onClick={() => setEditing({ kind: "repo", row: null })}>
                  <Plus aria-hidden className="size-4" /> Add repository
                </button>
              )}
            </>
          }
        />
        <DataTable
          caption="Repositories"
          rows={repos}
          columns={repoColumns}
          rowKey={(r) => r.id}
          rowLabel={(r) => r.repository}
          flashKey={flash("repositories")}
          rowStatus={unsynced("repositories")}
          onRowClick={canEdit ? (r) => setEditing({ kind: "repo", row: r }) : undefined}
          rowActions={
            canEdit
              ? (r) => [
                  { label: "Edit", icon: <Pencil />, onSelect: () => setEditing({ kind: "repo", row: r }) },
                  { label: "Delete", icon: <Trash2 />, tone: "danger", separatorBefore: true, onSelect: () => void removeRepo(r) },
                ]
              : undefined
          }
          mobileCard={(r) => (
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-[13.5px] text-ink">{r.repository}</span>
                <StatusDot tone={repoTone(r.status)} label={r.status} />
              </div>
              <p className="mt-0.5 truncate text-[12.5px] text-ink-3">{[r.projectName, r.type].filter(Boolean).join(", ")}</p>
            </div>
          )}
          empty={
            <EmptyState
              icon={<GitBranch />}
              title="No repositories yet"
              body="Add the repositories the team works in so they can be picked when logging work."
              action={
                canEdit ? (
                  <button type="button" className="btn btn-ink btn-sm" onClick={() => setEditing({ kind: "repo", row: null })}>
                    <Plus aria-hidden className="size-4" /> Add repository
                  </button>
                ) : undefined
              }
            />
          }
        />
      </section>

      {editing?.kind === "member" && <RosterMemberSheet key={editing.row?.id ?? "new"} member={editing.row} onClose={() => setEditing(null)} />}
      {editing?.kind === "repo" && <RepositorySheet key={editing.row?.id ?? "new"} repo={editing.row} onClose={() => setEditing(null)} />}
    </div>
  );
}
