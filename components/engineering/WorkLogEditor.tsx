"use client";

import React, { useMemo, useRef, useState } from "react";
import { Lock } from "lucide-react";
import type { DailyWorkLogEntry, DeploymentEnv, PriorityLevel, ProductionImpactLevel, WorkStatus } from "@/lib/types";
import type { Overlay } from "@/lib/views";
import { useHub } from "@/lib/hub/context";
import { can } from "@/lib/hub/permissions";
import { DEVELOPER_NAMES, FOUNDER_NAMES } from "@/lib/people";
import { formatDateIST, todayKeyIST } from "@/lib/format";
import { Sheet } from "@/components/ui/Dialog";
import { Combobox, ErrorSummary, Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { Segmented } from "@/components/ui/primitives";
import { useConfirm, useToast } from "@/components/ui/feedback";

const STATUSES: WorkStatus[] = ["In Progress", "Completed", "Blocked"];
const PRIORITIES: PriorityLevel[] = ["Critical", "High", "Medium", "Low"];
const DEPLOYMENTS: DeploymentEnv[] = ["Development", "Staging", "Production", "Not Applicable"];
const IMPACTS: ProductionImpactLevel[] = ["None", "Low", "Medium", "High"];
const NOT_APPLICABLE = "Not applicable";
const ANYONE = "all";

interface FormState {
  date: string;
  developerName: string;
  project: string;
  repository: string;
  module: string;
  workType: string;
  taskDescription: string;
  githubPr: string;
  workStatus: WorkStatus;
  priority: PriorityLevel;
  hours: string;
  isBlocked: boolean;
  blockerDetails: string;
  reviewRequired: boolean;
  reviewer: string;
  deployment: DeploymentEnv;
  productionImpact: ProductionImpactLevel;
  notes: string;
}

type FieldKey = keyof FormState;

const ID: Record<FieldKey, string> = {
  date: "wl-date",
  developerName: "wl-person",
  project: "wl-project",
  repository: "wl-repo",
  module: "wl-module",
  workType: "wl-type",
  taskDescription: "wl-task",
  githubPr: "wl-pr",
  workStatus: "wl-status",
  priority: "wl-priority",
  hours: "wl-hours",
  isBlocked: "wl-blocked",
  blockerDetails: "wl-blocker",
  reviewRequired: "wl-review",
  reviewer: "wl-reviewer",
  deployment: "wl-deploy",
  productionImpact: "wl-impact",
  notes: "wl-notes",
};

function validate(f: FormState, keepHours = false): Partial<Record<FieldKey, string>> {
  const e: Partial<Record<FieldKey, string>> = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) e.date = "Choose the date of the work.";
  if (!f.developerName.trim()) e.developerName = "Choose who did the work.";
  if (!f.project.trim()) e.project = "Choose or type a project.";
  if (!f.module.trim()) e.module = "Name the module or feature area.";
  if (!f.taskDescription.trim()) e.taskDescription = "Describe what was done.";
  const h = Number(f.hours);
  if (keepHours) {
    // Stored (legacy) hours left untouched: do not re-validate them.
  } else if (f.hours.trim() === "" || !Number.isFinite(h)) e.hours = "Enter the hours, for example 3.5.";
  else if (h < 0.25 || h > 16) e.hours = "Hours must be between 0.25 and 16.";
  else if (Math.abs(h * 4 - Math.round(h * 4)) > 1e-9) e.hours = "Use quarter hours, for example 1.25 or 2.5.";
  const pr = f.githubPr.trim();
  if (pr && !/^https?:\/\/\S+$/i.test(pr) && !/^#?\d+$/.test(pr)) e.githubPr = "Paste the pull request link (https://…) or a PR number like #138.";
  if (f.isBlocked && !f.blockerDetails.trim()) e.blockerDetails = "Say what is blocking the work and who can unblock it.";
  if (f.reviewRequired && (!f.reviewer.trim() || f.reviewer === "-")) e.reviewer = "Choose a reviewer.";
  return e;
}

const ORDER: FieldKey[] = ["date", "developerName", "project", "repository", "module", "workType", "taskDescription", "githubPr", "workStatus", "priority", "hours", "blockerDetails", "reviewer", "deployment", "productionImpact", "notes"];

/** Side sheet for logging or editing one work-log entry. */
export function WorkLogEditor({ overlay, onClose }: { overlay: Extract<Overlay, { kind: "worklog" }>; onClose: () => void }) {
  const { data, viewer } = useHub();
  const toast = useToast();
  const entry = overlay.entry ?? null;
  const prefill = overlay.prefill ?? {};
  const editing = !!entry;
  const moduleRef = useRef<HTMLInputElement>(null);

  const lockedPerson = !viewer.privileged;
  const readOnly = editing && !can(viewer, "worklog.edit", { data, record: entry });

  const repoNames = useMemo(() => [...new Set(data.repositories.map((r) => r.repository).filter(Boolean))], [data.repositories]);
  const reposFor = (project: string) => data.repositories.filter((r) => r.projectName === project).map((r) => r.repository);

  const fresh = (keep?: Partial<FormState>): FormState => {
    const src: Partial<DailyWorkLogEntry> = entry ?? prefill;
    const project = keep?.project ?? src.project ?? data.settings.projects[0] ?? "";
    const firstRepo = reposFor(project)[0];
    const workTypes = data.settings.workTypes;
    return {
      date: keep?.date ?? src.date ?? todayKeyIST(),
      developerName: keep?.developerName ?? (lockedPerson ? viewer.name : src.developerName ?? viewer.person?.name ?? ""),
      project,
      repository: keep?.repository ?? src.repository ?? firstRepo ?? NOT_APPLICABLE,
      module: src.module ?? "",
      workType: src.workType ?? (workTypes.includes("New Feature") ? "New Feature" : workTypes[0] ?? ""),
      taskDescription: src.taskDescription ?? "",
      githubPr: src.githubPr ?? "",
      workStatus: src.workStatus ?? "In Progress",
      priority: src.priority ?? "Medium",
      hours: src.hours !== undefined && src.hours !== null && String(src.hours) !== "" ? String(src.hours) : "",
      isBlocked: src.isBlocked === "Yes" || src.workStatus === "Blocked",
      blockerDetails: src.blockerDetails ?? "",
      reviewRequired: src.reviewRequired === "Yes",
      reviewer: src.reviewer && src.reviewer !== "-" ? src.reviewer : "",
      deployment: src.deployment ?? "Development",
      productionImpact: src.productionImpact ?? "None",
      notes: src.notes ?? "",
    };
  };

  const [form, setForm] = useState<FormState>(() => fresh());
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initial, setInitial] = useState<string>(() => JSON.stringify(form));
  const keepHours = editing && form.hours === fresh().hours;
  const dirty = JSON.stringify(form) !== initial;
  const confirm = useConfirm();
  const requestClose = async () => {
    if (dirty && !readOnly && !saving) {
      const ok = await confirm({ title: "Discard your changes?", body: "What you typed in this entry will be lost.", confirmLabel: "Discard changes", cancelLabel: "Keep editing", tone: "danger" });
      if (!ok) return;
    }
    onClose();
  };
  const errors = submitted ? validate(form, keepHours) : {};
  const errorList = ORDER.filter((k) => errors[k]).map((k) => ({ field: ID[k], message: errors[k]! }));

  const set = <K extends FieldKey>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  // People: founders and developers, active roster names, and whatever an older entry already holds.
  const people = useMemo(() => {
    const list = [...FOUNDER_NAMES, ...DEVELOPER_NAMES, ...data.roster.filter((r) => r.active === "Yes").map((r) => r.developerName)];
    if (entry?.developerName) list.push(entry.developerName);
    if (lockedPerson) list.push(viewer.name);
    return [...new Set(list.filter((n) => n && n !== "Intern"))].concat(entry?.developerName === "Intern" ? ["Intern"] : []);
  }, [data.roster, entry, lockedPerson, viewer.name]);

  const projects = useMemo(() => {
    const all = [
      ...data.settings.projects,
      ...data.repositories.map((r) => r.projectName),
      ...data.projects.map((p) => p.projectName),
      form.project,
    ];
    return [...new Set(all.map((p) => (p ?? "").trim()).filter(Boolean))];
  }, [data.settings.projects, data.repositories, data.projects, form.project]);

  const workTypes = useMemo(() => [...new Set([...data.settings.workTypes, form.workType].filter(Boolean))], [data.settings.workTypes, form.workType]);
  const ownRepos = reposFor(form.project);
  const repoOptions = {
    own: ownRepos,
    rest: [
      ...repoNames.filter((r) => !ownRepos.includes(r)),
      ...(form.repository && form.repository !== NOT_APPLICABLE && !repoNames.includes(form.repository) ? [form.repository] : []),
    ],
  };
  const reviewers = [...new Set([...people.filter((p) => p !== form.developerName), ...(form.reviewer && form.reviewer !== ANYONE ? [form.reviewer] : [])])];

  const pickProject = (p: string) =>
    setForm((f) => {
      const own = data.repositories.filter((r) => r.projectName === p).map((r) => r.repository);
      return { ...f, project: p, repository: own.length && !own.includes(f.repository) ? own[0] : f.repository };
    });

  const setStatus = (s: WorkStatus) => setForm((f) => ({ ...f, workStatus: s, isBlocked: s === "Blocked" ? true : s === "Completed" ? false : f.isBlocked }));
  const setBlocked = (b: boolean) =>
    setForm((f) => ({ ...f, isBlocked: b, workStatus: b ? "Blocked" : f.workStatus === "Blocked" ? "In Progress" : f.workStatus }));

  const payload = (f: FormState): Partial<DailyWorkLogEntry> => ({
    date: f.date,
    developerName: f.developerName.trim(),
    project: f.project.trim(),
    repository: f.repository === NOT_APPLICABLE ? "" : f.repository,
    module: f.module.trim(),
    workType: f.workType,
    taskDescription: f.taskDescription.trim(),
    githubPr: f.githubPr.trim(),
    workStatus: f.isBlocked ? "Blocked" : f.workStatus,
    priority: f.priority,
    hours: keepHours && entry ? entry.hours : Math.round(Number(f.hours) * 100) / 100,
    isBlocked: f.isBlocked ? "Yes" : "No",
    blockerDetails: f.blockerDetails.trim(),
    reviewRequired: f.reviewRequired ? "Yes" : "No",
    reviewer: f.reviewRequired ? f.reviewer : "-",
    deployment: f.deployment,
    productionImpact: f.productionImpact,
    notes: f.notes.trim(),
  });

  const save = async (another: boolean) => {
    if (readOnly || saving) return;
    setSubmitted(true);
    const errs = validate(form, keepHours);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const res = await data.saveWorkLog(payload(form), entry?.id);
      if (!res.ok) {
        toast({ message: res.error || "Couldn't save the entry. Try again.", tone: "negative" });
        return;
      }
      toast({ message: editing ? "Entry updated" : "Work logged", tone: "positive" });
      if (another && !editing) {
        const next = fresh({ date: form.date, developerName: form.developerName, project: form.project, repository: form.repository });
        setInitial(JSON.stringify(next));
        setForm(next);
        setSubmitted(false);
        requestAnimationFrame(() => moduleRef.current?.focus());
      } else {
        onClose();
      }
    } catch {
      toast({ message: "Couldn't save the entry. Try again.", tone: "negative" });
    } finally {
      setSaving(false);
    }
  };

  const title = readOnly ? "Work log entry" : editing ? "Edit work log entry" : "Log work";
  const description = entry
    ? `${entry.developerName}, ${formatDateIST(entry.date, { weekday: true, year: true })}`
    : "What you worked on, how long it took and anything in the way.";

  const heading = (t: string) => <h3 className="text-[13px] font-medium text-ink">{t}</h3>;

  return (
    <Sheet
      open
      onClose={() => void requestClose()}
      width="lg"
      title={title}
      description={description}
      footer={
        readOnly ? (
          <button type="button" className="btn btn-ink" onClick={onClose}>
            Close
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => void requestClose()}>
              Cancel
            </button>
            {!editing && (
              <button type="button" className="btn btn-lime" disabled={saving} onClick={() => void save(true)}>
                Save and log another
              </button>
            )}
            <button type="submit" form="worklog-form" className="btn btn-ink" disabled={saving}>
              {saving ? "Saving" : "Save"}
            </button>
          </>
        )
      }
    >
      <form
        id="worklog-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save(false);
        }}
        className="space-y-6"
      >
        {readOnly && (
          <div className="flex items-start gap-3 rounded-[var(--radius-inset)] bg-amber-soft p-4">
            <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber text-ink">
              <Lock className="h-4 w-4" />
            </span>
            <p className="min-w-0 text-[13.5px] text-ink">
              {data.source === "sheet"
                ? "Entries saved to Google Sheets can only be changed by the administrator."
                : "Only the person who logged this entry can change it."}
            </p>
          </div>
        )}
        {errorList.length > 0 && <ErrorSummary errors={errorList} />}

        <fieldset disabled={readOnly || saving} className="m-0 min-w-0 space-y-6 border-0 p-0">
          <div className="space-y-4">
            {heading("Work")}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date" htmlFor={ID.date} required error={errors.date}>
                <Input id={ID.date} type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className="tabular-nums" />
              </Field>
              <Field label="Person" htmlFor={ID.developerName} required error={errors.developerName} hint={lockedPerson ? "Entries are logged under your name." : undefined}>
                <Select id={ID.developerName} value={form.developerName} disabled={lockedPerson} onChange={(e) => set("developerName", e.target.value)}>
                  {!form.developerName && (
                    <option value="" disabled>
                      Choose a person
                    </option>
                  )}
                  {people.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </Field>
              <Combobox<string>
                id={ID.project}
                label={
                  <>
                    Project <span aria-hidden className="text-negative">*</span>
                  </>
                }
                items={projects}
                value={form.project || null}
                onChange={(v) => (v ? pickProject(v) : set("project", ""))}
                getKey={(p) => p}
                getLabel={(p) => p}
                placeholder="Choose or type a project"
                allowCustom
                onCreate={(t) => pickProject(t)}
                error={errors.project}
              />
              <Field label="Repository" htmlFor={ID.repository}>
                <Select id={ID.repository} value={form.repository || NOT_APPLICABLE} onChange={(e) => set("repository", e.target.value)} className="font-mono">
                  {repoOptions.own.length > 0 && (
                    <optgroup label={form.project}>
                      {repoOptions.own.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {repoOptions.rest.length > 0 && (
                    <optgroup label={repoOptions.own.length ? "Other repositories" : "Repositories"}>
                      {repoOptions.rest.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value={NOT_APPLICABLE}>{NOT_APPLICABLE}</option>
                </Select>
              </Field>
              <Field label="Module or feature area" htmlFor={ID.module} required error={errors.module}>
                <Input ref={moduleRef} id={ID.module} value={form.module} onChange={(e) => set("module", e.target.value)} placeholder="Payments service" autoComplete="off" />
              </Field>
              <Field label="Work type" htmlFor={ID.workType}>
                <Select id={ID.workType} value={form.workType} onChange={(e) => set("workType", e.target.value)}>
                  {workTypes.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="What did you do?" htmlFor={ID.taskDescription} required error={errors.taskDescription} className="sm:col-span-2">
                <Textarea
                  id={ID.taskDescription}
                  rows={3}
                  value={form.taskDescription}
                  onChange={(e) => set("taskDescription", e.target.value)}
                  placeholder="Added retries to the invoice sync job and fixed the duplicate rows."
                />
              </Field>
              <Field label="Pull request" htmlFor={ID.githubPr} error={errors.githubPr} hint="Link or number, if there is one." className="sm:col-span-2">
                <Input id={ID.githubPr} inputMode="url" value={form.githubPr} onChange={(e) => set("githubPr", e.target.value)} placeholder="https://github.com/axoraa/repo/pull/138" className="font-mono" autoComplete="off" />
              </Field>
            </div>
          </div>

          <div className="space-y-4 border-t border-line pt-6">
            {heading("Status")}
            <div>
              <span aria-hidden className="mb-1.5 block text-[12px] font-medium text-ink-2">
                Work status
              </span>
              <Segmented<WorkStatus>
                label="Work status"
                value={form.isBlocked ? "Blocked" : form.workStatus}
                onChange={setStatus}
                options={STATUSES.map((s) => ({ value: s, label: s }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Priority" htmlFor={ID.priority}>
                <Select id={ID.priority} value={form.priority} onChange={(e) => set("priority", e.target.value as PriorityLevel)}>
                  {PRIORITIES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Hours" htmlFor={ID.hours} required error={errors.hours} hint="0.25 to 16, in quarter hours.">
                <Input
                  id={ID.hours}
                  type="number"
                  inputMode="decimal"
                  min={0.25}
                  max={16}
                  step={0.25}
                  value={form.hours}
                  onChange={(e) => set("hours", e.target.value)}
                  placeholder="3.5"
                  className="tabular-nums"
                />
              </Field>
            </div>
            <div className={`card-inset space-y-3 p-4 ${form.isBlocked ? "bg-coral-soft!" : ""}`}>
              <Switch id={ID.isBlocked} checked={form.isBlocked} onChange={setBlocked} label="Blocked on this task" description="The team sees it on the Blockers list until it is resolved." />
              {form.isBlocked && (
                <Field label="What is blocking you?" htmlFor={ID.blockerDetails} required error={errors.blockerDetails}>
                  <Input
                    id={ID.blockerDetails}
                    value={form.blockerDetails}
                    onChange={(e) => set("blockerDetails", e.target.value)}
                    placeholder="Waiting for the payment gateway test keys from the client"
                  />
                </Field>
              )}
            </div>
          </div>

          <div className="space-y-4 border-t border-line pt-6">
            {heading("Review and release")}
            <div className="card-inset space-y-3 p-4">
              <Switch
                id={ID.reviewRequired}
                checked={form.reviewRequired}
                onChange={(v) => set("reviewRequired", v)}
                label="Needs a review"
                description="The reviewer sees it in their Today list."
              />
              {form.reviewRequired && (
                <Field label="Reviewer" htmlFor={ID.reviewer} required error={errors.reviewer}>
                  <Select id={ID.reviewer} value={form.reviewer} onChange={(e) => set("reviewer", e.target.value)}>
                    <option value="" disabled>
                      Choose a reviewer
                    </option>
                    {reviewers.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                    <option value={ANYONE}>Anyone on the team</option>
                  </Select>
                </Field>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Deployment" htmlFor={ID.deployment}>
                <Select id={ID.deployment} value={form.deployment} onChange={(e) => set("deployment", e.target.value as DeploymentEnv)}>
                  {DEPLOYMENTS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Production impact" htmlFor={ID.productionImpact}>
                <Select id={ID.productionImpact} value={form.productionImpact} onChange={(e) => set("productionImpact", e.target.value as ProductionImpactLevel)}>
                  {IMPACTS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Notes" htmlFor={ID.notes} className="sm:col-span-2">
                <Textarea id={ID.notes} rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Ticket links, deployment notes, anything the reviewer should know" />
              </Field>
            </div>
          </div>
        </fieldset>
      </form>
    </Sheet>
  );
}
