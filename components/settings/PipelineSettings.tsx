"use client";

import React, { useState } from "react";
import { GitPullRequestArrow, RotateCcw } from "lucide-react";
import { DEFAULT_STAGE_PROBABILITIES, type MetaLeadAssignment } from "@/lib/settings";
import { STAGE_ORDER } from "@/lib/analytics";
import { MARKETING_NAMES } from "@/lib/people";
import type { LeadStageStatus } from "@/lib/types";
import { CardHeader } from "@/components/ui/primitives";
import { ErrorSummary, Field, Input, Select } from "@/components/ui/form";
import { StatusDot, toneForStage } from "@/components/ui/Status";
import { ListEditor, SettingsFormFooter, sameJson, type SettingsFormProps } from "./CompanyProfileForm";

interface Draft {
  probs: Record<LeadStageStatus, string>;
  leadSources: string[];
  followUpDefaultDays: string;
  meta: MetaLeadAssignment;
}

function toPercent(p: Record<LeadStageStatus, number>): Record<LeadStageStatus, string> {
  const out = {} as Record<LeadStageStatus, string>;
  for (const s of STAGE_ORDER) out[s] = String(Math.round((p[s] ?? 0) * 100));
  return out;
}

function percentError(v: string): string | undefined {
  if (v.trim() === "") return "Enter a percentage";
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) return "Use a number from 0 to 100";
  return undefined;
}

export function PipelineSettings({ settings, onSave, onDirtyChange, saving }: SettingsFormProps) {
  const initial = (): Draft => ({
    probs: toPercent(settings.stageProbabilities),
    leadSources: [...settings.leadSources],
    followUpDefaultDays: String(settings.followUpDefaultDays),
    meta: { ...settings.metaLeadAssignment },
  });
  const [baseline, setBaseline] = useState<Draft>(initial);
  const [draft, setDraft] = useState<Draft>(baseline);
  const [submitted, setSubmitted] = useState(false);
  const dirty = !sameJson(draft, baseline);

  const update = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onDirtyChange(!sameJson(next, baseline));
  };

  const errors: { field: string; message: string }[] = [];
  for (const s of STAGE_ORDER) {
    const err = percentError(draft.probs[s]);
    if (err) errors.push({ field: `prob-${s.replace(/\s+/g, "-")}`, message: `${s}: ${err.toLowerCase()}` });
  }
  const days = Number(draft.followUpDefaultDays);
  if (draft.followUpDefaultDays.trim() === "" || !Number.isInteger(days) || days < 0 || days > 365) {
    errors.push({ field: "pl-followup", message: "Follow-up days must be a whole number from 0 to 365" });
  }
  if (draft.leadSources.length === 0) errors.push({ field: "pl-sources", message: "Keep at least one lead source" });
  if (draft.meta.mode === "rep" && !draft.meta.rep) errors.push({ field: "pl-rep", message: "Pick who gets new Meta leads" });

  const isDefault = STAGE_ORDER.every((s) => Number(draft.probs[s]) === Math.round(DEFAULT_STAGE_PROBABILITIES[s] * 100));

  return (
    <form
      noValidate
      className="card min-w-0 p-5 sm:p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setSubmitted(true);
        if (errors.length) return;
        const stageProbabilities = {} as Record<LeadStageStatus, number>;
        for (const s of STAGE_ORDER) stageProbabilities[s] = Number(draft.probs[s]) / 100;
        const meta: MetaLeadAssignment = draft.meta.mode === "rep" ? { mode: "rep", rep: draft.meta.rep } : { mode: draft.meta.mode };
        const ok = await onSave({
          stageProbabilities,
          leadSources: draft.leadSources,
          followUpDefaultDays: days,
          metaLeadAssignment: meta,
        });
        if (ok) {
          const next = { ...draft, meta };
          setBaseline(next);
          setDraft(next);
          setSubmitted(false);
          onDirtyChange(false);
        }
      }}
    >
      <CardHeader icon={<GitPullRequestArrow />} title="Pipeline" subtitle="How deals are weighted, where leads come from, and who gets Meta leads" />

      {submitted && errors.length > 0 && (
        <div className="mt-5">
          <ErrorSummary errors={errors} />
        </div>
      )}

      {/* Stage probabilities */}
      <section className="mt-6" aria-labelledby="pl-probs">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h4 id="pl-probs" className="text-[14px] font-medium text-ink">
              Stage probabilities
            </h4>
            <p className="mt-0.5 text-[12.5px] text-ink-3">Weighted pipeline = deal value × the chance for its stage.</p>
          </div>
          <button
            type="button"
            className="btn btn-plain btn-sm"
            disabled={isDefault}
            onClick={() => update({ probs: toPercent(DEFAULT_STAGE_PROBABILITIES) })}
          >
            <RotateCcw aria-hidden /> Reset to defaults
          </button>
        </div>
        <div className="mt-3 overflow-hidden rounded-[20px] bg-surface-2">
          <table className="w-full text-[13px]">
            <caption className="sr-only">Chance of closing for each stage, in percent</caption>
            <thead>
              <tr className="text-left text-[12px] text-ink-3">
                <th scope="col" className="px-4 pb-1 pt-3 font-medium">
                  Stage
                </th>
                <th scope="col" className="hidden px-4 pb-1 pt-3 font-medium sm:table-cell">
                  <span className="sr-only">Bar</span>
                </th>
                <th scope="col" className="w-[120px] px-4 pb-1 pt-3 text-right font-medium">
                  Chance
                </th>
              </tr>
            </thead>
            <tbody>
              {STAGE_ORDER.map((s) => {
                const id = `prob-${s.replace(/\s+/g, "-")}`;
                const err = submitted ? percentError(draft.probs[s]) : undefined;
                const n = Math.max(0, Math.min(100, Number(draft.probs[s]) || 0));
                return (
                  <tr key={s} className="border-t border-line first:border-t-0">
                    <th scope="row" className="px-4 py-2 text-left font-normal">
                      <label htmlFor={id}>
                        <StatusDot tone={toneForStage(s)} label={s} />
                      </label>
                    </th>
                    <td className="hidden w-[40%] px-4 py-2 sm:table-cell">
                      <span aria-hidden className="block h-2.5 w-full overflow-hidden rounded-full bg-surface">
                        <span className="block h-full rounded-full bg-accent transition-[width] duration-300 ease-brand" style={{ width: `${n}%` }} />
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="relative ml-auto block w-[96px]">
                        <input
                          id={id}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={100}
                          step={1}
                          value={draft.probs[s]}
                          aria-invalid={err ? true : undefined}
                          onChange={(e) => update({ probs: { ...draft.probs, [s]: e.target.value } })}
                          className="field field-sm bg-surface pr-8 text-right tabular-nums"
                        />
                        <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-3">
                          %
                        </span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div id="pl-sources">
          <ListEditor
            label="Lead sources"
            items={draft.leadSources}
            onChange={(leadSources) => update({ leadSources })}
            addLabel="Add a lead source"
            placeholder="For example, Partner agency"
            hint="Shown in the deal form. Existing deals keep their source."
          />
        </div>
        <Field label="Default follow-up" htmlFor="pl-followup" hint="Days after a visit or a new lead before the next follow-up is due.">
          <span className="relative block max-w-[200px]">
            <Input
              id="pl-followup"
              type="number"
              inputMode="numeric"
              min={0}
              max={365}
              value={draft.followUpDefaultDays}
              onChange={(e) => update({ followUpDefaultDays: e.target.value })}
              className="pr-14 tabular-nums"
            />
            <span aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-ink-3">
              days
            </span>
          </span>
        </Field>
      </div>

      {/* Meta lead assignment */}
      <fieldset className="mt-6 rounded-[20px] p-4 shadow-[inset_0_0_0_1px_var(--color-line)] sm:p-5">
        <legend className="sr-only">New Meta leads</legend>
        <p aria-hidden className="text-[14px] font-medium text-ink">
          New Meta leads
        </p>
        <p className="mt-0.5 text-[12.5px] text-ink-3">Who a lead from a Meta form is assigned to when it arrives.</p>
        <div className="mt-3 space-y-2.5">
          {(
            [
              { mode: "admin", label: "The administrator assigns each lead", hint: "Leads wait unassigned and show in Needs attention." },
              { mode: "rep", label: "Always assign to", hint: null },
              { mode: "alternate", label: "Alternate between the marketing team", hint: MARKETING_NAMES.join(" and ") },
            ] as const
          ).map((o) => (
            <div key={o.mode} className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <label className="flex cursor-pointer items-start gap-2.5 text-[14px] text-ink">
                <input
                  type="radio"
                  name="meta-assign"
                  value={o.mode}
                  checked={draft.meta.mode === o.mode}
                  onChange={() => update({ meta: { mode: o.mode, rep: o.mode === "rep" ? draft.meta.rep ?? MARKETING_NAMES[0] : draft.meta.rep } })}
                  className="mt-0.5 size-[18px] shrink-0 cursor-pointer accent-accent"
                />
                <span>
                  {o.label}
                  {o.hint && <span className="block text-[12px] text-ink-3">{o.hint}</span>}
                </span>
              </label>
              {o.mode === "rep" && (
                <span className="w-[180px]">
                  <label htmlFor="pl-rep" className="sr-only">
                    Marketing person for new Meta leads
                  </label>
                  <Select
                    id="pl-rep"
                    fieldSize="sm"
                    value={draft.meta.rep ?? ""}
                    disabled={draft.meta.mode !== "rep"}
                    onChange={(e) => update({ meta: { mode: "rep", rep: e.target.value } })}
                  >
                    {!draft.meta.rep && <option value="">Choose a person</option>}
                    {MARKETING_NAMES.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </Select>
                </span>
              )}
            </div>
          ))}
        </div>
      </fieldset>

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
