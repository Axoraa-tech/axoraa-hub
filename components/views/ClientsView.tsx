"use client";

import React, { useMemo, useState } from "react";
import { Briefcase, Download, FolderKanban, Pencil, Plus, ReceiptIndianRupee, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useHub } from "@/lib/hub/context";
import { can } from "@/lib/hub/permissions";
import type { EntityKey } from "@/lib/data/entities";
import type { ClientMasterRecord, ProjectProgressRecord } from "@/lib/types";
import { formatDateIST, formatInr, formatInrFull } from "@/lib/format";
import { CLIENT_COLUMNS, PROJECT_COLUMNS, downloadCsv } from "@/lib/export";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Avatar, CardHeader, EmptyState, SectionHeader, StatusPill } from "@/components/ui/primitives";
import { SummaryBand } from "@/components/ui/SummaryBand";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { SegmentMeter } from "@/components/charts/Charts";

/* ------------------------------------------------------------------ shared view pieces */

/** Pill search field wired to the hub's '/' shortcut. */
export function SearchField({
  value,
  onChange,
  label,
  placeholder,
  inputRef,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder: string;
  inputRef?: (el: HTMLInputElement | null) => void;
  className?: string;
}) {
  return (
    <label className={`relative block w-full sm:w-72 ${className}`}>
      <span className="sr-only">{label}</span>
      <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            onChange("");
          }
        }}
        placeholder={placeholder}
        className="field pl-10"
      />
    </label>
  );
}

/** Coral inset card when changes to these entities did not reach Google Sheets. */
export function UnsyncedNotice({ entities }: { entities: EntityKey[] }) {
  const { data } = useHub();
  const [busy, setBusy] = useState(false);
  const ops = data.unsynced.filter((u) => entities.includes(u.entity));
  if (!ops.length) return null;
  return (
    <div role="alert" className="card flex flex-col gap-3 bg-coral-soft! p-4 shadow-none sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-coral text-white">
          <RefreshCw className="h-4 w-4" />
        </span>
        <p className="min-w-0 pt-1.5 text-[13.5px] text-ink">
          {ops.length === 1 ? "1 change is" : `${ops.length} changes are`} not saved to Google Sheets yet. They are kept on this device.
        </p>
      </div>
      <button
        type="button"
        className="btn btn-ink btn-sm self-start sm:self-auto"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await data.retrySync();
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Retrying" : "Try again"}
      </button>
    </div>
  );
}

/** "row-id:timestamp" when the last save was a record of this entity, for DataTable's flashKey. */
export function flashFor(lastSaved: { entity: EntityKey; id: string; at: number } | null, entity: EntityKey): string | undefined {
  return lastSaved && lastSaved.entity === entity ? `${lastSaved.id}:${lastSaved.at}` : undefined;
}

const ACTIVE: ProjectProgressRecord["status"][] = ["Development", "Testing", "Client Review"];

function hasBlocker(p: ProjectProgressRecord): boolean {
  const b = (p.blockerDetails ?? "").trim();
  return !!b && !/^none\b/i.test(b) && !/^no blocker/i.test(b);
}

function matches(q: string, ...fields: (string | undefined)[]): boolean {
  return fields.some((f) => (f ?? "").toLowerCase().includes(q));
}

/* ------------------------------------------------------------------ view */

export function ClientsView() {
  const { data, viewer, params, setParams, navigate, openOverlay, registerSearch } = useHub();
  const toast = useToast();
  const confirm = useConfirm();
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const [owner, setOwner] = useState<string | null>(null);
  const q = query.trim().toLowerCase();

  const showFounders = viewer.privileged && viewer.isAdmin;
  const canAddClient = can(viewer, "client.edit");
  const canAddProject = can(viewer, "project.edit");

  const pendingByClient = useMemo(() => {
    const m = new Map<string, { pending: number; overdue: number }>();
    for (const p of data.payments) {
      const cur = m.get(p.clientId) ?? { pending: 0, overdue: 0 };
      cur.pending += Number(p.pendingAmount) || 0;
      cur.overdue += Number(p.overdueAmount) || 0;
      m.set(p.clientId, cur);
    }
    return m;
  }, [data.payments]);
  const clientName = useMemo(() => new Map(data.clients.map((c) => [c.clientId, c.companyName])), [data.clients]);
  const unsyncedIds = useMemo(() => new Set(data.unsynced.map((u) => u.id)), [data.unsynced]);

  const clients = useMemo(
    () =>
      data.clients.filter(
        (c) =>
          (!owner || c.salesOwner === owner) &&
          (!q || matches(q, c.companyName, c.contactPerson, c.clientId, c.industry, c.salesOwner, c.contractScope))
      ),
    [data.clients, owner, q]
  );
  const projects = useMemo(
    () =>
      data.projects.filter(
        (p) =>
          (!owner || p.projectManager === owner) &&
          (!q || matches(q, p.projectName, p.projectId, clientName.get(p.clientId), p.projectManager, p.blockerDetails))
      ),
    [data.projects, owner, q, clientName]
  );

  if (!data.ready) return <SkeletonPage />;

  const won = data.clients.filter((c) => c.dealStatus === "Won");
  const contractValue = won.reduce((s, c) => s + (Number(c.dealValue) || 0), 0);
  const active = data.projects.filter((p) => ACTIVE.includes(p.status));
  const blocked = active.filter(hasBlocker).length;
  const pending = data.payments.reduce((s, p) => s + (Number(p.pendingAmount) || 0), 0);
  const overdue = data.payments.reduce((s, p) => s + (Number(p.overdueAmount) || 0), 0);
  const projectFlash = flashFor(data.lastSaved, "projects");
  const totalValue = clients.reduce((s, c) => s + (Number(c.dealValue) || 0), 0);

  const updateQuery = (v: string) => {
    setQuery(v);
    setParams({ q: v.trim() || null });
  };

  const removeClient = async (c: ClientMasterRecord) => {
    const ok = await confirm({
      title: `Delete ${c.companyName}?`,
      body: "The client record is removed for everyone. Projects and invoices that point at it stay.",
      confirmLabel: "Delete client",
      tone: "danger",
    });
    if (!ok) return;
    const res = await data.deleteClient(c.id);
    toast(res.ok ? { message: `Deleted ${c.companyName}` } : { message: `Couldn't delete ${c.companyName}. ${res.error}`, tone: "negative" });
  };

  const removeProject = async (p: ProjectProgressRecord) => {
    const ok = await confirm({
      title: `Delete ${p.projectName}?`,
      body: "The project and its progress are removed for everyone.",
      confirmLabel: "Delete project",
      tone: "danger",
    });
    if (!ok) return;
    const res = await data.deleteProject(p.id);
    toast(res.ok ? { message: `Deleted ${p.projectName}` } : { message: `Couldn't delete ${p.projectName}. ${res.error}`, tone: "negative" });
  };

  const clientActions = (c: ClientMasterRecord): MenuItem[] => [
    { label: "Edit client", icon: <Pencil />, onSelect: () => openOverlay({ kind: "client", clientId: c.id }) },
    ...(canAddProject ? [{ label: "Add project", icon: <FolderKanban />, onSelect: () => openOverlay({ kind: "project", clientId: c.id }) }] : []),
    ...(viewer.privileged ? [{ label: "Add invoice", icon: <ReceiptIndianRupee />, onSelect: () => openOverlay({ kind: "invoice", clientId: c.id }) }] : []),
    ...(can(viewer, "client.delete", { record: c })
      ? [{ label: "Delete client", icon: <Trash2 />, tone: "danger" as const, separatorBefore: true, onSelect: () => void removeClient(c) }]
      : []),
  ];

  const columns: TableColumn<ClientMasterRecord>[] = [
    {
      id: "company",
      header: "Company",
      sortValue: (c) => c.companyName,
      cell: (c) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-ink">{c.companyName}</div>
          <div className="truncate text-[12px] text-ink-3">
            {[c.contactPerson, c.clientId].filter(Boolean).join(", ") || c.industry || "No contact yet"}
          </div>
        </div>
      ),
    },
    {
      id: "owner",
      header: "Owner",
      sortValue: (c) => c.salesOwner,
      hideBelow: "lg",
      cell: (c) =>
        c.salesOwner ? (
          <span className="flex items-center gap-2 whitespace-nowrap">
            <Avatar name={c.salesOwner} size={26} />
            {c.salesOwner}
          </span>
        ) : null,
    },
    { id: "value", header: "Deal value", align: "right", sortValue: (c) => Number(c.dealValue) || 0, cell: (c) => <span className="font-medium">{formatInrFull(c.dealValue)}</span> },
    { id: "deal", header: "Deal", sortValue: (c) => c.dealStatus, cell: (c) => <StatusPill status={c.dealStatus} /> },
    { id: "delivery", header: "Delivery", sortValue: (c) => c.deliveryStatus, hideBelow: "lg", cell: (c) => <StatusPill status={c.deliveryStatus} /> },
    { id: "signed", header: "Signed", sortValue: (c) => c.signedDate, hideBelow: "lg", cell: (c) => (c.signedDate ? <span className="whitespace-nowrap tabular-nums text-ink-2">{formatDateIST(c.signedDate, { year: true })}</span> : null) },
    {
      id: "pending",
      header: "Pending",
      align: "right",
      sortValue: (c) => pendingByClient.get(c.clientId)?.pending ?? 0,
      cell: (c) => {
        const p = pendingByClient.get(c.clientId);
        if (!p || p.pending <= 0) return <span className="text-ink-3">₹0</span>;
        return <span className={p.overdue > 0 ? "font-medium text-negative" : "text-ink"}>{formatInrFull(p.pending)}</span>;
      },
    },
  ];

  const emptyClients =
    data.clients.length === 0 ? (
      <EmptyState
        icon={<Briefcase />}
        title="No clients yet"
        body="Add the account when a deal is signed. Projects and invoices hang off it."
        action={
          canAddClient ? (
            <button type="button" className="btn btn-ink btn-sm" onClick={() => openOverlay({ kind: "client" })}>
              <Plus aria-hidden /> Add client
            </button>
          ) : undefined
        }
      />
    ) : (
      <EmptyState
        icon={<Search />}
        title={q ? `No clients match "${query.trim()}"` : `${owner} has no clients yet`}
        body="Check the spelling, or clear the filters to see everyone."
        action={
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              updateQuery("");
              setOwner(null);
            }}
          >
            Clear filters
          </button>
        }
      />
    );

  return (
    <div className="space-y-3 sm:space-y-4">
      <UnsyncedNotice entities={["clients", "projects"]} />

      <SummaryBand
        ariaLabel="Clients summary"
        hero={!showFounders}
        items={[
          { label: "Clients", value: String(data.clients.length), compare: { text: `${won.length} won, ${data.clients.length - won.length} still open` } },
          { label: "Contract value", value: formatInr(contractValue), compare: { text: `Signed with ${won.length} ${won.length === 1 ? "client" : "clients"}` } },
          {
            label: "Active projects",
            value: String(active.length),
            compare: blocked ? { text: `${blocked} with a blocker`, tone: "warning" } : { text: "Nothing blocked" },
          },
          {
            label: "Pending collection",
            value: formatInr(pending),
            compare: overdue > 0 ? { text: `${formatInr(overdue)} overdue`, tone: "negative" } : { text: "Nothing overdue", tone: "positive" },
            onClick: viewer.isAdmin ? () => navigate("billing", { status: overdue > 0 ? "overdue" : null }) : undefined,
          },
        ]}
      />

      {showFounders && data.founderMatrix.length > 0 && (
        <section aria-label="Founders" className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          {data.founderMatrix.map((f, i) => {
            const ink = i === 0;
            const selected = owner === f.founder;
            const muted = ink ? "text-white/50" : "text-ink-3";
            return (
              <button
                key={f.founder}
                type="button"
                aria-pressed={selected}
                onClick={() => setOwner(selected ? null : f.founder)}
                className={`${ink ? "card-ink" : "card"} card-interactive animate-rise p-5 text-left sm:p-6 ${selected ? "shadow-[inset_0_0_0_2px_var(--color-lime)]" : ""}`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <span className="flex items-center gap-3">
                  <Avatar name={f.founder} size={40} />
                  <span className="min-w-0">
                    <span className="block text-[15px] font-medium">{f.founder}</span>
                    <span className={`block truncate text-[12px] ${muted}`}>{f.role}</span>
                  </span>
                  {selected && <span className={`chip ml-auto shrink-0 ${ink ? "chip-lime" : "chip-ink"}`}>Filtering</span>}
                </span>
                <span className="num mt-6 block text-[40px]">{formatInr(f.totalDealValue)}</span>
                <span className={`mt-1 block text-[12.5px] ${muted}`}>
                  {f.clientsBrought} {f.clientsBrought === 1 ? "client" : "clients"} brought in
                </span>
                <span className={`mt-5 grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-4 sm:gap-2 border-t pt-4 ${ink ? "border-white/10" : "border-line"}`}>
                  {[
                    { k: "Active", v: f.projectsLed.active },
                    { k: "Done", v: f.projectsLed.completed },
                    { k: "On hold", v: f.projectsLed.onHold },
                    { k: "Pending", v: formatInr(f.pendingCollection) },
                  ].map((s) => (
                    <span key={s.k} className="min-w-0">
                      <span className={`block truncate text-[12px] ${ink ? "text-white/45" : "text-ink-3"}`}>{s.k}</span>
                      <span className="mt-0.5 block truncate text-[14px] font-medium tabular-nums">{s.v}</span>
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </section>
      )}

      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchField value={query} onChange={updateQuery} label="Search clients and projects" placeholder="Search clients, projects or IDs" inputRef={registerSearch} />
        {owner && (
          <button type="button" className="chip chip-ink self-start sm:self-auto" onClick={() => setOwner(null)}>
            {owner}&apos;s clients and projects
            <X aria-hidden className="h-3.5 w-3.5" />
            <span className="sr-only">Clear the founder filter</span>
          </button>
        )}
      </div>

      <section aria-labelledby="clients-heading" className="space-y-3">
        <SectionHeader
          id="clients-heading"
          title="Client portfolio"
          description={`${clients.length} ${clients.length === 1 ? "account" : "accounts"}, ${formatInr(totalValue)} total deal value`}
          actions={
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!clients.length}
              onClick={() => downloadCsv("axoraa-clients", clients, CLIENT_COLUMNS)}
            >
              <Download aria-hidden className="h-3.5 w-3.5" /> CSV
            </button>
          }
        />
        <DataTable
          caption="Clients"
          rows={clients}
          columns={columns}
          rowKey={(c) => c.id}
          onRowClick={(c) => openOverlay({ kind: "client", clientId: c.id })}
          flashKey={flashFor(data.lastSaved, "clients")}
          rowStatus={(c) => (unsyncedIds.has(c.id) ? "unsynced" : undefined)}
          rowActions={clientActions}
          rowLabel={(c) => c.companyName}
          initialSort={{ id: "value", dir: "desc" }}
          empty={emptyClients}
          mobileCard={(c) => {
            const p = pendingByClient.get(c.clientId);
            return (
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[14px] font-medium text-ink">{c.companyName}</span>
                  <span className="shrink-0 text-[14px] font-medium tabular-nums text-ink">{formatInrFull(c.dealValue)}</span>
                </div>
                <div className="mt-1 truncate text-[12px] text-ink-3">{[c.contactPerson, c.salesOwner && `Owner ${c.salesOwner}`].filter(Boolean).join(", ")}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusPill status={c.dealStatus} />
                  <StatusPill status={c.deliveryStatus} />
                  {p && p.pending > 0 && <span className={`chip ${p.overdue > 0 ? "chip-coral" : "chip-amber"}`}>{formatInr(p.pending)} pending</span>}
                </div>
              </div>
            );
          }}
          footer={clients.length ? `${clients.length} shown of ${data.clients.length}` : undefined}
        />
      </section>

      <section aria-labelledby="delivery-heading" className="card p-4 sm:p-6">
        <CardHeader
          icon={<FolderKanban />}
          title={<span id="delivery-heading">Delivery &amp; blockers</span>}
          subtitle={`${projects.length} ${projects.length === 1 ? "project" : "projects"}, ${projects.filter((p) => ACTIVE.includes(p.status)).length} in progress`}
          action={
            <>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={!projects.length}
                onClick={() => downloadCsv("axoraa-projects", projects, PROJECT_COLUMNS)}
              >
                <Download aria-hidden className="h-3.5 w-3.5" /> CSV
              </button>
              {canAddProject && (
                <button type="button" className="icon-btn" aria-label="Add project" onClick={() => openOverlay({ kind: "project" })}>
                  <Plus aria-hidden className="h-4 w-4" />
                </button>
              )}
            </>
          }
        />
        {projects.length === 0 ? (
          <EmptyState
            className="py-10!"
            icon={<FolderKanban />}
            title={data.projects.length ? "No projects match these filters" : "No projects yet"}
            body={data.projects.length ? "Clear the search or founder filter to see every project." : "Add a project to track progress, blockers and the release date."}
            action={
              data.projects.length ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    updateQuery("");
                    setOwner(null);
                  }}
                >
                  Clear filters
                </button>
              ) : canAddProject && data.clients.length ? (
                <button type="button" className="btn btn-ink btn-sm" onClick={() => openOverlay({ kind: "project" })}>
                  <Plus aria-hidden /> Add project
                </button>
              ) : undefined
            }
          />
        ) : (
          <ul className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard
                key={projectFlash?.startsWith(`${p.id}:`) ? `${p.id}~${projectFlash}` : p.id}
                project={p}
                clientName={clientName.get(p.clientId)}
                flash={!!projectFlash?.startsWith(`${p.id}:`)}
                unsynced={unsyncedIds.has(p.id)}
                onOpen={() => openOverlay({ kind: "project", projectId: p.id })}
                onRetry={() => void data.retrySync(p.id)}
                actions={[
                  { label: "Edit project", icon: <Pencil />, onSelect: () => openOverlay({ kind: "project", projectId: p.id }) },
                  ...(viewer.privileged ? [{ label: "Add invoice", icon: <ReceiptIndianRupee />, onSelect: () => openOverlay({ kind: "invoice", clientId: p.clientId }) }] : []),
                  ...(can(viewer, "project.delete", { record: p })
                    ? [{ label: "Delete project", icon: <Trash2 />, tone: "danger" as const, separatorBefore: true, onSelect: () => void removeProject(p) }]
                    : []),
                ]}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ProjectCard({
  project: p,
  clientName,
  flash,
  unsynced,
  onOpen,
  onRetry,
  actions,
}: {
  project: ProjectProgressRecord;
  clientName?: string;
  flash: boolean;
  unsynced: boolean;
  onOpen: () => void;
  onRetry: () => void;
  actions: MenuItem[];
}) {
  const pct = Math.max(0, Math.min(100, Number(p.completionPercentage) || 0));
  const blocker = hasBlocker(p);
  return (
    <li className={`card-inset relative flex min-w-0 flex-col p-5 ${flash ? "animate-flash" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 rounded-xl text-left after:absolute after:inset-0 after:rounded-[inherit] after:content-['']">
          <span className="block font-mono text-[12px] text-ink-3">{[p.projectId, clientName].filter(Boolean).join(", ")}</span>
          <span className="mt-0.5 block truncate text-[15px] font-medium text-ink">{p.projectName}</span>
        </button>
        <div className="relative z-[1] flex shrink-0 items-center gap-1.5">
          <StatusPill status={p.status} />
          <Menu label={`Actions for ${p.projectName}`} items={actions} triggerClassName="icon-btn icon-btn-sm" />
        </div>
      </div>
      <div className="mt-4 flex items-end gap-2">
        <span className="num text-[34px]">{Math.round(pct)}%</span>
        {p.targetReleaseDate && <span className="mb-1 text-[12px] text-ink-3">due {formatDateIST(p.targetReleaseDate, { year: true })}</span>}
      </div>
      <div className="mt-3" role="progressbar" aria-label={`${p.projectName} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <SegmentMeter value={pct} total={100} slots={10} height={22} ariaLabel={`${Math.round(pct)} percent complete`} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-[12.5px]">
        {blocker ? (
          <span className="min-w-0 truncate text-negative" title={p.blockerDetails}>
            {p.blockerDetails}
            {p.blockerOwner ? <span className="text-ink-3">, {p.blockerOwner}</span> : null}
          </span>
        ) : (
          <span className="text-ink-3">No blockers</span>
        )}
        {p.projectManager && (
          <span className="flex shrink-0 items-center gap-1.5 text-ink-2">
            <Avatar name={p.projectManager} size={22} />
            <span className="sr-only">Project manager</span>
            {p.projectManager}
          </span>
        )}
      </div>
      {unsynced && (
        <span className="relative z-[1] mt-3 flex items-center gap-1.5 text-[12px] text-negative">
          <span aria-hidden className="dot dot-negative" />
          Not saved.
          <button type="button" className="font-medium underline underline-offset-2" onClick={onRetry}>
            Retry
          </button>
        </span>
      )}
    </li>
  );
}
