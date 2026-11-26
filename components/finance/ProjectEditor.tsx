"use client";

import React, { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useHub } from "@/lib/hub/context";
import { can } from "@/lib/hub/permissions";
import type { Overlay } from "@/lib/views";
import type { ClientMasterRecord, ProjectDeliveryStatus, ProjectProgressRecord } from "@/lib/types";
import { FOUNDER_NAMES } from "@/lib/people";
import { addDaysKey, todayKeyIST } from "@/lib/format";
import { Sheet } from "@/components/ui/Dialog";
import { Menu } from "@/components/ui/Menu";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Combobox, DateInput, ErrorSummary, Field, Input, Select, Textarea } from "@/components/ui/form";
import { DELIVERY_STATUSES, NotSavedBanner, ReadOnlyNote } from "./ClientEditor";

interface ProjectForm {
  projectName: string;
  client: ClientMasterRecord | null;
  projectManager: string;
  status: ProjectDeliveryStatus;
  completion: string;
  blockerDetails: string;
  blockerOwner: string;
  targetReleaseDate: string;
}

type Errors = Partial<Record<"projectName" | "client" | "projectManager" | "completion", string>>;

function validate(f: ProjectForm): Errors {
  const e: Errors = {};
  if (!f.projectName.trim()) e.projectName = "Enter the project name";
  if (!f.client) e.client = "Choose the client";
  if (!f.projectManager.trim()) e.projectManager = "Choose the project manager";
  const n = Number(f.completion);
  if (f.completion.trim() === "" || !Number.isFinite(n) || n < 0 || n > 100) e.completion = "Enter a number from 0 to 100";
  return e;
}

const ORDER: (keyof Errors)[] = ["projectName", "client", "projectManager", "completion"];
const FIELD_ID: Record<keyof Errors, string> = {
  projectName: "project-name",
  client: "project-client",
  projectManager: "project-pm",
  completion: "project-completion",
};

export function ProjectEditor({ overlay, onClose }: { overlay: Extract<Overlay, { kind: "project" }>; onClose: () => void }) {
  const { data, viewer } = useHub();
  const toast = useToast();
  const confirm = useConfirm();

  const existing = useMemo(
    () => (overlay.projectId ? data.projects.find((p) => p.id === overlay.projectId || p.projectId === overlay.projectId) ?? null : null),
    [data.projects, overlay.projectId]
  );
  const missing = !!overlay.projectId && !existing;
  const lockedPm = viewer.privileged ? null : viewer.name;
  const canEdit = existing ? can(viewer, "project.edit", { record: existing }) : can(viewer, "project.edit");
  const canDelete = !!existing && can(viewer, "project.delete", { record: existing });

  const [form, setForm] = useState<ProjectForm>(() => {
    const clientKey = existing?.clientId ?? overlay.clientId;
    const client = clientKey ? data.clients.find((c) => c.clientId === clientKey || c.id === clientKey) ?? null : null;
    return {
      projectName: existing?.projectName ?? "",
      client,
      projectManager: lockedPm ?? existing?.projectManager ?? client?.salesOwner ?? "",
      status: existing?.status ?? "Development",
      completion: String(existing?.completionPercentage ?? 0),
      blockerDetails: existing?.blockerDetails ?? "",
      blockerOwner: existing?.blockerOwner ?? "",
      targetReleaseDate: existing?.targetReleaseDate || addDaysKey(todayKeyIST(), 30),
    };
  });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failedId, setFailedId] = useState<string | null>(null);

  const errors = submitted ? validate(form) : {};
  const summary = ORDER.filter((k) => errors[k]).map((k) => ({ field: FIELD_ID[k], message: errors[k]! }));
  const set = <K extends keyof ProjectForm>(k: K, v: ProjectForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const pct = Math.max(0, Math.min(100, Number(form.completion) || 0));

  const managers = useMemo(() => {
    const list = [...FOUNDER_NAMES];
    if (form.projectManager && !list.includes(form.projectManager)) list.push(form.projectManager);
    return list;
  }, [form.projectManager]);

  const save = async () => {
    setSubmitted(true);
    if (Object.keys(validate(form)).length || !form.client) return;
    setSaving(true);
    const patch: Partial<ProjectProgressRecord> = {
      projectName: form.projectName.trim(),
      clientId: form.client.clientId,
      projectManager: lockedPm ?? form.projectManager,
      status: form.status,
      completionPercentage: Math.round(pct * 10) / 10,
      blockerDetails: form.blockerDetails.trim(),
      blockerOwner: form.blockerOwner.trim(),
      targetReleaseDate: form.targetReleaseDate,
    };
    if (!existing && !failedId) patch.projectId = "";
    try {
      const res = await data.saveProject(patch, existing?.id ?? failedId ?? undefined);
      if (res.ok) {
        toast({ message: existing ? `Saved ${res.record.projectName}` : `Added ${res.record.projectName}`, tone: "positive" });
        onClose();
      } else {
        setFailedId(res.record.id);
      }
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Couldn't save the project.", tone: "negative" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirm({
      title: `Delete ${existing.projectName}?`,
      body: "The project and its progress are removed for everyone. This can't be undone from the hub.",
      confirmLabel: "Delete project",
      tone: "danger",
    });
    if (!ok) return;
    const res = await data.deleteProject(existing.id);
    if (res.ok) {
      toast({ message: `Deleted ${existing.projectName}` });
      onClose();
    } else {
      toast({ message: `Couldn't delete ${existing.projectName}. ${res.error}`, tone: "negative" });
    }
  };

  if (missing) {
    return (
      <Sheet open onClose={onClose} title="Project not found" description="It may have been deleted, or it belongs to someone else.">
        <ReadOnlyNote>Nothing to show here. Close this panel and pick a project from the list.</ReadOnlyNote>
      </Sheet>
    );
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={existing ? existing.projectName || "Project" : "Add project"}
      description={existing ? `${existing.projectId || "No project ID yet"}, ${form.client?.companyName ?? "no client"}` : "Delivery for a signed client"}
      headerActions={
        canDelete ? (
          <Menu label="Project actions" items={[{ label: "Delete project", icon: <Trash2 />, tone: "danger", onSelect: () => void remove() }]} />
        ) : undefined
      }
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {canEdit ? "Cancel" : "Close"}
          </button>
          {canEdit && (
            <button type="button" className="btn btn-ink" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving" : existing ? "Save project" : "Add project"}
            </button>
          )}
        </>
      }
    >
      <form
        noValidate
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (canEdit) void save();
        }}
      >
        {failedId && <NotSavedBanner id={failedId} />}
        {!canEdit && <ReadOnlyNote>Only the administrator and the project manager can change this project.</ReadOnlyNote>}
        <ErrorSummary errors={summary} />

        <div className="card-inset p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] text-ink-3">Progress</span>
            <span className="num text-[30px]">{Math.round(pct)}%</span>
          </div>
          <div
            role="progressbar"
            aria-label="Project progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            className="mt-3 h-3 overflow-hidden rounded-full bg-surface"
          >
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${form.status === "Completed" ? "bg-ink" : form.status === "On Hold" ? "bg-coral" : "bg-lime"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Project" htmlFor="project-name" required error={errors.projectName} className="sm:col-span-2">
            <Input id="project-name" value={form.projectName} onChange={(e) => set("projectName", e.target.value)} placeholder="Customer portal, phase 1" />
          </Field>
          <div className="sm:col-span-2">
            <Combobox
              id="project-client"
              label="Client"
              items={data.clients}
              value={form.client}
              onChange={(c) => setForm((f) => ({ ...f, client: c, projectManager: lockedPm ?? (f.projectManager || c?.salesOwner || "") }))}
              getKey={(c) => c.id}
              getLabel={(c) => c.companyName}
              getDescription={(c) => [c.clientId, c.industry].filter(Boolean).join(", ")}
              placeholder={data.clients.length ? "Search clients" : "Add a client first"}
              error={errors.client}
            />
          </div>
          <Field label="Project manager" htmlFor="project-pm" required error={errors.projectManager} hint={lockedPm ? "Projects you add are led by you." : undefined}>
            <Select id="project-pm" value={form.projectManager} disabled={!!lockedPm} onChange={(e) => set("projectManager", e.target.value)}>
              <option value="">Choose a founder</option>
              {managers.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="project-status">
            <Select id="project-status" value={form.status} onChange={(e) => set("status", e.target.value as ProjectDeliveryStatus)}>
              {DELIVERY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Completion (%)" htmlFor="project-completion" error={errors.completion}>
            <Input
              id="project-completion"
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step={1}
              className="tabular-nums"
              value={form.completion}
              onChange={(e) => set("completion", e.target.value)}
            />
          </Field>
          <Field label="Target release" htmlFor="project-target">
            <DateInput id="project-target" value={form.targetReleaseDate} onChange={(e) => set("targetReleaseDate", e.target.value)} />
          </Field>
          <Field label="Blocker" htmlFor="project-blocker" hint="Leave empty when nothing is in the way" className="sm:col-span-2">
            <Textarea
              id="project-blocker"
              rows={3}
              value={form.blockerDetails}
              onChange={(e) => set("blockerDetails", e.target.value)}
              placeholder="Waiting on the client's API keys"
            />
          </Field>
          <Field label="Blocker owner" htmlFor="project-blocker-owner" className="sm:col-span-2">
            <Input id="project-blocker-owner" value={form.blockerOwner} onChange={(e) => set("blockerOwner", e.target.value)} placeholder="Who has to unblock it" />
          </Field>
        </fieldset>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}
