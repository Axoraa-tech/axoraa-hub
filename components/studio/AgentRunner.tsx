"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Globe, History, RefreshCw, RotateCcw, Save, Square } from "lucide-react";
import { AGENT_BY_KEY } from "@/lib/agents/catalog";
import { runAgentStream } from "@/lib/agents/client";
import {
  REVISE_INSTRUCTION_MAX,
  type AgentErrorCode,
  type AgentKey,
  type AgentLanguage,
  type AgentOutput,
  type AgentRef,
  type AgentRunEvent,
  type AgentRunRequest,
  type AgentUsage,
} from "@/lib/agents/types";
import { nowISO, relativeTime } from "@/lib/format";
import { useHub } from "@/lib/hub/context";
import { useNow } from "@/lib/prefs";
import type { AgentDraft } from "@/lib/types";
import { useToast } from "@/components/ui/feedback";
import { Field, Textarea } from "@/components/ui/form";
import { AgentOutputView } from "./AgentOutputView";
import { Markdown } from "./Markdown";

/* ------------------------------------------------------------------ copy */

export const LANGUAGE_LABEL: Record<AgentLanguage, string> = { en: "English", kn: "Kannada", hi: "Hindi" };

const ERROR_COPY: Record<AgentErrorCode, { title: string; retry: boolean }> = {
  not_configured: { title: "The assistant isn't set up on the server yet.", retry: false },
  unauthorized: { title: "Your session has ended. Sign in again to use the assistant.", retry: false },
  forbidden: { title: "You don't have access to this.", retry: false },
  disabled: { title: "This task is switched off in Settings.", retry: false },
  bad_input: { title: "Some of the input needs fixing.", retry: true },
  not_found: { title: "That record no longer exists.", retry: false },
  rate_limited: { title: "You've used the assistant a lot this hour.", retry: true },
  refused: { title: "The assistant declined this one.", retry: true },
  timeout: { title: "The assistant took too long.", retry: true },
  upstream: { title: "Something went wrong on the assistant's side.", retry: true },
};

/* ------------------------------------------------------------------ run state */

export interface RunMeta {
  title: string;
  input: Record<string, unknown>;
  language: AgentLanguage;
  ref?: AgentRef;
}

type Line = { id: number; kind: "status" | "search"; text: string };
type Versions = NonNullable<AgentDraft["versions"]>;

export interface AgentRunState {
  phase: "idle" | "running" | "done" | "error";
  /** A revision is streaming over an existing result. */
  revising: boolean;
  lines: Line[];
  thinking: string[];
  text: string;
  startedAt: number;
  output?: AgentOutput;
  dirty: boolean;
  draftId?: string;
  versions: Versions;
  model?: string;
  usage?: AgentUsage;
  error?: { code: AgentErrorCode; message: string };
  stopped: boolean;
  meta?: RunMeta;
}

const IDLE: AgentRunState = { phase: "idle", revising: false, lines: [], thinking: [], text: "", startedAt: 0, dirty: false, versions: [], stopped: false };

export interface AgentRun {
  key: AgentKey;
  state: AgentRunState;
  running: boolean;
  start(body: AgentRunRequest, meta: RunMeta): void;
  revise(instruction: string): void;
  stop(): void;
  retry(): void;
  edit(o: AgentOutput): void;
  saveEdits(): Promise<void>;
  saveDraftAgain(): Promise<void>;
  restore(index: number): Promise<void>;
  reset(): void;
}

/** One agent run: streaming, auto-save to drafts with Undo, revisions with versions. */
export function useAgentRun(key: AgentKey): AgentRun {
  const { data, viewer } = useHub();
  const toast = useToast();
  const [state, setState] = useState<AgentRunState>(IDLE);
  const abortRef = useRef<AbortController | null>(null);
  const bodyRef = useRef<AgentRunRequest | null>(null);
  const lineId = useRef(0);
  const entry = AGENT_BY_KEY[key];

  useEffect(() => () => abortRef.current?.abort(), []);

  const saveNew = async (output: AgentOutput, meta: RunMeta, model: string, usage: AgentUsage | undefined, versions: Versions = []) => {
    const res = await data.saveDraft({
      agentKey: key,
      title: meta.title,
      status: "draft",
      input: meta.input,
      output,
      language: meta.language,
      ref: meta.ref,
      model,
      usage,
      versions,
      createdBy: viewer.accountId,
      createdByName: viewer.name,
    });
    const id = res.record.id;
    setState((s) => ({ ...s, draftId: id }));
    if (!data.sharedMode) {
      data.logActivity({ action: "agent.run", entity: "drafts", entityId: id, summary: `Ran ${entry.name}: ${meta.title}` });
    }
    toast({
      message: res.ok ? "Draft saved" : "Draft saved on this device. Not saved to Google Sheets yet.",
      tone: res.ok ? "neutral" : "negative",
      action: {
        label: "Undo",
        onClick: () => {
          void data.deleteDraft(id);
          setState((s) => (s.draftId === id ? { ...s, draftId: undefined } : s));
        },
      },
    });
  };

  const stream = (body: AgentRunRequest, meta: RunMeta, revision?: { instruction: string; previous: AgentOutput; draftId?: string; versions: Versions }) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    bodyRef.current = body;
    const startedAt = Date.now();
    setState((s) =>
      revision
        ? { ...s, phase: "running", revising: true, lines: [], thinking: [], text: "", startedAt, error: undefined, stopped: false }
        : { ...IDLE, phase: "running", startedAt, meta }
    );

    const onEvent = (e: AgentRunEvent) => {
      if (ctrl.signal.aborted) return;
      switch (e.type) {
        case "status":
        case "search":
          setState((s) => ({ ...s, lines: [...s.lines, { id: ++lineId.current, kind: e.type, text: e.type === "status" ? e.message : e.query }] }));
          break;
        case "thinking":
          setState((s) => ({ ...s, thinking: [...s.thinking, e.text] }));
          break;
        case "text":
          setState((s) => ({ ...s, text: s.text + e.text }));
          break;
        case "error":
          setState((s) => ({ ...s, phase: s.revising && s.output ? "done" : "error", revising: false, error: { code: e.code, message: e.message } }));
          break;
        case "result": {
          if (revision) {
            const versions: Versions = [...revision.versions, { at: nowISO(), instruction: revision.instruction, output: revision.previous }];
            setState((s) => ({ ...s, phase: "done", revising: false, output: e.output, versions, model: e.model, usage: e.usage, dirty: false }));
            if (revision.draftId) {
              void data.saveDraft({ output: e.output, versions, model: e.model, usage: e.usage }, revision.draftId).then((res) => {
                toast(res.ok ? { message: "Revision saved" } : { message: "Revision saved on this device. Not saved to Google Sheets yet.", tone: "negative" });
              });
            } else {
              void saveNew(e.output, meta, e.model, e.usage, versions);
            }
          } else {
            setState((s) => ({ ...s, phase: "done", output: e.output, model: e.model, usage: e.usage, versions: [], dirty: false }));
            void saveNew(e.output, meta, e.model, e.usage);
          }
          break;
        }
      }
    };

    void runAgentStream(key, body, { signal: ctrl.signal, onEvent }).finally(() => {
      if (abortRef.current === ctrl) abortRef.current = null;
    });
  };

  const start = (body: AgentRunRequest, meta: RunMeta) => stream(body, meta);

  const revise = (instruction: string) => {
    const s = state;
    if (!s.output || !s.meta || !bodyRef.current) return;
    const body: AgentRunRequest = { ...bodyRef.current, revise: { previous: s.output, instruction } };
    stream(body, s.meta, { instruction, previous: s.output, draftId: s.draftId, versions: s.versions });
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((s) => (s.output ? { ...s, phase: "done", revising: false } : { ...s, phase: "idle", stopped: true }));
  };

  const retry = () => {
    const s = state;
    if (!bodyRef.current || !s.meta) return;
    const body = bodyRef.current;
    if (body.revise && s.output) stream(body, s.meta, { instruction: body.revise.instruction, previous: s.output, draftId: s.draftId, versions: s.versions });
    else stream({ ...body, revise: undefined }, s.meta);
  };

  const edit = (o: AgentOutput) => setState((s) => ({ ...s, output: o, dirty: true }));

  const saveEdits = async () => {
    const s = state;
    if (!s.output) return;
    if (!s.draftId) return saveDraftAgain();
    const res = await data.saveDraft({ output: s.output }, s.draftId);
    setState((x) => ({ ...x, dirty: false }));
    toast(res.ok ? { message: "Changes saved" } : { message: "Saved on this device. Not saved to Google Sheets yet.", tone: "negative" });
  };

  const saveDraftAgain = async () => {
    const s = state;
    if (!s.output || !s.meta) return;
    setState((x) => ({ ...x, dirty: false }));
    await saveNew(s.output, s.meta, s.model ?? "", s.usage, s.versions);
  };

  const restore = async (index: number) => {
    const s = state;
    const v = s.versions[index];
    if (!v || !s.output) return;
    const versions: Versions = [...s.versions, { at: nowISO(), instruction: "Before restoring an earlier version", output: s.output }];
    setState((x) => ({ ...x, output: v.output, versions, dirty: false }));
    if (s.draftId) await data.saveDraft({ output: v.output, versions }, s.draftId);
    toast({ message: "Restored the earlier version" });
  };

  const reset = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(IDLE);
  };

  return { key, state, running: state.phase === "running", start, revise, stop, retry, edit, saveEdits, saveDraftAgain, restore, reset };
}

/* ------------------------------------------------------------------ progress */

function Progress({ state, agentKey, onStop }: { state: AgentRunState; agentKey: AgentKey; onStop: () => void }) {
  const now = useNow(1000);
  const seconds = now && state.startedAt ? Math.max(0, Math.round((now - state.startedAt) / 1000)) : 0;
  const lines = state.lines;
  return (
    <section className="card min-w-0 p-5 sm:p-6" aria-busy="true">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-lime">
            <span className="size-2.5 rounded-full bg-on-lime" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[17px] font-medium tracking-[-0.02em] text-ink">{state.revising ? "Revising" : "Working"}…</h3>
            <p className="text-[12.5px] tabular-nums text-ink-3" role="timer" aria-live="off">
              {seconds} s{seconds >= 60 ? ". Longer tasks can take a few minutes." : ""}
            </p>
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onStop}>
          <Square aria-hidden /> Stop
        </button>
      </div>

      <ol className="mt-5 space-y-2" aria-live="polite">
        {lines.length === 0 && <li className="text-[13px] text-ink-3">Starting…</li>}
        {lines.map((l, i) => {
          const latest = i === lines.length - 1;
          return (
            <li key={l.id} className={`flex items-start gap-2.5 text-[13.5px] ${latest ? "text-ink" : "text-ink-3"}`}>
              <span aria-hidden className={`mt-[3px] flex size-4 shrink-0 items-center justify-center rounded-full ${latest ? "bg-accent text-on-accent" : "bg-surface-2"}`}>
                {l.kind === "search" ? <Globe className="size-2.5" /> : <span className={`size-1.5 rounded-full ${latest ? "bg-current" : "bg-ink-3"}`} />}
              </span>
              <span className="min-w-0 break-words">{l.kind === "search" ? `Searching the web for “${l.text}”` : l.text}</span>
            </li>
          );
        })}
      </ol>

      {state.thinking.length > 0 && (
        <details className="group mt-4 rounded-inset bg-surface-2 px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] font-medium text-ink-2 marker:hidden [&::-webkit-details-marker]:hidden">
            <ChevronDown aria-hidden className="size-4 -rotate-90 transition-transform group-open:rotate-0" />
            Show reasoning
          </summary>
          <div className="mt-2 max-h-64 space-y-2 overflow-y-auto text-table text-ink-2">
            {state.thinking.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </div>
        </details>
      )}

      {agentKey === "prospect_brief" && state.text && (
        <div className="mt-5 border-t border-line pt-5">
          <Markdown source={state.text} />
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ the runner card */

export function RunError({ error, onRetry }: { error: { code: AgentErrorCode; message: string }; onRetry?: () => void }) {
  const copy = ERROR_COPY[error.code] ?? ERROR_COPY.upstream;
  const detail = error.message && error.message !== copy.title ? error.message : null;
  return (
    <div role="alert" className="rounded-inset bg-coral-soft p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-coral text-white">
          <RefreshCw className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium text-ink">{copy.title}</p>
          {detail && <p className="mt-0.5 text-[13px] text-ink-2">{detail}</p>}
        </div>
      </div>
      {copy.retry && onRetry && (
        <button type="button" className="btn btn-primary btn-sm mt-4" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

function usageLine(u?: AgentUsage): string | null {
  if (!u) return null;
  const parts = [`${u.inputTokens.toLocaleString("en-IN")} tokens in`, `${u.outputTokens.toLocaleString("en-IN")} out`];
  if (u.cacheReadTokens) parts.push(`${u.cacheReadTokens.toLocaleString("en-IN")} from cache`);
  if (u.webSearches) parts.push(`${u.webSearches} ${u.webSearches === 1 ? "search" : "searches"}`);
  return parts.join(", ");
}

export function AgentRunner({ run, emptyHint = true }: { run: AgentRun; emptyHint?: boolean }) {
  const { state } = run;
  const now = useNow();
  const entry = AGENT_BY_KEY[run.key];
  const [instruction, setInstruction] = useState("");
  const [showVersions, setShowVersions] = useState(false);

  if (state.phase === "idle" && !state.output) {
    if (!emptyHint) return null;
    return (
      <section className="card flex min-w-0 items-start gap-3 p-5 sm:p-6">
        <span aria-hidden className="hatch flex size-10 shrink-0 items-center justify-center rounded-full text-ink-2">
          <History className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-ink">{state.stopped ? "Stopped. Nothing was saved." : "The draft appears here."}</p>
          <p className="mt-1 text-[13px] text-ink-3">
            Every result is saved to History as an editable draft. Nothing is sent or posted until you do it.
          </p>
        </div>
      </section>
    );
  }

  if (state.phase === "error" && !state.output) {
    return (
      <section className="card min-w-0 p-5 sm:p-6">
        <RunError error={state.error!} onRetry={run.retry} />
      </section>
    );
  }

  if (state.phase === "running" && !state.revising) return <Progress state={state} agentKey={run.key} onStop={run.stop} />;

  const output = state.output!;
  const usage = usageLine(state.usage);
  const tooLong = instruction.length > REVISE_INSTRUCTION_MAX;

  return (
    <div className="min-w-0 space-y-3 sm:space-y-4">
      {state.revising && <Progress state={state} agentKey={run.key} onStop={run.stop} />}

      <section className={`card min-w-0 p-5 sm:p-6 ${state.revising ? "opacity-60" : ""}`} aria-busy={state.revising || undefined}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[17px] font-medium leading-tight tracking-[-0.02em] text-ink">{state.meta?.title ?? entry.name}</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="chip chip-outline">{entry.name}</span>
              {state.meta && state.meta.language !== "en" && <span className="chip chip-outline">{LANGUAGE_LABEL[state.meta.language]}</span>}
              {state.draftId ? <span className="chip chip-good">Saved to History</span> : <span className="chip chip-amber">Not saved</span>}
              {state.versions.length > 0 && <span className="chip">Version {state.versions.length + 1}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(state.dirty || !state.draftId) && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void (state.draftId ? run.saveEdits() : run.saveDraftAgain())} disabled={state.revising}>
                <Save aria-hidden /> {state.draftId ? "Save changes" : "Save draft"}
              </button>
            )}
          </div>
        </div>

        {state.error && state.phase === "done" && (
          <div className="mt-4">
            <RunError error={state.error} onRetry={run.retry} />
          </div>
        )}

        <div className="mt-5">
          <AgentOutputView output={output} onChange={state.revising ? undefined : run.edit} agentRef={state.meta?.ref} draftId={state.draftId} />
        </div>

        {usage && <p className="mt-4 text-[12px] text-ink-3">{usage}</p>}
      </section>

      <section className="card min-w-0 p-5 sm:p-6">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const t = instruction.trim();
            if (t.length < 2 || tooLong || run.running) return;
            run.revise(t);
            setInstruction("");
          }}
        >
          <Field
            label="Ask for changes"
            htmlFor={`revise-${run.key}`}
            className="min-w-0 flex-1"
            error={tooLong ? `Keep it under ${REVISE_INSTRUCTION_MAX} characters.` : undefined}
          >
            <Textarea
              id={`revise-${run.key}`}
              rows={2}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Shorter, more formal, mention the demo"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
          </Field>
          <button type="submit" className="btn btn-primary shrink-0" disabled={run.running || instruction.trim().length < 2 || tooLong}>
            <RotateCcw aria-hidden /> Revise
          </button>
        </form>

        {state.versions.length > 0 && (
          <div className="mt-4 border-t border-line pt-4">
            <button type="button" className="btn btn-plain btn-sm -ml-2" aria-expanded={showVersions} onClick={() => setShowVersions((v) => !v)}>
              <ChevronDown aria-hidden className={`transition-transform ${showVersions ? "" : "-rotate-90"}`} />
              Previous versions ({state.versions.length})
            </button>
            {showVersions && (
              <ol className="mt-2 space-y-1.5">
                {state.versions
                  .map((v, i) => ({ v, i }))
                  .reverse()
                  .map(({ v, i }) => (
                    <li key={i} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] text-ink">Version {i + 1}</p>
                        <p className="truncate text-[12px] text-ink-3">
                          {relativeTime(v.at, now)}, before “{v.instruction}”
                        </p>
                      </div>
                      <button type="button" className="btn btn-ghost btn-sm shrink-0" disabled={run.running} onClick={() => void run.restore(i)}>
                        Restore
                      </button>
                    </li>
                  ))}
              </ol>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
