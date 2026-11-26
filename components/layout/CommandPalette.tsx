"use client";

// The Ctrl/⌘K command bar: an ink card that jumps to a view, runs an action or opens a record.
// Matching is a client-side substring match over the viewer's (scoped) data; prefix matches rank first.
import React, { startTransition, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  CalendarPlus,
  CornerDownLeft,
  FileText,
  Keyboard,
  LogOut,
  Mail,
  MapPin,
  Moon,
  PenLine,
  Plus,
  ReceiptIndianRupee,
  ScrollText,
  Search,
  Sun,
  Timer,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/app/login/actions";
import { useIsClient } from "@/components/ui/Dialog";
import { agentRoleOf, agentsFor } from "@/lib/agents/catalog";
import { COMPANY_EMAIL, supportMailto } from "@/lib/company";
import type { FeatureFlags } from "@/lib/features";
import { formatDateIST } from "@/lib/format";
import { can } from "@/lib/hub/permissions";
import type { HubViewer } from "@/lib/hub/types";
import { PEOPLE } from "@/lib/people";
import { useTheme } from "@/lib/theme";
import type { HubData } from "@/lib/useHubData";
import { canAccessView, viewsFor, type Overlay, type ViewId, type ViewParams } from "@/lib/views";

interface PaletteItem {
  id: string;
  group: string;
  label: string;
  hint?: string;
  keys?: string[];
  icon: LucideIcon;
  /** Extra text searched besides the label. */
  terms?: string[];
  run: () => void;
}

const GROUP_ORDER = ["Actions", "Views", "Deals", "Visits", "Clients", "Invoices", "Work log", "People"] as const;
const PER_GROUP = 6;

function score(item: PaletteItem, q: string): number {
  const label = item.label.toLowerCase();
  if (label.startsWith(q)) return 0;
  if (label.split(/[\s,()/–-]+/).some((w) => w.startsWith(q))) return 1;
  if (label.includes(q)) return 2;
  const terms = (item.terms ?? []).map((t) => t.toLowerCase());
  if (terms.some((t) => t.startsWith(q))) return 3;
  if (terms.some((t) => t.includes(q))) return 4;
  return -1;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  data: HubData;
  viewer: HubViewer;
  features: FeatureFlags;
  navigate: (view: ViewId, params?: ViewParams) => void;
  openOverlay: (o: Overlay) => void;
  onShortcuts: () => void;
  mac: boolean;
}

export function CommandPalette(props: CommandPaletteProps) {
  const isClient = useIsClient();
  if (!isClient || !props.open) return null;
  return createPortal(<PalettePanel {...props} />, document.body);
}

function PalettePanel({ onClose, data, viewer, features, navigate, openOverlay, onShortcuts, mac }: CommandPaletteProps) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const optionPrefix = useId();
  const { resolved, setPref } = useTheme();
  const router = useRouter();

  // Focus, scroll lock and focus return for the life of the panel.
  useEffect(() => {
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus({ preventScroll: true });
    const body = document.body;
    const saved = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = saved;
      if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
    };
  }, []);

  const all = useMemo<PaletteItem[]>(() => {
    const out: PaletteItem[] = [];
    const go = (o: Overlay) => () => openOverlay(o);
    const category = viewer.category;

    // ---- actions
    if (can(viewer, "worklog.edit", { data })) out.push({ id: "a-log", group: "Actions", label: "Log work", icon: Timer, terms: ["hours", "entry"], run: go({ kind: "worklog", entry: null }) });
    if (can(viewer, "deal.edit", { data })) out.push({ id: "a-deal", group: "Actions", label: "Add deal", icon: Plus, terms: ["lead", "new"], run: go({ kind: "deal", dealId: null }) });
    if (can(viewer, "visit.edit", { data })) out.push({ id: "a-visit", group: "Actions", label: "Log visit", icon: MapPin, terms: ["call", "meeting"], run: go({ kind: "visit", visitId: null }) });
    if (can(viewer, "invoice.edit", { data })) out.push({ id: "a-invoice", group: "Actions", label: "Add invoice", icon: ReceiptIndianRupee, terms: ["bill", "gst"], run: go({ kind: "invoice", invoiceId: null }) });
    if (can(viewer, "content.edit", { data }) && canAccessView(category, "content"))
      out.push({ id: "a-post", group: "Actions", label: "Add post", icon: CalendarPlus, terms: ["content", "social"], run: go({ kind: "post", postId: null }) });

    if (canAccessView(category, "assistant")) {
      const role = agentRoleOf(category);
      for (const a of agentsFor(role, data.settings?.disabledAgents ?? [])) {
        if (!can(viewer, "agent.run", { data, features, agentKey: a.key })) continue;
        out.push({
          id: `agent-${a.key}`,
          group: "Actions",
          label: a.name,
          hint: "Assistant",
          icon: PenLine,
          terms: [a.description, "assistant", "draft"],
          run: a.refRequired ? () => navigate("assistant", { agent: a.key }) : go({ kind: "agent", agentKey: a.key }),
        });
      }
    }

    out.push({
      id: "a-theme",
      group: "Actions",
      label: resolved === "dark" ? "Switch to light theme" : "Switch to dark theme",
      icon: resolved === "dark" ? Sun : Moon,
      terms: ["theme", "dark", "light", "mode"],
      run: () => setPref(resolved === "dark" ? "light" : "dark"),
    });
    out.push({ id: "a-keys", group: "Actions", label: "Keyboard shortcuts", icon: Keyboard, keys: ["?"], terms: ["keys", "help"], run: onShortcuts });
    out.push({
      id: "a-mail",
      group: "Actions",
      label: `Email ${COMPANY_EMAIL}`,
      icon: Mail,
      terms: ["help", "support", "contact"],
      run: () => {
        window.location.href = supportMailto({ subject: `Hub help – ${viewer.name}` });
      },
    });
    out.push({ id: "a-signout", group: "Actions", label: "Sign out", icon: LogOut, terms: ["log out", "logout"], run: () => startTransition(() => void logout()) });

    // ---- views
    for (const v of viewsFor(category)) {
      out.push({
        id: `v-${v.id}`,
        group: "Views",
        label: v.label,
        icon: v.icon,
        keys: v.chord ? ["G", v.chord.split(" ")[1].toUpperCase()] : undefined,
        terms: [v.title, v.description],
        run: () => navigate(v.id),
      });
    }

    // ---- records (shown once something is typed)
    if (canAccessView(category, "mkt_deals")) {
      for (const d of data.deals) {
        out.push({
          id: `d-${d.id}`,
          group: "Deals",
          label: d.companyName || d.leadId || "Untitled deal",
          hint: d.leadId,
          icon: Briefcase,
          terms: [d.leadId, d.contactPerson, d.city, d.marketingPerson, d.leadStatus].filter(Boolean),
          run: go({ kind: "deal", dealId: d.id }),
        });
      }
    }
    if (canAccessView(category, "mkt_visits")) {
      for (const i of data.interactions) {
        out.push({
          id: `i-${i.id}`,
          group: "Visits",
          label: i.companyName || "Visit",
          hint: formatDateIST(i.date),
          icon: MapPin,
          terms: [i.personsMet, i.leadId, i.interactionType, i.marketingPerson].filter(Boolean),
          run: go({ kind: "visit", visitId: i.id }),
        });
      }
    }
    if (canAccessView(category, "clients")) {
      for (const c of data.clients) {
        out.push({
          id: `c-${c.id}`,
          group: "Clients",
          label: c.companyName || c.clientId,
          hint: c.clientId,
          icon: UserRound,
          terms: [c.clientId, c.contactPerson ?? "", c.salesOwner, c.industry].filter(Boolean),
          run: go({ kind: "client", clientId: c.id }),
        });
      }
    }
    if (can(viewer, "invoice.edit", { data })) {
      for (const p of data.payments) {
        out.push({
          id: `p-${p.id}`,
          group: "Invoices",
          label: `${p.invoiceId || "Invoice"} ${p.companyName ? `(${p.companyName})` : ""}`.trim(),
          hint: p.status,
          icon: FileText,
          terms: [p.companyName, p.clientId, p.milestoneDescription].filter(Boolean),
          run: go({ kind: "invoice", invoiceId: p.id }),
        });
      }
    }
    if (canAccessView(category, "eng_log")) {
      for (const l of data.workLogs) {
        out.push({
          id: `w-${l.id}`,
          group: "Work log",
          label: l.module || l.taskDescription || l.project || "Work entry",
          hint: `${l.developerName}, ${formatDateIST(l.date)}`,
          icon: ScrollText,
          terms: [l.project, l.taskDescription, l.developerName, l.githubPr, l.repository].filter(Boolean),
          run: go({ kind: "worklog", entry: l }),
        });
      }
    }
    if (viewer.kind === "admin") {
      for (const p of PEOPLE) {
        if (p.role !== "member") continue;
        out.push({
          id: `u-${p.id}`,
          group: "People",
          label: p.name,
          hint: p.title,
          icon: UserRound,
          terms: [p.title, p.category],
          run: () => router.push(`/u/${p.id}`),
        });
      }
    }
    return out;
  }, [data, viewer, features, navigate, openOverlay, onShortcuts, resolved, setPref, router]);

  const needle = q.trim().toLowerCase();
  const items = useMemo(() => {
    if (!needle) return all.filter((i) => i.group === "Actions" || i.group === "Views");
    const byGroup = new Map<string, { item: PaletteItem; s: number }[]>();
    for (const item of all) {
      const s = score(item, needle);
      if (s < 0) continue;
      const list = byGroup.get(item.group) ?? [];
      list.push({ item, s });
      byGroup.set(item.group, list);
    }
    const out: PaletteItem[] = [];
    for (const g of GROUP_ORDER) {
      const list = byGroup.get(g);
      if (!list) continue;
      list.sort((a, b) => a.s - b.s);
      out.push(...list.slice(0, PER_GROUP).map((x) => x.item));
    }
    return out;
  }, [all, needle]);

  const idx = items.length ? Math.min(active, items.length - 1) : -1;
  const optionId = (i: number) => `${optionPrefix}-${i}`;

  useEffect(() => {
    if (idx < 0) return;
    const el = document.getElementById(`${optionPrefix}-${idx}`);
    el?.scrollIntoView({ block: "nearest" });
  }, [idx, optionPrefix]);

  const groups = items.reduce<{ name: string; rows: { item: PaletteItem; i: number }[] }[]>((acc, item, i) => {
    const last = acc[acc.length - 1];
    if (last && last.name === item.group) last.rows.push({ item, i });
    else acc.push({ name: item.group, rows: [{ item, i }] });
    return acc;
  }, []);

  const run = (item: PaletteItem) => {
    onClose();
    item.run();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive(items.length ? (idx + 1) % items.length : 0);
        return;
      case "ArrowUp":
        e.preventDefault();
        setActive(items.length ? (idx - 1 + items.length) % items.length : 0);
        return;
      case "Home":
        if (!q) {
          e.preventDefault();
          setActive(0);
        }
        return;
      case "End":
        if (!q) {
          e.preventDefault();
          setActive(Math.max(0, items.length - 1));
        }
        return;
      case "Enter":
        if (idx >= 0) {
          e.preventDefault();
          run(items[idx]);
        }
        return;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      case "Tab":
        e.preventDefault();
        return;
    }
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-start justify-center px-3 pt-[max(12px,10dvh)] sm:px-6">
      <div aria-hidden className="absolute inset-0 animate-fade-in bg-backdrop backdrop-blur-[2px]" onMouseDown={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command bar"
        className="card-ink relative flex max-h-[min(640px,80dvh)] w-full max-w-[640px] animate-dialog-in flex-col p-3 shadow-float sm:p-4"
      >
        <div className="flex h-12 shrink-0 items-center gap-2.5 rounded-full bg-white/10 px-4">
          <Search aria-hidden className="h-4 w-4 shrink-0 text-white/50" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={idx >= 0 ? optionId(idx) : undefined}
            aria-label="Search views, actions and records"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search views, actions, deals, clients…"
            autoComplete="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/40 focus-visible:outline-none"
          />
          <span className="hidden shrink-0 items-center gap-1 text-[11px] text-white/45 sm:flex" aria-hidden>
            <kbd className="rounded-md bg-white/10 px-1.5 py-0.5 font-sans">Esc</kbd>
          </span>
        </div>

        <div ref={listRef} id={listId} role="listbox" aria-label="Results" className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {groups.length === 0 && (
            <p className="px-3 py-8 text-center text-[13px] text-white/60" role="status">
              No matches for &ldquo;{q.trim()}&rdquo;
            </p>
          )}
          {groups.map((g) => (
            <div key={g.name} role="group" aria-label={g.name} className="mb-2 last:mb-0">
              <div className="px-3 pb-1 pt-1.5 text-[12px] text-white/45">{g.name}</div>
              {g.rows.map(({ item, i }) => {
                const on = i === idx;
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    id={optionId(i)}
                    role="option"
                    aria-selected={on}
                    onMouseMove={() => {
                      if (!on) setActive(i);
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => run(item)}
                    className={`relative flex h-11 cursor-pointer items-center gap-3 rounded-[14px] px-3 text-[13.5px] transition-colors ${
                      on ? "bg-ink-panel-2 text-white" : "text-white/75"
                    }`}
                  >
                    <span aria-hidden className={`absolute left-1 h-1.5 w-1.5 rounded-full ${on ? "bg-lime" : "bg-transparent"}`} />
                    <Icon aria-hidden className={`h-4 w-4 shrink-0 ${on ? "text-lime" : "text-white/50"}`} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.hint && <span className="hidden max-w-[40%] shrink-0 truncate text-[12px] text-white/45 sm:inline">{item.hint}</span>}
                    {item.keys && (
                      <span aria-hidden className="hidden shrink-0 items-center gap-1 sm:flex">
                        {item.keys.map((k) => (
                          <kbd key={k} className="rounded-md bg-white/10 px-1.5 py-0.5 font-sans text-[11px] text-white/55">
                            {k}
                          </kbd>
                        ))}
                      </span>
                    )}
                    {on && <CornerDownLeft aria-hidden className="h-3.5 w-3.5 shrink-0 text-white/50" />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-2 hidden shrink-0 items-center gap-4 border-t border-white/10 px-3 pt-3 text-[12px] text-white/45 sm:flex" aria-hidden>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded-md bg-white/10 px-1.5 py-0.5 font-sans">↑</kbd>
            <kbd className="rounded-md bg-white/10 px-1.5 py-0.5 font-sans">↓</kbd>
            to move
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded-md bg-white/10 px-1.5 py-0.5 font-sans">Enter</kbd>
            to open
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <kbd className="rounded-md bg-white/10 px-1.5 py-0.5 font-sans">{mac ? "⌘" : "Ctrl"}</kbd>
            <kbd className="rounded-md bg-white/10 px-1.5 py-0.5 font-sans">K</kbd>
            to close
          </span>
        </div>
      </div>
    </div>
  );
}
