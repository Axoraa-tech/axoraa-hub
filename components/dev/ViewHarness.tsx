"use client";

// Dev harness: mounts the real HubApp for any role on local demo data, with the server feature
// flags switchable. No sign-in, no passwords. Pages and overlays are the production ones.
import React, { useMemo, useState } from "react";
import { HubApp, type HubMode } from "@/components/HubApp";
import { NO_FEATURES, type FeatureFlags } from "@/lib/features";
import { findPerson } from "@/lib/people";
import { viewsFor } from "@/lib/views";

const ROLES = [
  { key: "admin", label: "Admin" },
  { key: "akshar", label: "Founder (Akshar)" },
  { key: "kamil", label: "Marketing (Kamil)" },
  { key: "manish", label: "Developer (Manish)" },
] as const;

type Flag = "assistant" | "meta" | "sheets";

export function ViewHarness() {
  const [role, setRole] = useState<(typeof ROLES)[number]["key"]>("admin");
  const [flags, setFlags] = useState<Record<Flag, boolean>>({ assistant: false, meta: false, sheets: false });

  const mode = useMemo<HubMode>(() => {
    if (role === "admin") return { kind: "admin" };
    return { kind: "member", person: findPerson(role)!, viewerIsAdmin: false };
  }, [role]);

  const features = useMemo<FeatureFlags>(
    () => ({
      sheets: { configured: flags.sheets, version: flags.sheets ? 2 : null },
      assistant: { ...NO_FEATURES.assistant, configured: flags.assistant },
      meta: {
        ...NO_FEATURES.meta,
        configured: flags.meta,
        publishEnabled: flags.meta,
        leadsEnabled: flags.meta,
      },
    }),
    [flags]
  );

  const category = mode.kind === "admin" ? "admin" : mode.person.category;
  const views = viewsFor(category);

  const goto = (id: string) => {
    window.history.pushState(null, "", `${window.location.pathname}?view=${id}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b border-black/10 bg-white px-4 py-2 text-xs text-black">
        <strong>View harness</strong>
        <label className="flex items-center gap-1">
          Role
          <select className="rounded border px-1 py-0.5" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            {ROLES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          View
          <select className="rounded border px-1 py-0.5" defaultValue="" onChange={(e) => e.target.value && goto(e.target.value)}>
            <option value="">Pick a view</option>
            {views.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title}
              </option>
            ))}
          </select>
        </label>
        {(["assistant", "meta", "sheets"] as Flag[]).map((f) => (
          <label key={f} className="flex items-center gap-1">
            <input type="checkbox" checked={flags[f]} onChange={(e) => setFlags((s) => ({ ...s, [f]: e.target.checked }))} />
            {f}
          </label>
        ))}
      </div>
      <HubApp key={role} mode={mode} features={features} />
    </>
  );
}
