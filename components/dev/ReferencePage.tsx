"use client";

// The design gate: the upgraded original Axoraa look on mock data. Nothing here reads or writes hub data.
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeIndianRupee,
  BellRing,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CornerDownLeft,
  Database,
  Download,
  FileDown,
  FileText,
  GitPullRequestArrow,
  Globe,
  LogOut,
  MapPin,
  Menu as MenuIcon,
  MoreHorizontal,
  MoveRight,
  Pencil,
  PenLine,
  Phone,
  Plug,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Timer,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { COMPANY_EMAIL, supportMailto } from "@/lib/company";
import { formatInr, formatInrFull, formatNumber } from "@/lib/format";
import { INITIAL_CLIENT_MASTER, INITIAL_MARKETING_DEALS } from "@/lib/mockData";
import type { Granularity, Range } from "@/lib/analytics";
import type { MarketingDeal } from "@/lib/types";
import { mobileBarFor, navGroupsFor, viewsFor, type ViewId } from "@/lib/views";
import { useTheme } from "@/lib/theme";
import type { ThemePref } from "@/lib/theme-script";
import { BrandMark } from "@/components/ui/BrandMark";
import { ChannelMark } from "@/components/ui/ChannelMark";
import { ComposeActions } from "@/components/ui/ComposeActions";
import { DataTable, DensityToggle, type TableColumn } from "@/components/ui/DataTable";
import { Dialog, Sheet } from "@/components/ui/Dialog";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Checkbox, Combobox, DateInput, ErrorSummary, Field, Input, MoneyInput, Select, Switch, Textarea } from "@/components/ui/form";
import { Menu, Popover } from "@/components/ui/Menu";
import { Avatar, CardHeader, Delta, EmptyState, Kbd, PeriodPicker, Segmented } from "@/components/ui/primitives";
import { DelayedSkeleton, SkeletonBand } from "@/components/ui/Skeleton";
import { Badge, dueText, StatusDot, toneForDue, toneForStage } from "@/components/ui/Status";
import { SummaryBand } from "@/components/ui/SummaryBand";
import { ColumnChart, DotMatrix, FunnelChart, Heatmap, Sparkline, SplitBar, StackedBars, TickGauge } from "@/components/charts/Charts";

/* ------------------------------------------------------------------ mock data (fixed, so the page renders the same every time) */

const TODAY = "2026-11-25";

const RANGE_LABEL: Record<Granularity, string> = {
  week: "23 – 29 Nov 2026",
  month: "November 2026",
  quarter: "Q3 FY 2026–27",
  year: "FY 2026–27",
};

function rangeFor(g: Granularity): Range {
  return { granularity: g, start: new Date(2026, 10, 23), end: new Date(2026, 10, 30), label: RANGE_LABEL[g], buckets: [] };
}

/** This week, Monday to Sunday; Wednesday is today. */
const DAYS = [
  { label: "Mon", title: "Monday, 23 Nov" },
  { label: "Tue", title: "Tuesday, 24 Nov" },
  { label: "Wed", title: "Wednesday, 25 Nov" },
  { label: "Thu", title: "Thursday, 26 Nov" },
  { label: "Fri", title: "Friday, 27 Nov" },
  { label: "Sat", title: "Saturday, 28 Nov" },
  { label: "Sun", title: "Sunday, 29 Nov" },
];
const HOURS = [14.5, 17, 15, 0, 0, 0, 0];
const HOURS_PREV = [12, 15.5, 13, 16, 14, 4, 0];
const ENTRIES = [10, 11, 6, 0, 0, 0, 0];
const ENTRIES_PREV = [8, 10, 9, 11, 9, 2, 0];

const TEAM = [
  { name: "Manish", entries: 9, hours: 14.5, completed: 6, inProgress: 2, blocked: 1, review: 2, series: [3, 4, 2.5, 5, 4, 5.5, 5] },
  { name: "Vinod", entries: 8, hours: 12, completed: 5, inProgress: 3, blocked: 0, review: 1, series: [2, 3, 4, 3.5, 4, 4, 4] },
  { name: "Chakravarthi", entries: 6, hours: 9.5, completed: 4, inProgress: 1, blocked: 1, review: 1, series: [4, 2, 3, 2, 3.5, 3, 3] },
  { name: "Akshar", entries: 3, hours: 6, completed: 2, inProgress: 1, blocked: 0, review: 0, series: [1, 2, 1.5, 3, 2, 2, 2] },
  { name: "Abhinav", entries: 1, hours: 4.5, completed: 1, inProgress: 0, blocked: 0, review: 0, series: [0, 1, 0, 2, 1, 0, 4.5] },
];

const ATTENTION: { tone: string; text: string; go: ViewId }[] = [
  { tone: "bg-coral", text: "2 work items blocked", go: "eng_blockers" },
  { tone: "bg-amber", text: "3 invoices overdue · ₹6.2 L", go: "billing" },
  { tone: "bg-lime", text: "4 follow-ups due now", go: "mkt_deals" },
  { tone: "bg-white", text: "2 PRs awaiting review", go: "eng_log" },
  { tone: "bg-white/40", text: "Abhinav hasn't logged yesterday", go: "eng_log" },
];

const FUNNEL = [
  { label: "New lead", count: 24 },
  { label: "Contacted", count: 18 },
  { label: "Meeting", count: 11 },
  { label: "Proposal", count: 7 },
  { label: "Won", count: 4 },
];

const TOUCHES = [3, 5, 2, 4, 6, 1, 0, 4, 5, 3, 5, 0].map((v, i) => ({ label: `${14 + i}`, title: `${14 + i} Nov`, value: v }));

const PROJECTS = [
  { name: "Apex ledger", manager: "Akshar", pct: 72, status: "In Progress" },
  { name: "GreenPulse fleet app", manager: "Abhinav", pct: 100, status: "Completed" },
  { name: "Zeta AI console", manager: "Adnaan", pct: 41, status: "In Progress" },
  { name: "Bharat Mobility site", manager: "Bhuvan", pct: 18, status: "On Hold" },
];

const FOLLOW_UPS: Record<string, Pick<MarketingDeal, "leadStatus" | "nextFollowUpDate" | "dueStatus">> = {
  "deal-1": { leadStatus: "Closed Won", nextFollowUpDate: "2026-12-04", dueStatus: "Completed" },
  "deal-2": { leadStatus: "Negotiation", nextFollowUpDate: "2026-11-27", dueStatus: "Upcoming" },
  "deal-3": { leadStatus: "Negotiation", nextFollowUpDate: "2026-11-22", dueStatus: "Overdue" },
  "deal-4": { leadStatus: "Proposal Sent", nextFollowUpDate: "2026-11-25", dueStatus: "Today" },
  "deal-5": { leadStatus: "Proposal Sent", nextFollowUpDate: "2026-11-28", dueStatus: "Upcoming" },
};

const DEALS: MarketingDeal[] = [
  ...INITIAL_MARKETING_DEALS.slice(0, 5).map((d) => ({ ...d, ...(FOLLOW_UPS[d.id] ?? {}) })),
  {
    ...INITIAL_MARKETING_DEALS[4],
    id: "deal-meta-1",
    leadId: "LD-1006",
    companyName: "Shree Ganesh Textiles",
    contactPerson: "Pooja Hegde",
    city: "Mysuru",
    marketingPerson: "Anusha",
    leadSource: "Meta Lead Ad",
    leadStatus: "New Lead",
    estimatedDealValue: 350000,
    nextFollowUpDate: "2026-11-26",
    dueStatus: "Upcoming",
  },
  {
    ...INITIAL_MARKETING_DEALS[2],
    id: "deal-web-1",
    leadId: "LD-1007",
    companyName: "Kaveri Agro Exports",
    contactPerson: "Suresh Gowda",
    city: "Mandya",
    marketingPerson: "Kamil",
    leadSource: "Website / Inbound",
    leadStatus: "Proposal Sent",
    estimatedDealValue: 640000,
    nextFollowUpDate: "2026-11-21",
    dueStatus: "Overdue",
  },
];

const BOARD_STAGES = ["Proposal Sent", "Negotiation"] as const;
type BoardStage = (typeof BOARD_STAGES)[number];

const SOURCE_ICON: Record<string, React.ReactNode> = {
  Referral: <Users aria-hidden className="size-4 text-ink-3" />,
  "Field Visit / Direct Walk-in": <MapPin aria-hidden className="size-4 text-ink-3" />,
  "LinkedIn / Outreach": <ChannelMark channel="linkedin" className="text-ink-3" />,
  "Exhibition / Event": <CalendarDays aria-hidden className="size-4 text-ink-3" />,
  "Cold Call": <Phone aria-hidden className="size-4 text-ink-3" />,
  "Website / Inbound": <Globe aria-hidden className="size-4 text-ink-3" />,
  "Meta Lead Ad": <ChannelMark channel="facebook" className="text-ink-3" />,
};

const SOURCE_LABEL: Record<string, string> = {
  "Field Visit / Direct Walk-in": "Field visit",
  "LinkedIn / Outreach": "LinkedIn",
  "Exhibition / Event": "Event",
  "Website / Inbound": "Website",
};

const COLLECTIONS = [
  { label: "Jun", paid: 1450000, due: 0, overdue: 0 },
  { label: "Jul", paid: 980000, due: 120000, overdue: 0 },
  { label: "Aug", paid: 1720000, due: 260000, overdue: 0 },
  { label: "Sep", paid: 1240000, due: 300000, overdue: 180000 },
  { label: "Oct", paid: 860000, due: 540000, overdue: 220000 },
  { label: "Nov", paid: 420000, due: 900000, overdue: 600000 },
].map((m) => ({
  label: m.label,
  title: `${m.label} 2026`,
  parts: [
    { key: "paid" as const, value: m.paid },
    { key: "due" as const, value: m.due },
    { key: "overdue" as const, value: m.overdue },
  ],
}));

/** 26 weeks of logged hours ending on TODAY, deterministic. */
const HEAT_CELLS = (() => {
  const out: { date: string; value: number }[] = [];
  const end = Date.UTC(2026, 10, 25);
  let seed = 7;
  for (let i = 26 * 7 - 4 - 1; i >= 0; i--) {
    const ms = end - i * 86_400_000;
    const wd = new Date(ms).getUTCDay();
    seed = (seed * 9301 + 49297) % 233280;
    const r = seed / 233280;
    const value = wd === 0 ? (r > 0.9 ? 2 : 0) : r < 0.08 ? 0 : Math.round((4 + r * 5.5) * 2) / 2;
    out.push({ date: new Date(ms).toISOString().slice(0, 10), value });
  }
  return out;
})();

const NAV_COUNTS: Partial<Record<ViewId, { count: number; alert?: boolean }>> = {
  people: { count: 13 },
  billing: { count: 3, alert: true },
  mkt_deals: { count: 7 },
  eng_log: { count: 27 },
  eng_blockers: { count: 2, alert: true },
};

const ACTIONS = [
  { id: "a-log", label: "Log work", hint: "N", icon: Timer },
  { id: "a-deal", label: "Add deal", hint: "D", icon: Briefcase },
  { id: "a-visit", label: "Log a visit", hint: "V", icon: MapPin },
  { id: "a-export", label: "Export this period", hint: "", icon: Download },
];

const EMAIL_BODY = `Hi Rajiv,

Thank you for the time at Whitefield on Thursday. As discussed, we will share the revised scope for the transaction ledger by Monday, with the phased delivery plan and the support terms.

Regards,
Kamil
Axoraa`;

/* ------------------------------------------------------------------ small pieces */

function Icon({ icon: I, className }: { icon: LucideIcon; className?: string }) {
  return <I aria-hidden className={className} />;
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}

function Sidebar({ active, onNavigate, onClose, onToast }: { active: ViewId; onNavigate: (id: ViewId) => void; onClose?: () => void; onToast: (m: string) => void }) {
  const groups = navGroupsFor("admin");
  return (
    <nav aria-label="Main" className={`flex h-full flex-col overflow-hidden ${onClose ? "" : "card p-4"}`}>
      {!onClose && (
        <div className="flex items-center gap-3 px-1 pt-1">
          <BrandMark className="h-11 w-11" />
          <div>
            <div className="text-[17px] font-medium leading-none tracking-[-0.02em]">Axoraa</div>
            <div className="mt-1 text-[12px] text-ink-3">Operations Hub</div>
          </div>
        </div>
      )}

      <div className={`${onClose ? "" : "mt-5"} rounded-[20px] bg-surface-2 px-3.5 py-3`}>
        <div className="truncate text-[13.5px] font-medium">Axoraa HQ</div>
        <div className="truncate text-[12px] text-ink-3">4 founders · 9 team members</div>
      </div>

      <div className="no-scrollbar -mx-1 mt-4 flex-1 space-y-5 overflow-y-auto px-1">
        {groups.map((g) => (
          <div key={g.id}>
            {g.label && <div className="mb-1.5 px-3 text-[12px] text-ink-3">{g.label}</div>}
            <ul className="space-y-0.5">
              {g.views.map((v) => {
                const isActive = v.id === active;
                const c = NAV_COUNTS[v.id];
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate(v.id);
                        onClose?.();
                      }}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex h-11 w-full items-center gap-3 rounded-full px-3 text-[14px] transition-colors ${
                        isActive ? "bg-ink text-white" : "text-ink hover:bg-surface-2"
                      }`}
                    >
                      <span className={`[&>svg]:h-[18px] [&>svg]:w-[18px] ${isActive ? "text-lime" : "text-ink-2"}`}>
                        <Icon icon={v.icon} />
                      </span>
                      <span className="flex-1 truncate text-left">{v.label}</span>
                      {c && (
                        <span
                          className={`text-[12px] tabular-nums ${
                            c.alert
                              ? "flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1.5 text-white"
                              : isActive
                              ? "text-white/60"
                              : "text-ink-3"
                          }`}
                        >
                          {c.count}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="card-lime mt-4 rounded-[22px]! p-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-lime">
            <ShieldCheck aria-hidden className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-medium leading-tight">Super user</div>
            <div className="flex items-center gap-1.5 text-[12px] text-ink/60">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ink" />
              Synced with Google Sheets 2 min ago
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onNavigate("eng_blockers");
            onClose?.();
          }}
          className="mt-3 flex h-10 w-full items-center justify-between rounded-full bg-white px-4 text-[13px] text-ink transition-colors hover:bg-white/80"
        >
          <span>2 need your review</span>
          <ChevronRight aria-hidden className="h-3.5 w-3.5" />
        </button>
        <a href={supportMailto({ subject: "Axoraa Hub help" })} className="mt-2.5 block px-1 text-[12px] text-ink/60 hover:text-ink">
          Help: {COMPANY_EMAIL}
        </a>
      </div>

      <div className="mt-3 flex items-center gap-2.5 rounded-full bg-surface-2 p-1.5 pr-2">
        <Avatar name="Administrator" size={38} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-medium leading-tight">Administrator</div>
          <div className="truncate text-[12px] text-ink-3">Super user</div>
        </div>
        <button
          type="button"
          aria-label="Sign out"
          title="Sign out"
          onClick={() => onToast("Signing out is off on the reference page")}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-surface hover:text-coral"
        >
          <LogOut aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}

/** The floating ink pill bar below md: the role's main views and More. */
function MobileBar({ active, onNavigate, onMore, fixed }: { active: ViewId; onNavigate: (id: ViewId) => void; onMore: () => void; fixed?: boolean }) {
  const items = mobileBarFor("admin");
  const short: Partial<Record<ViewId, string>> = { overview: "Home", mkt_deals: "Deals", eng_log: "Work log", clients: "Clients" };
  return (
    <nav
      aria-label={fixed ? "Main views" : "Main views preview"}
      className={`${
        fixed ? "fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-40 md:hidden" : "relative mx-auto w-full max-w-[380px]"
      } flex h-16 items-center justify-between gap-1 rounded-full bg-ink-panel px-2 text-on-ink-panel shadow-float ring-1 ring-white/10`}
    >
      {items.map((v) => {
        const isActive = v.id === active;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onNavigate(v.id)}
            aria-current={isActive ? "page" : undefined}
            aria-label={isActive ? undefined : v.label}
            className={`flex h-12 min-w-0 items-center justify-center gap-1.5 rounded-full transition-colors [&>svg]:h-5 [&>svg]:w-5 ${
              isActive ? "max-w-[160px] flex-1 bg-white/10 px-3 text-lime" : "w-12 shrink-0 text-white/65 hover:text-white"
            }`}
          >
            <Icon icon={v.icon} />
            {isActive && <span className="truncate text-[13px] font-medium text-white">{short[v.id] ?? v.label}</span>}
          </button>
        );
      })}
      <button type="button" onClick={onMore} aria-label="More views" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white/65 hover:text-white">
        <MoreHorizontal aria-hidden className="h-5 w-5" />
      </button>
    </nav>
  );
}

function KpiCard({
  label,
  icon,
  value,
  suffix,
  deltaValue,
  deltaLabel,
  foot,
  delay = 0,
  onOpen,
}: {
  label: string;
  icon: React.ReactNode;
  value: React.ReactNode;
  suffix?: string;
  deltaValue: number | null;
  deltaLabel?: string;
  foot: string;
  delay?: number;
  onOpen: () => void;
}) {
  return (
    <div className="card flex min-h-[156px] animate-rise flex-col justify-between p-5 sm:min-h-[176px] sm:p-6" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-ink-3">{label}</span>
        <button type="button" onClick={onOpen} aria-label={`Open ${label.toLowerCase()}`} className="icon-btn icon-btn-sm [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </button>
      </div>
      <div className="mt-4">
        <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
          <span className="num text-[40px] xl:text-[36px] 2xl:text-[44px]">{value}</span>
          {suffix && <span className="mb-1.5 text-[14px] text-ink-3">{suffix}</span>}
          {deltaLabel ? (
            <span className="chip chip-lime mb-1.5">{deltaLabel}</span>
          ) : (
            <span className="mb-2">
              <Delta value={deltaValue} />
            </span>
          )}
        </div>
        <div className="mt-2 truncate text-[12.5px] text-ink-3">{foot}</div>
      </div>
    </div>
  );
}

type PaletteItem = { id: string; group: string; label: string; hint?: string; icon: LucideIcon };

/** Ctrl/⌘K, drawn as the ink card. Arrow keys move, Enter runs. */
function CommandPaletteDemo({ inputRef, onRun }: { inputRef: React.RefObject<HTMLInputElement | null>; onRun: (label: string) => void }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const items = useMemo<PaletteItem[]>(() => {
    const needle = q.trim().toLowerCase();
    const match = (s: string) => !needle || s.toLowerCase().includes(needle);
    const views = viewsFor("admin")
      .filter((v) => match(v.label))
      .slice(0, needle ? 6 : 4)
      .map((v) => ({ id: `v-${v.id}`, group: "Go to", label: v.label, hint: v.chord, icon: v.icon }));
    const actions = ACTIONS.filter((a) => match(a.label)).map((a) => ({ ...a, group: "Actions" }));
    const records = needle
      ? DEALS.filter((d) => match(d.companyName) || match(d.leadId))
          .slice(0, 4)
          .map((d) => ({ id: `r-${d.id}`, group: "Deals", label: d.companyName, hint: d.leadId, icon: Briefcase }))
      : [];
    return [...actions, ...views, ...records];
  }, [q]);
  const idx = items.length ? Math.min(active, items.length - 1) : -1;
  const groups = items.reduce<{ name: string; items: { item: PaletteItem; i: number }[] }[]>((acc, item, i) => {
    const last = acc[acc.length - 1];
    if (last && last.name === item.group) last.items.push({ item, i });
    else acc.push({ name: item.group, items: [{ item, i }] });
    return acc;
  }, []);

  return (
    <div className="card-ink p-3 sm:p-4">
      <div className="flex h-12 items-center gap-2.5 rounded-full bg-white/10 px-4">
        <Search aria-hidden className="h-4 w-4 shrink-0 text-white/50" />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded="true"
          aria-controls="ref-palette-list"
          aria-activedescendant={idx >= 0 ? `ref-palette-${items[idx].id}` : undefined}
          aria-label="Search views, actions and deals"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (items.length ? (Math.min(a, items.length - 1) + 1) % items.length : 0));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (items.length ? (Math.min(a, items.length - 1) - 1 + items.length) % items.length : 0));
            } else if (e.key === "Enter" && idx >= 0) {
              e.preventDefault();
              onRun(items[idx].label);
            }
          }}
          placeholder="Search views, actions and deals"
          className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/40"
        />
        <span className="hidden shrink-0 items-center gap-1 text-[11px] text-white/45 sm:flex">
          <kbd className="rounded-md bg-white/10 px-1.5 py-0.5 font-sans">Ctrl</kbd>
          <kbd className="rounded-md bg-white/10 px-1.5 py-0.5 font-sans">K</kbd>
        </span>
      </div>
      <div id="ref-palette-list" role="listbox" aria-label="Results" className="mt-3 max-h-[320px] overflow-y-auto">
        {groups.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-white/55">Nothing matches &ldquo;{q}&rdquo;.</p>}
        {groups.map((g) => (
          <div key={g.name} role="group" aria-label={g.name} className="mb-2 last:mb-0">
            <div className="px-3 pb-1 pt-1.5 text-[11.5px] text-white/40">{g.name}</div>
            {g.items.map(({ item, i }) => {
              const on = i === idx;
              return (
                <div
                  key={item.id}
                  id={`ref-palette-${item.id}`}
                  role="option"
                  aria-selected={on}
                  onMouseMove={() => setActive(i)}
                  onClick={() => onRun(item.label)}
                  className={`relative flex h-11 cursor-pointer items-center gap-3 rounded-[14px] px-3 text-[13.5px] transition-colors ${
                    on ? "bg-ink-panel-2 text-white" : "text-white/75"
                  }`}
                >
                  <span aria-hidden className={`absolute left-1 h-1.5 w-1.5 rounded-full ${on ? "bg-lime" : "bg-transparent"}`} />
                  <span className={`[&>svg]:h-4 [&>svg]:w-4 ${on ? "text-lime" : "text-white/50"}`}>
                    <Icon icon={item.icon} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.hint && <span className="shrink-0 font-mono text-[11.5px] text-white/40">{item.hint}</span>}
                  {on && <CornerDownLeft aria-hidden className="h-3.5 w-3.5 shrink-0 text-white/50" />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function followChip(d: MarketingDeal): string {
  const t = toneForDue(d.dueStatus);
  return t === "negative" ? "chip-coral" : t === "warning" ? "chip-amber" : "";
}

/* ------------------------------------------------------------------ page */

export function ReferencePage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { pref, resolved, setPref } = useTheme();
  const paletteRef = useRef<HTMLInputElement>(null);

  const [nav, setNav] = useState<ViewId>("overview");
  const [navOpen, setNavOpen] = useState(false);
  const [granularity, setGranularity] = useState<Granularity>("week");
  const [metric, setMetric] = useState<"hours" | "entries">("hours");

  const [deals, setDeals] = useState(DEALS);
  const [selected, setSelected] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | undefined>(undefined);
  const [unsynced, setUnsynced] = useState<Set<string>>(() => new Set(["deal-web-1"]));
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<BoardStage | null>(null);
  const [query, setQuery] = useState("");
  const flashCount = useRef(0);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(true);

  const [company, setCompany] = useState("Zeta AI Labs");
  const [phone, setPhone] = useState("98450 1122");
  const [value, setValue] = useState<number | null>(2800000);
  const [stage, setStage] = useState("Negotiation");
  const [client, setClient] = useState<(typeof INITIAL_CLIENT_MASTER)[number] | null>(INITIAL_CLIENT_MASTER[0] ?? null);
  const [notify, setNotify] = useState(true);
  const [decisionMaker, setDecisionMaker] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const phoneError = submitted && phone.replace(/\D/g, "").length !== 10 ? "Enter a 10-digit mobile number, for example 98450 12345" : undefined;

  // Ctrl/⌘K jumps to the palette demo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        paletteRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
        paletteRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const columns = DAYS.map((d, i) => ({
    label: d.label,
    title: d.title,
    value: metric === "hours" ? HOURS[i] : ENTRIES[i],
    current: i === 2,
    detail: metric === "hours" ? `${ENTRIES[i]} entries` : `${formatNumber(HOURS[i], 1)} hrs`,
  }));

  const selectedDeal = deals.find((d) => d.id === selected) ?? null;
  const tableRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return deals.filter((d) => !q || d.companyName.toLowerCase().includes(q) || d.contactPerson.toLowerCase().includes(q) || d.leadId.toLowerCase().includes(q));
  }, [deals, query]);

  const simulateSave = (id: string) => {
    flashCount.current += 1;
    setFlash(`${id}:${flashCount.current}`);
  };

  const moveDeal = (d: MarketingDeal, to: MarketingDeal["leadStatus"]) => {
    if (d.leadStatus === to) return;
    const before = d.leadStatus;
    setDeals((list) => list.map((x) => (x.id === d.id ? { ...x, leadStatus: to } : x)));
    simulateSave(d.id);
    toast({
      message: `Moved ${d.companyName} to ${to === "Closed Won" ? "Won" : to}`,
      tone: "positive",
      action: {
        label: "Undo",
        onClick: () => {
          setDeals((list) => list.map((x) => (x.id === d.id ? { ...x, leadStatus: before } : x)));
          simulateSave(d.id);
        },
      },
    });
  };

  const deleteDeal = async (d: MarketingDeal) => {
    const ok = await confirm({
      title: `Delete ${d.companyName}?`,
      body: `The deal ${d.leadId} and its 3 logged visits will be removed for everyone. This can't be undone.`,
      confirmLabel: "Delete deal",
      tone: "danger",
    });
    if (ok) {
      setDeals((list) => list.filter((x) => x.id !== d.id));
      toast({ message: `Deleted ${d.companyName}` });
    }
  };

  const openDeal = (d: MarketingDeal) => {
    setSelected(d.id);
    setSheetOpen(true);
  };

  const tableColumns: TableColumn<MarketingDeal>[] = [
    {
      id: "company",
      header: "Company",
      sortValue: (d) => d.companyName,
      cell: (d) => (
        <span className="flex min-w-0 items-center gap-3">
          <Avatar name={d.companyName} size={34} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-ink">{d.companyName}</span>
            <span className="truncate text-[12px] text-ink-3">
              <span className="font-mono">{d.leadId}</span> · {d.city}
            </span>
          </span>
        </span>
      ),
    },
    {
      id: "stage",
      header: "Stage",
      sortValue: (d) => d.leadStatus,
      cell: (d) => <StatusDot tone={toneForStage(d.leadStatus)} label={d.leadStatus === "Closed Won" ? "Won" : d.leadStatus === "Closed Lost" ? "Lost" : d.leadStatus} />,
    },
    {
      id: "owner",
      header: "Owner",
      hideBelow: "lg",
      sortValue: (d) => d.marketingPerson,
      cell: (d) => (
        <span className="inline-flex items-center gap-2">
          <Avatar name={d.marketingPerson} size={24} />
          {d.marketingPerson}
        </span>
      ),
    },
    {
      id: "source",
      header: "Source",
      hideBelow: "lg",
      sortValue: (d) => d.leadSource,
      cell: (d) => (
        <span className="inline-flex items-center gap-2 whitespace-nowrap text-ink-2">
          {SOURCE_ICON[d.leadSource] ?? <Globe aria-hidden className="size-4 text-ink-3" />}
          {SOURCE_LABEL[d.leadSource] ?? d.leadSource}
        </span>
      ),
    },
    { id: "value", header: "Value", align: "right", sortValue: (d) => d.estimatedDealValue, cell: (d) => <span className="font-medium">{formatInrFull(d.estimatedDealValue)}</span> },
    {
      id: "followup",
      header: "Next follow-up",
      sortValue: (d) => d.nextFollowUpDate,
      cell: (d) => <span className={`chip ${followChip(d)}`}>{dueText(d, TODAY)}</span>,
    },
  ];

  const boardTotal = (s: BoardStage) => deals.filter((d) => d.leadStatus === s).reduce((n, d) => n + d.estimatedDealValue, 0);

  return (
    <div className="flex min-h-dvh gap-3 bg-canvas p-2.5 sm:p-3 lg:gap-4 lg:p-4">
      <aside className="no-print sticky top-4 hidden h-[calc(100dvh-2rem)] w-[280px] shrink-0 lg:block">
        <Sidebar active={nav} onNavigate={setNav} onToast={(m) => toast({ message: m })} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-28 md:pb-6">
        {/* Reference strip */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-surface/70 sm:rounded-full py-1.5 pl-4 pr-1.5 text-[12.5px] text-ink-2 shadow-card">
          <span className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-lime ring-2 ring-ink/10" />
            <span className="truncate">Design reference · mock data · development only</span>
          </span>
          <Segmented<ThemePref>
            label="Theme"
            size="sm"
            value={pref}
            onChange={setPref}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </div>

        {/* Header, as the shell draws it */}
        <header className="flex flex-col justify-between gap-4 px-1 pb-5 pt-2 sm:px-2 sm:pb-6 xl:flex-row xl:items-end">
          <div className="flex min-w-0 items-start gap-3">
            <button type="button" className="icon-btn mt-1 shrink-0 lg:hidden" aria-label="Open menu" onClick={() => setNavOpen(true)}>
              <MenuIcon aria-hidden className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="title-xl break-words">Command Center</h1>
              <p className="mt-2.5 text-[14px] text-ink-2">Everything the team shipped, sold and collected — by week, month or year.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip chip-good h-10 px-4" title="Synced with Google Sheets 2 min ago">
              <span aria-hidden className="h-2 w-2 rounded-full bg-good" />
              Google Sheet
            </span>
            <button type="button" className="icon-btn" aria-label="Google Sheets" onClick={() => toast({ message: "Opens Integrations" })}>
              <Database aria-hidden className="h-4 w-4" />
            </button>
            <button type="button" className="icon-btn" aria-label="Search (Ctrl K)" onClick={() => paletteRef.current?.focus()}>
              <Search aria-hidden className="h-4 w-4" />
            </button>
            <button type="button" className="btn btn-ink" onClick={() => setLogOpen(true)}>
              <Plus aria-hidden className="h-4 w-4" />
              Log work
            </button>
          </div>
        </header>

        <main className="min-w-0 space-y-3 sm:space-y-4">
          {/* Period bar */}
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <PeriodPicker
              granularity={granularity}
              onGranularity={setGranularity}
              granularities={["week", "month", "year"]}
              range={rangeFor(granularity)}
              onShift={(dir) => toast({ message: dir < 0 ? "Moved back one period (mock data stays the same)" : "Moved forward one period" })}
              onToday={() => setGranularity("week")}
            />
            <div className="flex items-center gap-2 px-1 text-[12.5px] text-ink-3">
              <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-good" />
              Compared with previous {granularity}
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            <div className="card-ink flex min-h-[156px] animate-rise flex-col justify-between p-5 sm:min-h-[176px] sm:p-6">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-white/55">Hours logged</span>
                <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lime">
                  <Timer className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-4">
                <div className="flex items-end gap-2">
                  <span className="num text-[48px] sm:text-[56px]">{formatNumber(46.5, 1)}</span>
                  <span className="mb-1.5 text-[14px] text-white/50">hrs</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-white/55">
                  <Delta value={12} dark /> · 5 contributors · 3 active days
                </div>
              </div>
            </div>
            <KpiCard
              label="Tasks completed"
              icon={<CheckCircle2 aria-hidden />}
              value={18}
              suffix="/ 27"
              deltaValue={9}
              foot="67% completion rate"
              delay={60}
              onOpen={() => setNav("eng_log")}
            />
            <KpiCard
              label="Open pipeline"
              icon={<GitPullRequestArrow aria-hidden />}
              value={formatInr(12400000)}
              deltaValue={-4}
              foot={`Weighted ${formatInr(5120000)} · 6 new leads`}
              delay={120}
              onOpen={() => setNav("mkt")}
            />
            <KpiCard
              label="Collected"
              icon={<BadgeIndianRupee aria-hidden />}
              value={formatInr(4860000)}
              deltaValue={null}
              deltaLabel="72% of invoiced"
              foot={`${formatInr(1270000)} pending · ${formatInr(620000)} overdue`}
              delay={180}
              onOpen={() => setNav("billing")}
            />
          </div>

          {/* Output chart + collections gauge */}
          <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-12">
            <section className="card min-w-0 animate-rise p-5 sm:p-6 xl:col-span-8">
              <CardHeader
                icon={<Clock3 />}
                title="Team output"
                subtitle={`${metric === "hours" ? "Hours" : "Entries"} per day · vs last week`}
                action={
                  <Segmented
                    size="sm"
                    label="Measure"
                    value={metric}
                    onChange={setMetric}
                    options={[
                      { value: "hours", label: "Hours" },
                      { value: "entries", label: "Entries" },
                    ]}
                  />
                }
              />
              <div className="mt-7">
                <ColumnChart
                  ariaLabel={`Team ${metric} per day this week compared with last week`}
                  data={columns}
                  compare={metric === "hours" ? HOURS_PREV : ENTRIES_PREV}
                  target={metric === "hours" ? 16 : undefined}
                  format={(v) => (metric === "hours" ? `${formatNumber(v, 1)}h` : formatNumber(v))}
                  height={240}
                  seriesLabel="This week"
                  compareLabel="Last week"
                  targetLabel="Daily target"
                />
              </div>
              <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { k: "Entries", v: 27 },
                  { k: "In progress", v: 7 },
                  { k: "Awaiting review", v: 4 },
                  { k: "Shipped to prod", v: 3 },
                ].map((s) => (
                  <div key={s.k} className="card-inset px-4 py-3">
                    <div className="text-[12px] text-ink-3">{s.k}</div>
                    <div className="num mt-1 text-[26px]">{s.v}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card-lime flex animate-rise flex-col p-5 sm:p-6 xl:col-span-4" style={{ animationDelay: "80ms" }}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[17px] font-medium tracking-[-0.02em]">Collections</h3>
                  <p className="mt-1 text-[12.5px] text-ink/60">All invoices to date</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNav("billing")}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-ink/10 transition-colors hover:bg-ink/15"
                  aria-label="Open invoices"
                >
                  <ArrowUpRight aria-hidden className="h-4 w-4" />
                </button>
              </div>
              <div className="relative mx-auto mt-4 w-full max-w-[300px]">
                <TickGauge value={72} ariaLabel="Collected" />
                <div className="absolute inset-x-0 bottom-1 text-center">
                  <div className="num text-[52px]">
                    72<span className="ml-0.5 align-top text-[24px]">%</span>
                  </div>
                  <div className="-mt-0.5 text-[12px] text-ink/60">collected</div>
                </div>
              </div>
              <div className="mt-auto space-y-2 pt-5">
                {[
                  { k: "Invoiced", v: 6750000 },
                  { k: "Received", v: 4860000 },
                  { k: "Overdue", v: 620000 },
                ].map((r) => (
                  <div key={r.k} className="flex h-10 items-center justify-between rounded-full bg-white/85 px-4 text-[13px]">
                    <span className="text-ink-2">{r.k}</span>
                    <span className="font-medium tabular-nums">{formatInr(r.v)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Team table + attention */}
          <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-12">
            <section className="card min-w-0 p-5 sm:p-6 xl:col-span-8">
              <CardHeader
                icon={<Users />}
                title="Who did what"
                subtitle="This week, per person"
                action={
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNav("people")}>
                    All people <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                  </button>
                }
              />
              <div className="-mx-2 mt-5 hidden md:block">
                <table className="table-clean">
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th className="text-right">Entries</th>
                      <th className="text-right">Hours</th>
                      <th className="w-[26%]">Status split</th>
                      <th>Trend</th>
                      <th>
                        <span className="sr-only">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {TEAM.map((p) => (
                      <tr key={p.name}>
                        <td>
                          <div className="flex items-center gap-3">
                            <Avatar name={p.name} size={34} />
                            <div className="min-w-0">
                              <div className="truncate font-medium">{p.name}</div>
                              <div className="text-[12px] text-ink-3">{p.blocked ? `${p.blocked} blocked` : `${p.review} in review`}</div>
                            </div>
                          </div>
                        </td>
                        <td className="text-right tabular-nums">{p.entries}</td>
                        <td className="text-right font-medium tabular-nums">{formatNumber(p.hours, 1)}</td>
                        <td>
                          <SplitBar
                            parts={[
                              { key: "c", value: p.completed, className: "bg-ink", label: "Completed" },
                              { key: "p", value: p.inProgress, className: "bg-lime", label: "In progress" },
                              { key: "b", value: p.blocked, className: "bg-coral", label: "Blocked" },
                            ]}
                          />
                        </td>
                        <td>
                          <Sparkline values={p.series} width={96} height={28} ariaLabel={`${p.name}, hours over the last 7 days`} />
                        </td>
                        <td className="text-right">
                          <button type="button" className="icon-btn icon-btn-sm" aria-label={`Open ${p.name}'s dashboard`} onClick={() => toast({ message: `Opens /u/${p.name.toLowerCase()}` })}>
                            <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Phones: stacked rounded rows */}
              <ul className="mt-5 space-y-2 md:hidden">
                {TEAM.map((p) => (
                  <li key={p.name} className="rounded-[18px] bg-surface-2 px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={p.name} size={34} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{p.name}</div>
                        <div className="text-[12px] text-ink-3">
                          {p.entries} entries · {p.blocked ? `${p.blocked} blocked` : `${p.review} in review`}
                        </div>
                      </div>
                      <span className="num text-[24px]">
                        {formatNumber(p.hours, 1)}
                        <span className="ml-0.5 text-[12px] tracking-normal text-ink-3">h</span>
                      </span>
                    </div>
                    <div className="mt-3">
                      <SplitBar
                        height={10}
                        parts={[
                          { key: "c", value: p.completed, className: "bg-ink", label: "Completed" },
                          { key: "p", value: p.inProgress, className: "bg-lime", label: "In progress" },
                          { key: "b", value: p.blocked, className: "bg-coral", label: "Blocked" },
                        ]}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-4 px-0 pt-4 text-[12px] text-ink-3 md:px-2">
                <Legend className="bg-ink" label="Completed" />
                <Legend className="bg-lime" label="In progress" />
                <Legend className="bg-coral" label="Blocked" />
              </div>
            </section>

            <section className="card-ink flex flex-col p-5 sm:p-6 xl:col-span-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[13px]">
                  <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-lime text-on-lime">
                    <BellRing className="h-3.5 w-3.5" />
                  </span>
                  Needs attention
                </div>
                <span className="text-[12px] text-white/45">live</span>
              </div>
              <h3 className="mt-5 text-[26px] font-medium leading-[1.1] tracking-[-0.03em]">{ATTENTION.length} things need your attention</h3>
              <ul className="mt-5 flex-1 space-y-3">
                {ATTENTION.map((a) => (
                  <li key={a.text}>
                    <button
                      type="button"
                      onClick={() => setNav(a.go)}
                      className="group flex w-full items-center gap-3 text-left text-[13.5px] text-white/80 hover:text-white"
                    >
                      <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${a.tone}`} />
                      <span className="flex-1">{a.text}</span>
                      <ArrowRight aria-hidden className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => setNav(ATTENTION[0].go)} className="btn btn-lime mt-6 self-start">
                Review now
              </button>
            </section>
          </div>

          {/* Marketing + delivery */}
          <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2 xl:grid-cols-12">
            <section className="card min-w-0 p-5 sm:p-6 xl:col-span-5">
              <CardHeader
                title="Sales funnel"
                subtitle={`24 leads · 4 won · ${formatInr(4300000)} closed`}
                action={
                  <button type="button" className="icon-btn" aria-label="Open deals" onClick={() => setNav("mkt_deals")}>
                    <ArrowUpRight aria-hidden className="h-4 w-4" />
                  </button>
                }
              />
              <div className="mt-6">
                <FunnelChart steps={FUNNEL} ariaLabel="Sales funnel by stage" />
              </div>
            </section>

            <section className="card flex min-w-0 flex-col p-5 sm:p-6 xl:col-span-3">
              <CardHeader title="Field activity" subtitle="38 touchpoints · 11 on-site" />
              <div className="mt-5 flex items-baseline gap-2">
                <span className="num text-[44px]">38</span>
                <Delta value={15} />
              </div>
              <div className="mt-auto pt-6">
                <DotMatrix data={TOUCHES} unit=" touchpoints" ariaLabel="Touchpoints per day, 14 to 25 Nov" />
              </div>
            </section>

            <section className="card min-w-0 p-5 sm:p-6 lg:col-span-2 xl:col-span-4">
              <CardHeader
                title="Delivery"
                subtitle={`${PROJECTS.length} projects`}
                action={
                  <button type="button" className="icon-btn" aria-label="Open clients" onClick={() => setNav("clients")}>
                    <ArrowUpRight aria-hidden className="h-4 w-4" />
                  </button>
                }
              />
              <ul className="mt-5 space-y-4">
                {PROJECTS.map((p) => (
                  <li key={p.name}>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="truncate pr-3">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-ink-3"> · {p.manager}</span>
                      </span>
                      <span className="tabular-nums text-ink-2">{p.pct}%</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className={`h-full origin-left animate-grow-x rounded-full ${p.status === "Completed" ? "bg-ink" : p.status === "On Hold" ? "bg-coral" : "bg-lime"}`}
                        style={{ width: `${p.pct}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Export strip */}
          <section className="card flex flex-col justify-between gap-4 p-5 sm:p-6 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lime text-on-lime">
                <FileDown className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="text-[16px] font-medium tracking-[-0.02em]">Export this period</div>
                <div className="text-[12.5px] text-ink-3">Work logs, deals, visits, invoices — as CSV for Excel or Sheets</div>
              </div>
            </div>
            <button type="button" className="btn btn-ink self-start md:self-auto" onClick={() => setNav("exports")}>
              Open export center <ArrowRight aria-hidden className="h-4 w-4" />
            </button>
          </section>

          {/* ====================================================== New in this upgrade */}
          <section aria-labelledby="ref-new" className="space-y-3 pt-8 sm:space-y-4 sm:pt-10">
            <div className="px-1 sm:px-2">
              <span className="chip chip-lime">New in this upgrade</span>
              <h2 id="ref-new" className="title-xl mt-4">
                Same look, more to do
              </h2>
              <p className="mt-2.5 max-w-2xl text-[14px] text-ink-2">
                Deal tracker board, tables you can sort, the command bar, side sheets, toasts with Undo, dark mode and real empty and error states — all in the original
                cards, pills and charts.
              </p>
            </div>

            <SummaryBand
              ariaLabel="Pipeline summary"
              items={[
                { label: "Open pipeline", value: formatInr(12400000), compare: { text: "+₹18.2 L vs last month", tone: "positive" } },
                { label: "Weighted value", value: formatInr(5120000), compare: { text: "+₹3.1 L vs last month", tone: "positive" } },
                { label: "Won this month", value: formatInr(4300000), compare: { text: "2 deals, same as October" } },
                { label: "Visits logged", value: "48", compare: { text: "−6 vs last month", tone: "negative" } },
                { label: "Follow-ups overdue", value: "2", compare: { text: "Oldest is 4 days late", tone: "negative" }, onClick: () => setNav("mkt_deals") },
              ]}
            />

            {/* Deal tracker board */}
            <section className="card min-w-0 p-5 sm:p-6">
              <CardHeader
                icon={<Briefcase />}
                title="Deal tracker"
                subtitle="Drag cards between stages"
                action={
                  <button type="button" className="btn btn-ink btn-sm" aria-label="Add deal" onClick={() => (setSelected(null), setSheetOpen(true))}>
                    <Plus aria-hidden className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Add deal</span>
                  </button>
                }
              />
              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                {BOARD_STAGES.map((s) => {
                  const list = deals.filter((d) => d.leadStatus === s);
                  const other: BoardStage = s === "Proposal Sent" ? "Negotiation" : "Proposal Sent";
                  return (
                    <div
                      key={s}
                      onDragOver={(e) => {
                        if (!dragId) return;
                        e.preventDefault();
                        if (overStage !== s) setOverStage(s);
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverStage(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const d = deals.find((x) => x.id === dragId);
                        if (d) moveDeal(d, s);
                        setDragId(null);
                        setOverStage(null);
                      }}
                      className={`min-w-0 rounded-[22px] bg-surface-2 p-3 transition-shadow ${overStage === s ? "shadow-[inset_0_0_0_2px_var(--color-lime)]" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2 px-2 pb-3 pt-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-[14px] font-medium">{s}</span>
                          <span className="chip chip-outline">{list.length}</span>
                        </div>
                        <span className="text-[13px] font-medium tabular-nums text-ink-2">{formatInr(boardTotal(s))}</span>
                      </div>
                      <ul className="space-y-2">
                        {list.length === 0 && (
                          <li className="dashed-slot rounded-[18px] px-4 py-6 text-center text-[13px] text-ink-3">Drop a deal here</li>
                        )}
                        {list.map((d) => (
                          <li
                            key={`${d.id}${flash?.startsWith(`${d.id}:`) ? flash : ""}`}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", d.id);
                              setDragId(d.id);
                            }}
                            onDragEnd={() => {
                              setDragId(null);
                              setOverStage(null);
                            }}
                            className={`card-interactive cursor-grab rounded-[18px] bg-surface p-4 shadow-card active:cursor-grabbing ${dragId === d.id ? "opacity-50" : ""} ${
                              flash?.startsWith(`${d.id}:`) ? "animate-flash" : ""
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <button type="button" onClick={() => openDeal(d)} className="min-w-0 flex-1 text-left">
                                <span className="block truncate text-[14px] font-medium">{d.companyName}</span>
                                <span className="block truncate text-[12px] text-ink-3">
                                  {d.contactPerson} · {d.city}
                                </span>
                              </button>
                              <button type="button" className="icon-btn icon-btn-sm" aria-label={`Move ${d.companyName} to ${other}`} onClick={() => moveDeal(d, other)}>
                                <MoveRight aria-hidden className={`h-3.5 w-3.5 ${s === "Negotiation" ? "rotate-180" : ""}`} />
                              </button>
                            </div>
                            <div className="mt-3 flex items-end justify-between gap-2">
                              <span className="num text-[24px]">{formatInr(d.estimatedDealValue)}</span>
                              <span className="flex items-center gap-2">
                                <span className={`chip ${followChip(d)}`}>{dueText(d, TODAY)}</span>
                                <Avatar name={d.marketingPerson} size={26} />
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* DataTable */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <label className="relative w-full sm:w-72">
                  <span className="sr-only">Search deals</span>
                  <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
                  <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search deals or lead ID" className="field pl-10" />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => simulateSave("deal-3")}>
                    Show saved-row flash
                  </button>
                  <DensityToggle />
                </div>
              </div>
              <DataTable
                caption="Deals"
                rows={tableRows}
                columns={tableColumns}
                rowKey={(d) => d.id}
                selectedKey={selected}
                flashKey={flash}
                onRowClick={openDeal}
                rowStatus={(d) => (unsynced.has(d.id) ? "unsynced" : undefined)}
                onRetry={(d) => {
                  setUnsynced((s) => {
                    const n = new Set(s);
                    n.delete(d.id);
                    return n;
                  });
                  simulateSave(d.id);
                  toast({ message: `Saved ${d.companyName} to Google Sheets`, tone: "positive" });
                }}
                rowLabel={(d) => d.companyName}
                rowActions={(d) => [
                  { label: "Open deal", icon: <Pencil />, onSelect: () => openDeal(d), shortcut: "Enter" },
                  { label: "Log visit", icon: <MapPin />, onSelect: () => toast({ message: `Opened a visit for ${d.companyName}` }) },
                  { label: "Move to Won", icon: <Briefcase />, onSelect: () => moveDeal(d, "Closed Won"), disabled: d.leadStatus === "Closed Won" },
                  { label: "Delete deal", icon: <Trash2 />, tone: "danger", separatorBefore: true, onSelect: () => void deleteDeal(d) },
                ]}
                mobileCard={(d) => (
                  <div className="min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[14px] font-medium text-ink">{d.companyName}</span>
                      <span className="shrink-0 text-[14px] font-medium tabular-nums text-ink">{formatInr(d.estimatedDealValue)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-ink-2">
                      <StatusDot tone={toneForStage(d.leadStatus)} label={d.leadStatus === "Closed Won" ? "Won" : d.leadStatus} />
                      <span className={`chip ${followChip(d)}`}>{dueText(d, TODAY)}</span>
                    </div>
                  </div>
                )}
                empty={
                  <EmptyState
                    icon={<Search />}
                    title={`No deals match "${query}"`}
                    body="Check the spelling or search by lead ID."
                    action={
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQuery("")}>
                        Clear search
                      </button>
                    }
                  />
                }
                footer={`${tableRows.length} deals · ${formatInrFull(tableRows.reduce((s, d) => s + d.estimatedDealValue, 0))} in all`}
              />
            </div>

            {/* Command palette + overlays */}
            <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-12">
              <div className="min-w-0 space-y-3 xl:col-span-7">
                <div className="flex items-center gap-2 px-1 text-[13px] text-ink-2">
                  <Kbd>Ctrl</Kbd>
                  <Kbd>K</Kbd>
                  <span>Command bar: jump anywhere, run an action, find a deal</span>
                </div>
                <CommandPaletteDemo inputRef={paletteRef} onRun={(label) => toast({ message: `Ran "${label}"` })} />
              </div>

              <section className="card min-w-0 p-5 sm:p-6 xl:col-span-5">
                <CardHeader title="Sheets, dialogs and menus" subtitle="Tab, arrows and Escape work everywhere" />
                <div className="mt-5 flex flex-wrap gap-2">
                  <button type="button" className="btn btn-ink btn-sm" onClick={() => openDeal(deals.find((d) => d.id === "deal-3") ?? deals[0])}>
                    Open sheet
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLogOpen(true)}>
                    Open dialog
                  </button>
                  <Menu
                    label="Export"
                    align="start"
                    trigger={
                      <>
                        <Download aria-hidden />
                        Export
                      </>
                    }
                    items={[
                      { label: "Deals as CSV", icon: <FileText />, onSelect: () => toast({ message: "Downloaded deals.csv" }) },
                      { label: "Visits as CSV", icon: <MapPin />, onSelect: () => toast({ message: "Downloaded visits.csv" }) },
                      { label: "Full backup", icon: <Download />, shortcut: "Ctrl B", onSelect: () => toast({ message: "Downloaded the backup" }) },
                      { label: "Print summary", icon: <Printer />, disabled: true },
                    ]}
                  />
                  <Popover
                    label="Filter by owner"
                    trigger={
                      <>
                        <SlidersHorizontal aria-hidden />
                        Owner
                      </>
                    }
                  >
                    {(close) => (
                      <div className="space-y-3">
                        <p className="text-[13px] font-medium text-ink">Owner</p>
                        <Checkbox checked label="Kamil" onChange={() => {}} />
                        <Checkbox checked label="Anusha" onChange={() => {}} />
                        <Checkbox checked={false} label="Unassigned" description="Meta Lead Ads waiting for a rep" onChange={() => {}} />
                        <div className="flex justify-end gap-2 border-t border-line pt-3">
                          <button type="button" className="btn btn-ghost btn-sm" onClick={close}>
                            Cancel
                          </button>
                          <button type="button" className="btn btn-ink btn-sm" onClick={close}>
                            Apply
                          </button>
                        </div>
                      </div>
                    )}
                  </Popover>
                </div>
                <div className="mt-5 border-t border-line pt-5">
                  <p className="text-[12px] text-ink-3">Toasts</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        const d = deals.find((x) => x.leadStatus === "Proposal Sent");
                        if (d) moveDeal(d, "Negotiation");
                      }}
                    >
                      With Undo
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => toast({ message: "Saved the work log", tone: "positive" })}>
                      Saved
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => toast({ message: "Couldn't reach Google Sheets. Your change is saved on this device.", tone: "negative" })}
                    >
                      Error
                    </button>
                    <button type="button" className="btn btn-coral btn-sm" onClick={() => deals[0] && void deleteDeal(deals[0])}>
                      Confirm delete
                    </button>
                  </div>
                </div>
              </section>
            </div>

            {/* Chips, buttons, status */}
            <section className="card min-w-0 p-5 sm:p-6">
              <CardHeader title="Pills, chips and status" subtitle="Ink first, lime once, coral for alerts" />
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button type="button" className="btn btn-ink">
                  <Plus aria-hidden /> Log work
                </button>
                <button type="button" className="btn btn-lime">
                  Review now
                </button>
                <button type="button" className="btn btn-ghost">
                  <Download aria-hidden /> Export CSV
                </button>
                <button type="button" className="btn btn-plain">
                  Cancel
                </button>
                <button type="button" className="btn btn-coral">
                  Delete deal
                </button>
                <button type="button" className="btn btn-ink" disabled>
                  Saving
                </button>
                <button type="button" className="icon-btn" aria-label="Open">
                  <ArrowUpRight aria-hidden />
                </button>
                <button type="button" className="icon-btn icon-btn-sm" aria-label="Filters">
                  <SlidersHorizontal aria-hidden />
                </button>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-5">
                <span className="chip">Draft</span>
                <span className="chip chip-lime">Scheduled</span>
                <span className="chip chip-ink">Kannada</span>
                <span className="chip chip-good">Paid</span>
                <span className="chip chip-amber">Due in 3 days</span>
                <span className="chip chip-coral">Overdue</span>
                <span className="chip chip-outline">LinkedIn</span>
                <Badge tone="accent">New</Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusDot tone="neutral" label="New lead" />
                <StatusDot tone="accent" label="In progress" />
                <StatusDot tone="positive" label="Completed" />
                <StatusDot tone="warning" label="Client review" />
                <StatusDot tone="negative" label="Blocked" />
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-5 text-[13px] text-ink-2">
                <span className="inline-flex items-center gap-2">
                  <Delta value={12} baseline="Oct" />
                </span>
                <span className="inline-flex items-center gap-2">
                  <Delta value={-8} />
                </span>
                <span className="inline-flex items-center gap-2">
                  Overdue <Delta value={20} invert />
                </span>
                <span className="inline-flex items-center gap-2">
                  <Delta value={null} />
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Kbd>N</Kbd> Log work
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Kbd>/</Kbd> Search
                </span>
              </div>
            </section>

            {/* Charts */}
            <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
              <section className="card min-w-0 p-5 sm:p-6">
                <CardHeader title="Collections by month" subtitle="Paid, due and overdue, June to November" />
                <div className="mt-6">
                  <StackedBars ariaLabel="Collections by month, paid, due and overdue" data={COLLECTIONS} format={(v) => formatInr(v)} height={220} />
                </div>
              </section>
              <section className="card min-w-0 p-5 sm:p-6">
                <CardHeader
                  title="Manish, hours logged"
                  subtitle="Last 26 weeks · Monday to Sunday"
                  action={
                    <button type="button" className="icon-btn" aria-label="Open Manish's dashboard" onClick={() => toast({ message: "Opens /u/manish" })}>
                      <ArrowUpRight aria-hidden className="h-4 w-4" />
                    </button>
                  }
                />
                <div className="mt-6">
                  <Heatmap ariaLabel="Hours logged by Manish per day over the last 26 weeks" cells={HEAT_CELLS} unit="h" />
                </div>
                <div className="mt-6 grid grid-cols-3 gap-2">
                  {[
                    { k: "This week", v: "14.5h" },
                    { k: "Average day", v: "6.2h" },
                    { k: "Longest streak", v: "23d" },
                  ].map((s) => (
                    <div key={s.k} className="card-inset min-w-0 px-3 py-3 sm:px-4">
                      <div className="truncate text-[12px] text-ink-3">{s.k}</div>
                      <div className="num mt-1 text-[22px] sm:text-[26px]">{s.v}</div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* States */}
            <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
              <section className="card min-w-0 p-5">
                <p className="text-[12px] text-ink-3">Empty</p>
                <EmptyState
                  className="py-8!"
                  icon={<MapPin />}
                  title="No visits logged this week"
                  action={
                    <button type="button" className="btn btn-ink btn-sm">
                      <Plus aria-hidden /> Log a visit
                    </button>
                  }
                />
              </section>
              <section className="card min-w-0 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] text-ink-3">Loading</p>
                  <button type="button" className="btn btn-plain btn-sm" onClick={() => setLoadingDemo((v) => !v)}>
                    {loadingDemo ? "Show data" : "Reload"}
                  </button>
                </div>
                <div className="mt-4">
                  {loadingDemo ? (
                    <DelayedSkeleton delay={0}>
                      <SkeletonBand count={2} />
                    </DelayedSkeleton>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="card-inset p-4">
                        <div className="text-[12px] text-ink-3">Visits</div>
                        <div className="num mt-3 text-[30px]">48</div>
                      </div>
                      <div className="card-inset p-4">
                        <div className="text-[12px] text-ink-3">Won</div>
                        <div className="num mt-3 text-[30px]">4</div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
              <section className="card min-w-0 p-5">
                <p className="text-[12px] text-ink-3">Error</p>
                <div className="mt-4 rounded-inset bg-coral-soft p-4">
                  <div className="flex items-start gap-3">
                    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-coral text-white">
                      <RefreshCw className="h-4 w-4" />
                    </span>
                    <p className="min-w-0 text-[13.5px] text-ink">Couldn&apos;t reach Google Sheets. Showing what&apos;s saved on this device.</p>
                  </div>
                  <button type="button" className="btn btn-ink btn-sm mt-4" onClick={() => toast({ message: "Synced with Google Sheets", tone: "positive" })}>
                    Try again
                  </button>
                </div>
              </section>
              <section className="card min-w-0 p-5">
                <p className="text-[12px] text-ink-3">Not configured</p>
                <div className="mt-4 rounded-inset bg-amber-soft p-4">
                  <div className="flex items-start gap-3">
                    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber text-ink">
                      <Plug className="h-4 w-4" />
                    </span>
                    <p className="min-w-0 text-[13.5px] text-ink">
                      The Assistant needs an API key on the server. Ask the administrator or write to{" "}
                      <a href={supportMailto({ subject: "Assistant setup" })} className="font-medium underline underline-offset-2">
                        {COMPANY_EMAIL}
                      </a>
                      .
                    </p>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm mt-4" onClick={() => setNav("integrations")}>
                    Open integrations
                  </button>
                </div>
              </section>
            </div>

            {/* Forms + draft */}
            <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-12">
              <form
                className="card min-w-0 p-5 sm:p-6 xl:col-span-7"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  setSubmitted(true);
                  if (phone.replace(/\D/g, "").length === 10) toast({ message: "Saved the deal", tone: "positive" });
                }}
              >
                <CardHeader title="Form fields" subtitle="Labels above, errors below" />
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {phoneError && (
                    <div className="md:col-span-2">
                      <ErrorSummary errors={[{ field: "ref-phone", message: "Mobile number needs 10 digits" }]} />
                    </div>
                  )}
                  <Field label="Company" htmlFor="ref-company" required>
                    <Input id="ref-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Apex FinTech Solutions" />
                  </Field>
                  <Field label="Mobile number" htmlFor="ref-phone" error={phoneError} hint={phoneError ? undefined : "Used for WhatsApp follow-ups"}>
                    <Input id="ref-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98450 12345" />
                  </Field>
                  <Field label="Deal value" htmlFor="ref-value" hint="Shown in full on the deal, short in summaries">
                    <MoneyInput id="ref-value" value={value} onChange={setValue} />
                  </Field>
                  <Field label="Stage" htmlFor="ref-stage">
                    <Select id="ref-stage" value={stage} onChange={(e) => setStage(e.target.value)}>
                      {["New Lead", "Contacted", "Meeting Scheduled", "Demo Completed", "Proposal Sent", "Negotiation", "Closed Won", "Closed Lost", "On Hold"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </Select>
                  </Field>
                  <Combobox
                    id="ref-client"
                    label="Client"
                    items={INITIAL_CLIENT_MASTER}
                    value={client}
                    onChange={setClient}
                    getKey={(c) => c.id}
                    getLabel={(c) => c.companyName}
                    getDescription={(c) => `${c.clientId} · ${c.industry}`}
                    placeholder="Search clients"
                    allowCustom
                    onCreate={(name) => toast({ message: `Added ${name} as a new client` })}
                  />
                  <Field label="Next follow-up" htmlFor="ref-date">
                    <DateInput id="ref-date" defaultValue="2026-11-28" />
                  </Field>
                  <Field label="Notes" htmlFor="ref-notes" className="md:col-span-2">
                    <Textarea id="ref-notes" rows={3} placeholder="What was agreed, and what happens next" defaultValue="Wants the phased plan before the board meeting on 2 Dec." />
                  </Field>
                  <div className="space-y-3">
                    <Switch checked={notify} onChange={setNotify} label="Remind me on the follow-up date" description="Shows on My dashboard and in the bell" />
                    <Checkbox checked={decisionMaker} onChange={setDecisionMaker} label="Met the decision maker" />
                  </div>
                  <div className="flex items-end justify-end gap-2">
                    <button type="button" className="btn btn-plain" onClick={() => setSubmitted(false)}>
                      Reset
                    </button>
                    <button type="submit" className="btn btn-ink">
                      Save deal
                    </button>
                  </div>
                </div>
              </form>

              <div className="min-w-0 space-y-3 sm:space-y-4 xl:col-span-5">
                <section className="card min-w-0 p-5 sm:p-6">
                  <CardHeader
                    icon={<PenLine />}
                    title="Assistant draft"
                    subtitle="Follow-up email · Zeta AI Labs"
                  />
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <span className="chip chip-outline">Email</span>
                    <span className="chip chip-outline">English</span>
                    <span className="chip chip-lime">Ready to send</span>
                  </div>
                  <div className="card-inset mt-3 p-4">
                    <p className="text-[12px] text-ink-3">To rajiv.m@apexfintech.io</p>
                    <p className="mt-1 text-[13.5px] font-medium">Revised scope for the transaction ledger</p>
                    <p className="mt-2 whitespace-pre-line text-[13px] text-ink-2">{EMAIL_BODY}</p>
                  </div>
                  <p className="mt-3 text-[12px] text-ink-3">Drafted by the assistant. Read it before sending.</p>
                  <div className="mt-4">
                    <ComposeActions
                      size="sm"
                      email={{ to: "rajiv.m@apexfintech.io", subject: "Revised scope for the transaction ledger", body: EMAIL_BODY }}
                      whatsapp={{ phone: "98450 11223", text: "Hi Rajiv, sharing the revised scope by Monday as discussed. Kamil, Axoraa" }}
                    />
                  </div>
                </section>

                <section className="card min-w-0 p-5 sm:p-6">
                  <CardHeader title="Theme" subtitle={`Following ${pref === "system" ? "the system" : "your choice"} · showing ${resolved}`} />
                  <div className="mt-5">
                    <Segmented<ThemePref>
                      label="Theme"
                      value={pref}
                      onChange={setPref}
                      options={[
                        { value: "system", label: "System" },
                        { value: "light", label: "Light" },
                        { value: "dark", label: "Dark" },
                      ]}
                    />
                  </div>
                  <p className="mt-3 text-[12.5px] text-ink-3">Printed invoices and quotations always use the light colours.</p>
                </section>

                <section className="card hidden min-w-0 p-5 sm:p-6 md:block">
                  <CardHeader title="Phone navigation" subtitle="Floats at the bottom below tablet width; More opens the full menu" />
                  <div className="mt-5 rounded-inset bg-surface-2 px-3 py-6">
                    <MobileBar active={nav} onNavigate={setNav} onMore={() => setNavOpen(true)} />
                  </div>
                </section>
              </div>
            </div>

            <footer className="px-1 pt-4 text-[12px] text-ink-3 sm:px-2">Axoraa Hub design reference. Mock data only; nothing here is saved.</footer>
          </section>
        </main>
      </div>

      <MobileBar fixed active={nav} onNavigate={setNav} onMore={() => setNavOpen(true)} />

      {/* Phone and tablet menu */}
      <Sheet open={navOpen} onClose={() => setNavOpen(false)} side="left" title="Axoraa" description="Operations Hub">
        <Sidebar active={nav} onNavigate={setNav} onClose={() => setNavOpen(false)} onToast={(m) => toast({ message: m })} />
      </Sheet>

      {/* Deal sheet */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={selectedDeal?.companyName ?? "Add deal"}
        description={selectedDeal ? `${selectedDeal.leadId} · owned by ${selectedDeal.marketingPerson}` : "Kamil's pipeline"}
        headerActions={
          selectedDeal ? (
            <Menu
              label="Deal actions"
              items={[
                { label: "Draft follow-up", icon: <PenLine />, onSelect: () => toast({ message: "Opens the Assistant" }) },
                { label: "Print quotation", icon: <Printer />, onSelect: () => toast({ message: "Opens the quotation" }) },
                { label: "Delete deal", icon: <Trash2 />, tone: "danger", separatorBefore: true, onSelect: () => (setSheetOpen(false), void deleteDeal(selectedDeal)) },
              ]}
            />
          ) : undefined
        }
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setSheetOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-ink"
              onClick={() => {
                setSheetOpen(false);
                if (selectedDeal) simulateSave(selectedDeal.id);
                toast({ message: selectedDeal ? `Saved ${selectedDeal.companyName}` : "Added the deal", tone: "positive" });
              }}
            >
              Save deal
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {selectedDeal && (
            <div className="grid grid-cols-2 gap-2">
              <div className="card-ink p-4">
                <div className="text-[12px] text-white/55">Value</div>
                <div className="num mt-3 text-[28px]">{formatInr(selectedDeal.estimatedDealValue)}</div>
              </div>
              <div className="card-inset p-4">
                <div className="text-[12px] text-ink-3">Next follow-up</div>
                <div className="mt-3">
                  <span className={`chip ${followChip(selectedDeal)}`}>{dueText(selectedDeal, TODAY)}</span>
                </div>
              </div>
            </div>
          )}
          <Field label="Contact person" htmlFor="sheet-contact">
            <Input id="sheet-contact" defaultValue={selectedDeal?.contactPerson ?? ""} placeholder="Rajiv Malhotra" />
          </Field>
          <Field label="Phone" htmlFor="sheet-phone">
            <Input id="sheet-phone" inputMode="tel" defaultValue="98450 33445" />
          </Field>
          <Field label="Stage" htmlFor="sheet-stage">
            <Select id="sheet-stage" defaultValue={selectedDeal?.leadStatus ?? "New Lead"}>
              {["New Lead", "Contacted", "Meeting Scheduled", "Proposal Sent", "Negotiation", "Closed Won", "Closed Lost"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field label="Next step" htmlFor="sheet-next">
            <Textarea id="sheet-next" rows={3} defaultValue="Send the revised commercials and book the security review." />
          </Field>
        </div>
      </Sheet>

      {/* Log work dialog */}
      <Dialog
        open={logOpen}
        onClose={() => setLogOpen(false)}
        icon={<Timer />}
        title="Log work"
        description="Wednesday, 25 Nov · Akshar"
        size="md"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setLogOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-ink"
              onClick={() => {
                setLogOpen(false);
                toast({ message: "Logged 3.5 hours", tone: "positive", action: { label: "Undo", onClick: () => toast({ message: "Removed the entry" }) } });
              }}
            >
              Save entry
            </button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Project" htmlFor="dlg-project" className="sm:col-span-2">
            <Select id="dlg-project" defaultValue="apex">
              <option value="apex">Apex ledger</option>
              <option value="zeta">Zeta AI console</option>
            </Select>
          </Field>
          <Field label="Hours" htmlFor="dlg-hours">
            <Input id="dlg-hours" inputMode="decimal" defaultValue="3.5" />
          </Field>
          <Field label="Status" htmlFor="dlg-status">
            <Select id="dlg-status" defaultValue="In Progress">
              <option>In Progress</option>
              <option>Completed</option>
              <option>Blocked</option>
            </Select>
          </Field>
          <Field label="What did you do?" htmlFor="dlg-notes" className="sm:col-span-2">
            <Textarea id="dlg-notes" rows={3} defaultValue="Reconciliation job for the ledger, plus review fixes on PR #142." />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
