"use client";

import React, { useState } from "react";
import { Timer } from "lucide-react";
import { CardHeader } from "@/components/ui/primitives";
import { ErrorSummary, Field, Input } from "@/components/ui/form";
import { ListEditor, SettingsFormFooter, sameJson, type SettingsFormProps } from "./CompanyProfileForm";

interface Draft {
  weeklyHoursTarget: string;
  projects: string[];
  workTypes: string[];
}

export function WorkSettings({ settings, onSave, onDirtyChange, saving }: SettingsFormProps) {
  const [baseline, setBaseline] = useState<Draft>(() => ({
    weeklyHoursTarget: String(settings.weeklyHoursTarget),
    projects: [...settings.projects],
    workTypes: [...settings.workTypes],
  }));
  const [draft, setDraft] = useState<Draft>(baseline);
  const [submitted, setSubmitted] = useState(false);
  const dirty = !sameJson(draft, baseline);

  const update = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onDirtyChange(!sameJson(next, baseline));
  };

  const hours = Number(draft.weeklyHoursTarget);
  const errors: { field: string; message: string }[] = [];
  if (draft.weeklyHoursTarget.trim() === "" || !Number.isFinite(hours) || hours < 1 || hours > 168) {
    errors.push({ field: "wk-hours", message: "Weekly hours must be between 1 and 168" });
  }
  if (draft.projects.length === 0) errors.push({ field: "wk-projects", message: "Keep at least one project" });
  if (draft.workTypes.length === 0) errors.push({ field: "wk-types", message: "Keep at least one work type" });
  const hoursError = submitted ? errors.find((e) => e.field === "wk-hours")?.message : undefined;

  return (
    <form
      noValidate
      className="card min-w-0 p-5 sm:p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setSubmitted(true);
        if (errors.length) return;
        const ok = await onSave({ weeklyHoursTarget: hours, projects: draft.projects, workTypes: draft.workTypes });
        if (ok) {
          setBaseline(draft);
          setSubmitted(false);
          onDirtyChange(false);
        }
      }}
    >
      <CardHeader icon={<Timer />} title="Work" subtitle="Targets and the choices in the work log form" />
      {submitted && errors.length > 0 && (
        <div className="mt-5">
          <ErrorSummary errors={errors} />
        </div>
      )}
      <div className="mt-6 grid gap-5">
        <Field
          label="Weekly hours target"
          htmlFor="wk-hours"
          error={hoursError}
          hint={hoursError ? undefined : `About ${Number.isFinite(hours) && hours > 0 ? Math.round((hours / 6) * 10) / 10 : 0} hours a day over a six-day week.`}
        >
          <span className="relative block max-w-[200px]">
            <Input
              id="wk-hours"
              type="number"
              inputMode="decimal"
              min={1}
              max={168}
              step={0.5}
              value={draft.weeklyHoursTarget}
              onChange={(e) => update({ weeklyHoursTarget: e.target.value })}
              className="pr-14 tabular-nums"
            />
            <span aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-ink-3">
              hours
            </span>
          </span>
        </Field>
        <div id="wk-projects">
          <ListEditor
            label="Projects"
            items={draft.projects}
            onChange={(projects) => update({ projects })}
            addLabel="Add a project"
            placeholder="For example, Client Accounts"
            hint="Offered in the work log form. Logs already saved keep their project."
          />
        </div>
        <div id="wk-types">
          <ListEditor
            label="Work types"
            items={draft.workTypes}
            onChange={(workTypes) => update({ workTypes })}
            addLabel="Add a work type"
            placeholder="For example, Code Review"
          />
        </div>
      </div>
      <SettingsFormFooter
        dirty={dirty}
        saving={saving}
        onReset={() => {
          setDraft(baseline);
          setSubmitted(false);
          onDirtyChange(false);
        }}
      />
    </form>
  );
}
