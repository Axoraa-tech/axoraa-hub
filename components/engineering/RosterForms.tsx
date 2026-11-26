"use client";

import React, { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { DeveloperRosterMember, RepositoryMapping } from "@/lib/types";
import type { SaveResult } from "@/lib/useHubData";
import { useHub } from "@/lib/hub/context";
import { PEOPLE, personByName } from "@/lib/people";
import { Sheet } from "@/components/ui/Dialog";
import { Combobox, ErrorSummary, Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/feedback";

const REPO_STATUSES: RepositoryMapping["status"][] = ["Active", "Maintenance", "Archived"];
const REPO_TYPES = ["Backend", "Web frontend", "Mobile app", "Infrastructure", "Library", "Website", "Other"];

/** Coral-soft banner shown when a save reached this device but not Google Sheets. */
function NotSavedBanner({ error, busy, onRetry }: { error: string; busy: boolean; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-[var(--radius-inset)] bg-coral-soft p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-coral text-white">
          <RefreshCw className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium text-ink">Not saved to Google Sheets</p>
          <p className="mt-0.5 text-[13px] text-ink-2">It is kept on this device for now. {error}</p>
        </div>
      </div>
      <button type="button" className="btn btn-ink btn-sm mt-4" disabled={busy} onClick={onRetry}>
        {busy ? "Trying again" : "Retry"}
      </button>
    </div>
  );
}

/** Runs a save, keeps the sheet open on ok:false, and lets Retry save the same record again. */
function useSaver<T extends { id: string }>(save: (row: Partial<T>, id?: string) => Promise<SaveResult<T>>, onDone: (r: T, created: boolean) => void) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<{ error: string; record: T } | null>(null);
  const run = async (row: Partial<T>, editingId?: string) => {
    setBusy(true);
    try {
      const res = await save(row, failed?.record.id ?? editingId);
      if (res.ok) {
        setFailed(null);
        onDone(res.record, !editingId && !failed);
      } else setFailed({ error: res.error, record: res.record });
    } catch (e) {
      setFailed((f) => (f ? { ...f, error: e instanceof Error ? e.message : "Something went wrong." } : f));
    } finally {
      setBusy(false);
    }
  };
  return { busy, failed, run };
}

/* ------------------------------------------------------------------ Roster member */

export function RosterMemberSheet({ member, onClose }: { member: DeveloperRosterMember | null; onClose: () => void }) {
  const { data } = useHub();
  const toast = useToast();
  const [name, setName] = useState(member?.developerName ?? "");
  const [role, setRole] = useState(member?.role ?? "");
  const [area, setArea] = useState(member?.primaryArea ?? "");
  const [active, setActive] = useState(member ? member.active === "Yes" : true);
  const [joining, setJoining] = useState(member?.joiningDate ?? "");
  const [notes, setNotes] = useState(member?.notes ?? "");
  const [submitted, setSubmitted] = useState(false);

  const names = useMemo(() => [...new Set([...PEOPLE.filter((p) => p.role === "member").map((p) => p.name), ...(name ? [name] : [])])], [name]);
  const saver = useSaver<DeveloperRosterMember>(
    (row, id) => data.saveRosterMember(row, id),
    (r, created) => {
      toast({ message: created ? `Added ${r.developerName} to the roster` : `Saved ${r.developerName}`, tone: "positive" });
      onClose();
    }
  );
  const selfId = member?.id ?? saver.failed?.record.id;
  const duplicate = data.roster.some((r) => r.id !== selfId && r.developerName.trim().toLowerCase() === name.trim().toLowerCase());

  const errors: Record<string, string> = {};
  if (submitted) {
    if (!name.trim()) errors["rm-name"] = "Choose or type a name.";
    else if (duplicate) errors["rm-name"] = `${name.trim()} is already on the roster.`;
    if (!role.trim()) errors["rm-role"] = "Add a role, for example Backend engineer.";
    if (joining && !/^\d{4}-\d{2}-\d{2}$/.test(joining)) errors["rm-joined"] = "Use a full date.";
  }
  const errorList = Object.entries(errors).map(([field, message]) => ({ field, message }));


  const submit = () => {
    setSubmitted(true);
    if (!name.trim() || duplicate || !role.trim() || (joining && !/^\d{4}-\d{2}-\d{2}$/.test(joining))) return;
    void saver.run(
      { developerName: name.trim(), role: role.trim(), primaryArea: area.trim(), active: active ? "Yes" : "No", joiningDate: joining, notes: notes.trim() },
      member?.id
    );
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={member ? `Edit ${member.developerName}` : "Add person"}
      description="Who is on the engineering team and what they work on."
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="roster-member-form" className="btn btn-ink" disabled={saver.busy}>
            {saver.busy ? "Saving" : member ? "Save" : "Add person"}
          </button>
        </>
      }
    >
      <form
        id="roster-member-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        {saver.failed && <NotSavedBanner error={saver.failed.error} busy={saver.busy} onRetry={submit} />}
        {errorList.length > 0 && <ErrorSummary errors={errorList} />}
        <Combobox<string>
          id="rm-name"
          label={
            <>
              Name <span aria-hidden className="text-negative">*</span>
            </>
          }
          items={names}
          value={name || null}
          onChange={(v) => {
            setName(v ?? "");
            const p = personByName(v);
            if (p && !role) setRole(p.title);
          }}
          onCreate={(t) => setName(t)}
          allowCustom
          getKey={(n) => n}
          getLabel={(n) => n}
          getDescription={(n) => personByName(n)?.title}
          placeholder="Choose a team member or type a name"
          error={errors["rm-name"]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role" htmlFor="rm-role" required error={errors["rm-role"]}>
            <Input id="rm-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Backend engineer" />
          </Field>
          <Field label="Primary area" htmlFor="rm-area">
            <Input id="rm-area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="APIs and DevOps" />
          </Field>
          <Field label="Joined" htmlFor="rm-joined" error={errors["rm-joined"]}>
            <Input id="rm-joined" type="date" value={joining} onChange={(e) => setJoining(e.target.value)} className="tabular-nums" />
          </Field>
          <div className="flex items-end pb-1.5">
            <Switch id="rm-active" checked={active} onChange={setActive} label="Active" description="Counts towards team capacity." />
          </div>
        </div>
        <Field label="Notes" htmlFor="rm-notes">
          <Textarea id="rm-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Working days, on-call, anything the team should know" />
        </Field>
      </form>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ Repository */

export function RepositorySheet({ repo, onClose }: { repo: RepositoryMapping | null; onClose: () => void }) {
  const { data } = useHub();
  const toast = useToast();
  const [project, setProject] = useState(repo?.projectName ?? "");
  const [name, setName] = useState(repo?.repository ?? "");
  const [type, setType] = useState(repo?.type ?? REPO_TYPES[0]);
  const [status, setStatus] = useState<RepositoryMapping["status"]>(repo?.status ?? "Active");
  const [description, setDescription] = useState(repo?.description ?? "");
  const [submitted, setSubmitted] = useState(false);

  const projects = useMemo(
    () =>
      [...new Set([...data.settings.projects, ...data.repositories.map((r) => r.projectName), ...data.projects.map((p) => p.projectName), ...(project ? [project] : [])].map((p) => (p ?? "").trim()).filter(Boolean))],
    [data.settings.projects, data.repositories, data.projects, project]
  );
  const types = [...new Set([...REPO_TYPES, ...(type ? [type] : [])])];
  const saver = useSaver<RepositoryMapping>(
    (row, id) => data.saveRepository(row, id),
    (r, created) => {
      toast({ message: created ? `Added ${r.repository}` : `Saved ${r.repository}`, tone: "positive" });
      onClose();
    }
  );
  const selfId = repo?.id ?? saver.failed?.record.id;
  const duplicate = data.repositories.some((r) => r.id !== selfId && r.repository.trim().toLowerCase() === name.trim().toLowerCase());
  const badName = !!name.trim() && /\s/.test(name.trim());

  const errors: Record<string, string> = {};
  if (submitted) {
    if (!project.trim()) errors["repo-project"] = "Choose or type a project.";
    if (!name.trim()) errors["repo-name"] = "Add the repository name.";
    else if (badName) errors["repo-name"] = "Repository names have no spaces.";
    else if (duplicate) errors["repo-name"] = `${name.trim()} is already listed.`;
  }
  const errorList = Object.entries(errors).map(([field, message]) => ({ field, message }));


  const submit = () => {
    setSubmitted(true);
    if (!project.trim() || !name.trim() || badName || duplicate) return;
    void saver.run({ projectName: project.trim(), repository: name.trim(), type, status, description: description.trim() }, repo?.id);
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={repo ? `Edit ${repo.repository}` : "Add repository"}
      description="Repositories appear in the work-log form under their project."
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="repo-form" className="btn btn-ink" disabled={saver.busy}>
            {saver.busy ? "Saving" : repo ? "Save" : "Add repository"}
          </button>
        </>
      }
    >
      <form
        id="repo-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        {saver.failed && <NotSavedBanner error={saver.failed.error} busy={saver.busy} onRetry={submit} />}
        {errorList.length > 0 && <ErrorSummary errors={errorList} />}
        <Combobox<string>
          id="repo-project"
          label={
            <>
              Project <span aria-hidden className="text-negative">*</span>
            </>
          }
          items={projects}
          value={project || null}
          onChange={(v) => setProject(v ?? "")}
          onCreate={(t) => setProject(t)}
          allowCustom
          getKey={(p) => p}
          getLabel={(p) => p}
          placeholder="Choose or type a project"
          error={errors["repo-project"]}
        />
        <Field label="Repository" htmlFor="repo-name" required error={errors["repo-name"]} hint="As it appears on GitHub, for example seekfactory-b.">
          <Input id="repo-name" value={name} onChange={(e) => setName(e.target.value)} className="font-mono" autoComplete="off" spellCheck={false} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type" htmlFor="repo-type">
            <Select id="repo-type" value={type} onChange={(e) => setType(e.target.value)}>
              {types.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="repo-status">
            <Select id="repo-status" value={status} onChange={(e) => setStatus(e.target.value as RepositoryMapping["status"])}>
              {REPO_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Description" htmlFor="repo-desc">
          <Textarea id="repo-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What lives in this repository" />
        </Field>
      </form>
    </Sheet>
  );
}
