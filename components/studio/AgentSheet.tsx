"use client";

import React from "react";
import { ArrowUpRight } from "lucide-react";
import { AGENT_BY_KEY } from "@/lib/agents/catalog";
import { useHub } from "@/lib/hub/context";
import { can } from "@/lib/hub/permissions";
import type { Overlay } from "@/lib/views";
import { Sheet } from "@/components/ui/Dialog";
import { AgentForm, useRefRecord } from "./AgentForm";
import { AgentRunner, useAgentRun } from "./AgentRunner";
import { AssistantNotConfigured } from "@/components/views/AssistantView";

type AgentOverlay = Extract<Overlay, { kind: "agent" }>;

/** An agent over one record: the form with the record fixed, the live run and the draft, in a side sheet. */
export function AgentSheet({ overlay, onClose }: { overlay: AgentOverlay; onClose: () => void }) {
  const { data, viewer, features, navigate } = useHub();
  const entry = AGENT_BY_KEY[overlay.agentKey];
  const run = useAgentRun(overlay.agentKey);
  const record = useRefRecord(overlay.ref);
  const allowed = can(viewer, "agent.run", { data, agentKey: overlay.agentKey });
  const missing = !!overlay.ref && !record;

  const close = () => {
    run.stop();
    onClose();
  };

  return (
    <Sheet
      open
      onClose={close}
      width="lg"
      title={entry.name}
      description={record?.name ?? entry.description}
      footer={
        <button
          type="button"
          className="btn btn-plain mr-auto"
          onClick={() => {
            run.stop();
            navigate("assistant", { agent: overlay.agentKey, ref: overlay.ref ? `${overlay.ref.type}:${overlay.ref.id}` : undefined, tab: null });
            onClose();
          }}
        >
          Open in Assistant <ArrowUpRight aria-hidden />
        </button>
      }
    >
      <div className="space-y-4">
        {!features.assistant.configured ? (
          <AssistantNotConfigured />
        ) : !allowed ? (
          <p className="rounded-inset bg-amber-soft p-4 text-[13.5px] text-ink">This assistant task isn&apos;t available in your workspace{data.settings.disabledAgents.includes(overlay.agentKey) ? " right now. It is switched off in Settings" : ""}.</p>
        ) : missing ? (
          <p className="rounded-inset bg-amber-soft p-4 text-[13.5px] text-ink">That record isn&apos;t available to you.</p>
        ) : (
          <>
            <section aria-label={`${entry.name} input`}>
              <AgentForm
                entry={entry}
                fixedRef={overlay.ref}
                initialInput={overlay.input}
                running={run.running}
                onRun={run.start}
                onStop={run.stop}
              />
            </section>
            <AgentRunner run={run} />
          </>
        )}
      </div>
    </Sheet>
  );
}
