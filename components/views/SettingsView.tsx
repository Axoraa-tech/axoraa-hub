"use client";

import React, { useState } from "react";
import { Bot, Building2, GitPullRequestArrow, Settings as SettingsIcon, Timer, UploadCloud, Users } from "lucide-react";
import { useHub } from "@/lib/hub/context";
import { can } from "@/lib/hub/permissions";
import { useNow } from "@/lib/prefs";
import { formatDateTimeIST, relativeTime } from "@/lib/format";
import type { HubSettings } from "@/lib/settings";
import { EmptyState, Segmented } from "@/components/ui/primitives";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { CompanyProfileForm } from "@/components/settings/CompanyProfileForm";
import { PipelineSettings } from "@/components/settings/PipelineSettings";
import { WorkSettings } from "@/components/settings/WorkSettings";
import { TeamList } from "@/components/settings/TeamList";
import { AssistantSettings } from "@/components/settings/AssistantSettings";
import { Notice } from "@/components/settings/IntegrationRow";

type Section = "company" | "pipeline" | "work" | "team" | "assistant";

const SECTIONS: { id: Section; label: string; short: string; hint: string; icon: React.ReactNode }[] = [
  { id: "company", label: "Company profile", short: "Company", hint: "Name, inbox, GSTIN, address", icon: <Building2 /> },
  { id: "pipeline", label: "Pipeline", short: "Pipeline", hint: "Stages, sources, Meta leads", icon: <GitPullRequestArrow /> },
  { id: "work", label: "Work", short: "Work", hint: "Hours target, projects", icon: <Timer /> },
  { id: "team", label: "Team", short: "Team", hint: "Accounts, read only", icon: <Users /> },
  { id: "assistant", label: "Assistant", short: "Assistant", hint: "Agents and cost", icon: <Bot /> },
];

function isSection(v: string | null): v is Section {
  return SECTIONS.some((s) => s.id === v);
}

export function SettingsView() {
  const { data, viewer, params, setParams } = useHub();
  const toast = useToast();
  const confirm = useConfirm();
  const now = useNow();
  const [section, setSection] = useState<Section>(() => {
    const s = params.get("section");
    return isSection(s) ? s : "company";
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!can(viewer, "settings.edit")) {
    return (
      <div className="card">
        <EmptyState icon={<SettingsIcon />} title="Only the administrator can change settings" body="Ask the administrator if something here needs changing." />
      </div>
    );
  }

  const settings = data.settings;
  const unsynced = data.unsynced.find((o) => o.entity === "settings");

  const go = async (next: Section) => {
    if (next === section) return;
    if (dirty) {
      const discard = await confirm({
        title: "Discard unsaved changes?",
        body: `Your changes to ${SECTIONS.find((s) => s.id === section)?.label ?? "this section"} have not been saved.`,
        confirmLabel: "Discard changes",
        cancelLabel: "Keep editing",
        tone: "danger",
      });
      if (!discard) return;
    }
    setDirty(false);
    setSection(next);
    setParams({ section: next });
  };

  const onSave = async (patch: Partial<HubSettings>): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await data.saveSettings(patch);
      if (res.ok) toast({ message: "Settings saved", tone: "positive" });
      else toast({ message: "Saved on this device. Google Sheets did not take the change yet.", tone: "negative" });
      return true;
    } catch {
      toast({ message: "Couldn't save the settings", tone: "negative" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const formProps = { settings, onSave, onDirtyChange: setDirty, saving };
  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];

  return (
    <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-5">
      {/* Sub-nav: pill list on desktop, segmented control on phones */}
      <nav aria-label="Settings sections" className="min-w-0">
        <div className="-mx-1 overflow-x-auto px-1 pb-1 no-scrollbar lg:hidden">
          <Segmented<Section>
            size="sm"
            label="Settings section"
            value={section}
            onChange={(v) => void go(v)}
            options={SECTIONS.map((s) => ({ value: s.id, label: s.short }))}
          />
        </div>
        <div className="card hidden p-2 lg:sticky lg:top-6 lg:block">
          <ul className="space-y-1">
            {SECTIONS.map((s) => {
              const active = s.id === section;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() => void go(s.id)}
                    className={`flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-left transition-colors ${
                      active ? "bg-accent text-on-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full [&>svg]:h-4 [&>svg]:w-4 ${
                        active ? "bg-white/15 text-lime dark:bg-black/10 dark:text-on-accent" : "bg-surface-2 text-ink"
                      }`}
                    >
                      {s.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-medium">{s.label}</span>
                      <span className={`block truncate text-[12px] ${active ? "opacity-70" : "text-ink-3"}`}>{s.hint}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 border-t border-line px-3 pb-2 pt-3 text-[12px] text-ink-3">
            {settings.updatedAt ? (
              <span title={formatDateTimeIST(settings.updatedAt)}>
                Last saved {relativeTime(settings.updatedAt, now)}
                {settings.updatedBy ? ` by ${settings.updatedBy}` : ""}
              </span>
            ) : (
              "Using the default settings."
            )}
          </p>
        </div>
      </nav>

      <div className="min-w-0 space-y-3 sm:space-y-4" aria-label={current.label}>
        {unsynced && (
          <Notice
            tone="negative"
            icon={<UploadCloud />}
            action={
              <button type="button" className="btn btn-ink btn-sm" disabled={data.syncState.busy} onClick={() => void data.retrySync("settings")}>
                Retry
              </button>
            }
          >
            <p className="font-medium">Settings are saved on this device but not in Google Sheets yet.</p>
            <p className="mt-0.5 text-ink-2">{unsynced.error}</p>
          </Notice>
        )}
        {!data.sharedMode && (
          <p className="px-1 text-[12.5px] text-ink-3">Settings are saved in this browser. Once Google Sheets version 2 is connected, they apply to the whole team.</p>
        )}
        <div key={section} className="animate-rise">
          {section === "company" && <CompanyProfileForm {...formProps} />}
          {section === "pipeline" && <PipelineSettings {...formProps} />}
          {section === "work" && <WorkSettings {...formProps} />}
          {section === "team" && <TeamList />}
          {section === "assistant" && <AssistantSettings {...formProps} />}
        </div>
      </div>
    </div>
  );
}
