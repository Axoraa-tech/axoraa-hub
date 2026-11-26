"use client";

import React from "react";
import { ChevronsUpDown, Keyboard, LogOut } from "lucide-react";
import { logout } from "@/app/login/actions";
import { Popover } from "@/components/ui/Menu";
import { Avatar, Segmented } from "@/components/ui/primitives";
import type { ComposePref } from "@/lib/company";
import type { HubViewer } from "@/lib/hub/types";
import { useComposePref, useDensity, type Density } from "@/lib/prefs";
import { useTheme } from "@/lib/theme";
import type { ThemePref } from "@/lib/theme-script";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="px-1 text-[12px] text-ink-3">{label}</div>
      {children}
    </div>
  );
}

/** The user pill at the foot of the sidebar; opens theme, density, email app, shortcuts and sign out. */
export function UserMenu({ viewer, roleLabel, onShortcuts }: { viewer: HubViewer; roleLabel: string; onShortcuts: () => void }) {
  const { pref, setPref } = useTheme();
  const [density, setDensity] = useDensity();
  const [compose, setCompose] = useComposePref();

  return (
    <Popover
      label="Account and preferences"
      align="start"
      triggerClassName="flex min-w-0 flex-1 items-center gap-2.5 rounded-full p-1 pr-2 text-left transition-colors hover:bg-surface aria-expanded:bg-surface"
      panelClassName="w-[300px] p-3"
      trigger={
        <>
          <Avatar name={viewer.name} size={38} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-medium leading-tight text-ink">{viewer.name}</span>
            <span className="block truncate text-[12px] text-ink-3">{roleLabel}</span>
          </span>
          <ChevronsUpDown aria-hidden className="h-4 w-4 shrink-0 text-ink-3" />
          <span className="sr-only">Open account and preferences</span>
        </>
      }
    >
      {(close) => (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-[16px] bg-surface-2 p-2.5">
            <Avatar name={viewer.name} size={40} />
            <div className="min-w-0">
              <div className="truncate text-[14px] font-medium text-ink">{viewer.name}</div>
              <div className="truncate text-[12px] text-ink-3">{viewer.email || roleLabel}</div>
            </div>
          </div>

          <Row label="Theme">
            <Segmented<ThemePref>
              label="Theme"
              size="sm"
              className="w-full"
              value={pref}
              onChange={setPref}
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
          </Row>

          <Row label="Table density">
            <Segmented<Density>
              label="Table density"
              size="sm"
              className="w-full"
              value={density}
              onChange={setDensity}
              options={[
                { value: "default", label: "Comfortable" },
                { value: "compact", label: "Compact" },
              ]}
            />
          </Row>

          <Row label="Open email in">
            <Segmented<ComposePref>
              label="Open email in"
              size="sm"
              className="w-full"
              value={compose}
              onChange={setCompose}
              options={[
                { value: "mailto", label: "Mail app", title: "Your default mail app" },
                { value: "gmail", label: "Gmail" },
                { value: "outlook", label: "Outlook" },
              ]}
            />
          </Row>

          <div className="space-y-0.5 border-t border-line pt-2">
            <button
              type="button"
              onClick={() => {
                close();
                onShortcuts();
              }}
              className="flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-[13.5px] text-ink transition-colors hover:bg-surface-2"
            >
              <Keyboard aria-hidden className="h-4 w-4 text-ink-2" />
              <span className="flex-1">Keyboard shortcuts</span>
              <kbd className="kbd">?</kbd>
            </button>
            <form action={logout}>
              <button
                type="submit"
                className="flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-[13.5px] text-negative transition-colors hover:bg-coral-soft"
              >
                <LogOut aria-hidden className="h-4 w-4" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </Popover>
  );
}
