// The view registry: every page inside /admin and /u/<id>, who may open it, and how it is addressed.
// Isomorphic: no directive, no browser globals.
import {
  Briefcase,
  CalendarCheck,
  CalendarDays,
  CodeXml,
  FileDown,
  Handshake,
  LayoutGrid,
  LifeBuoy,
  MapPin,
  Megaphone,
  OctagonAlert,
  PenLine,
  Plug,
  ReceiptIndianRupee,
  ScrollText,
  Settings,
  TrendingUp,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { AgentKey, AgentRef } from "@/lib/agents/types";
import type { ViewerCategory } from "@/lib/hub/types";
import type {
  Campaign,
  ClientMasterRecord,
  ContentPost,
  DailyWorkLogEntry,
  DocLine,
  MarketingDeal,
  MarketingInteraction,
  PaymentBillingRecord,
} from "@/lib/types";

export type ViewId =
  | "today"
  | "overview"
  | "people"
  | "eng"
  | "eng_log"
  | "eng_blockers"
  | "eng_roster"
  | "mkt"
  | "mkt_deals"
  | "mkt_visits"
  | "content"
  | "campaigns"
  | "assistant"
  | "clients"
  | "billing"
  | "exports"
  | "integrations"
  | "settings"
  | "help";

export type OverlayKind =
  | "worklog"
  | "deal"
  | "visit"
  | "client"
  | "project"
  | "invoice"
  | "invoice_print"
  | "quote_print"
  | "post"
  | "campaign"
  | "agent"
  | "draft";

export type Overlay =
  | { kind: "worklog"; entry?: DailyWorkLogEntry | null; prefill?: Partial<DailyWorkLogEntry> }
  | { kind: "deal"; dealId?: string | null; prefill?: Partial<MarketingDeal> }
  | { kind: "visit"; visitId?: string | null; dealId?: string; prefill?: Partial<MarketingInteraction> }
  | { kind: "client"; clientId?: string | null; prefill?: Partial<ClientMasterRecord> }
  | { kind: "project"; projectId?: string | null; clientId?: string }
  | { kind: "invoice"; invoiceId?: string | null; clientId?: string; prefill?: Partial<PaymentBillingRecord> }
  | { kind: "invoice_print"; invoiceId: string }
  | { kind: "quote_print"; dealId: string; lines?: DocLine[] }
  | { kind: "post"; postId?: string | null; prefill?: Partial<ContentPost> }
  | { kind: "campaign"; campaignId?: string | null; prefill?: Partial<Campaign> }
  | { kind: "agent"; agentKey: AgentKey; ref?: AgentRef; input?: Record<string, unknown> }
  | { kind: "draft"; draftId: string };

export type ViewGroup = "main" | "sales" | "delivery" | "engineering" | "workspace";

export interface ViewDef {
  id: ViewId;
  /** Sidebar, mobile bar and command bar label. */
  label: string;
  /** Page title in the header and the browser tab ('<title> – Axoraa Hub'). */
  title: string;
  description: string;
  icon: LucideIcon;
  group: ViewGroup;
  roles: ViewerCategory[];
  /** The one primary button in the title row. 'by_category' is resolved by primaryActionFor. */
  primary?: { label: string; overlay: OverlayKind } | "by_category";
  /** Keyboard chord, e.g. 'g t'. */
  chord?: string;
}

/** Query values for viewHref / navigate / setParams. null or undefined removes the key. */
export type ViewParams = Record<string, string | null | undefined>;

const ALL: ViewerCategory[] = ["admin", "founder", "marketing", "developer"];

export const VIEWS: Record<ViewId, ViewDef> = {
  today: {
    id: "today",
    label: "My dashboard",
    // The shell shows the greeting ("Good evening, Kamil") as the page heading; this is the tab title.
    title: "My dashboard",
    description: "Your follow-ups, work and anything waiting on you today.",
    icon: CalendarCheck,
    group: "main",
    roles: ALL,
    primary: "by_category",
    chord: "g t",
  },
  overview: {
    id: "overview",
    label: "Command Center",
    title: "Command Center",
    description: "Everything the team shipped, sold and collected — by week, month or year.",
    icon: LayoutGrid,
    group: "main",
    roles: ["admin"],
    chord: "g o",
  },
  people: {
    id: "people",
    label: "People",
    title: "People",
    description: "Open anyone's personal dashboard.",
    icon: UsersRound,
    group: "main",
    roles: ["admin"],
  },
  mkt: {
    id: "mkt",
    label: "Pipeline",
    title: "Pipeline",
    description: "Leads, field activity and conversion.",
    icon: TrendingUp,
    group: "sales",
    roles: ["admin"],
    primary: { label: "Add deal", overlay: "deal" },
  },
  mkt_deals: {
    id: "mkt_deals",
    label: "Deal tracker",
    title: "Deal Tracker",
    description: "Every lead with its stage, value and next follow-up, as a table or a board.",
    icon: Handshake,
    group: "sales",
    roles: ["admin", "marketing"],
    primary: { label: "Add deal", overlay: "deal" },
    chord: "g d",
  },
  mkt_visits: {
    id: "mkt_visits",
    label: "Visit log",
    title: "Visit Log",
    description: "Client visits and calls, linked to their deals.",
    icon: MapPin,
    group: "sales",
    roles: ["admin", "marketing"],
    primary: { label: "Log visit", overlay: "visit" },
    chord: "g v",
  },
  content: {
    id: "content",
    label: "Content calendar",
    title: "Content Calendar",
    description: "Planned and published posts for Facebook, Instagram and LinkedIn.",
    icon: CalendarDays,
    group: "sales",
    roles: ["admin", "marketing"],
    primary: { label: "Add post", overlay: "post" },
  },
  campaigns: {
    id: "campaigns",
    label: "Campaigns",
    title: "Campaigns",
    description: "Budget, spend and leads for each campaign.",
    icon: Megaphone,
    group: "sales",
    roles: ["admin", "marketing"],
    primary: { label: "Add campaign", overlay: "campaign" },
  },
  assistant: {
    id: "assistant",
    label: "Assistant",
    title: "Assistant",
    description: "Draft emails, posts, plans and briefs, then review them before they go out.",
    icon: PenLine,
    group: "sales",
    roles: ["admin", "founder", "marketing"],
    chord: "g a",
  },
  clients: {
    id: "clients",
    label: "Clients & delivery",
    title: "Clients & Delivery",
    description: "Founder ownership, accounts and project progress.",
    icon: Briefcase,
    group: "delivery",
    roles: ["admin", "founder"],
    primary: { label: "Add client", overlay: "client" },
  },
  billing: {
    id: "billing",
    label: "Invoices",
    title: "Invoices",
    description: "Milestone billing and collections.",
    icon: ReceiptIndianRupee,
    group: "delivery",
    roles: ["admin"],
    primary: { label: "Add invoice", overlay: "invoice" },
    chord: "g i",
  },
  eng: {
    id: "eng",
    label: "Team dashboard",
    title: "Engineering",
    description: "Team effort, completion and blockers.",
    icon: CodeXml,
    group: "engineering",
    roles: ["admin"],
    primary: { label: "Log work", overlay: "worklog" },
  },
  eng_log: {
    id: "eng_log",
    label: "Daily work log",
    title: "Daily Work Log",
    description: "Every entry, filterable and exportable.",
    icon: ScrollText,
    group: "engineering",
    roles: ["admin", "founder", "developer"],
    primary: { label: "Log work", overlay: "worklog" },
    chord: "g l",
  },
  eng_blockers: {
    id: "eng_blockers",
    label: "Blockers",
    title: "Blockers",
    description: "Items waiting on someone — resolve to unblock.",
    icon: OctagonAlert,
    group: "engineering",
    roles: ["admin"],
    primary: { label: "Log work", overlay: "worklog" },
  },
  eng_roster: {
    id: "eng_roster",
    label: "Roster",
    title: "Team Roster",
    description: "Team members and the repositories they work in.",
    icon: Users,
    group: "engineering",
    roles: ["admin"],
  },
  exports: {
    id: "exports",
    label: "Export center",
    title: "Export Center",
    description: "Download any dataset for a week, month or year.",
    icon: FileDown,
    group: "workspace",
    roles: ["admin"],
  },
  integrations: {
    id: "integrations",
    label: "Integrations",
    title: "Integrations",
    description: "Google Sheets, the assistant and Meta.",
    icon: Plug,
    group: "workspace",
    roles: ["admin"],
  },
  settings: {
    id: "settings",
    label: "Settings",
    title: "Settings",
    description: "Company profile, pipeline, work and assistant settings.",
    icon: Settings,
    group: "workspace",
    roles: ["admin"],
    chord: "g s",
  },
  help: {
    id: "help",
    label: "SOP & guide",
    title: "SOP & Guide",
    description: "How the team works, step by step, and who to ask.",
    icon: LifeBuoy,
    group: "engineering",
    roles: ALL,
  },
};

export const VIEW_IDS = Object.keys(VIEWS) as ViewId[];

export const GROUP_LABEL: Record<ViewGroup, string> = {
  main: "",
  sales: "Sales & marketing",
  delivery: "Executive",
  engineering: "Engineering",
  workspace: "Data",
};

/** Old ?view= values (and old in-app ids) that still resolve. */
export const LEGACY_VIEW_ALIASES: Record<string, ViewId> = {
  eng_sop: "help",
  my_log: "eng_log",
  my_clients: "clients",
  sheets: "integrations",
  me: "today",
  drafts: "assistant",
};

/** Admin navigation, in order. 'today' is left out: its content is the Command Center's attention area (still reachable by URL). */
const ADMIN_ORDER: ViewId[] = [
  "overview",
  "people",
  "clients",
  "billing",
  "mkt",
  "mkt_deals",
  "mkt_visits",
  "content",
  "campaigns",
  "assistant",
  "eng",
  "eng_log",
  "eng_blockers",
  "eng_roster",
  "help",
  "exports",
  "integrations",
  "settings",
];

/** Member navigation, in order ("My dashboard" first). Help (SOP & guide) is always last, in its own group. */
const MEMBER_NAV: Record<Exclude<ViewerCategory, "admin">, ViewId[]> = {
  founder: ["today", "eng_log", "clients", "assistant", "help"],
  marketing: ["today", "mkt_deals", "mkt_visits", "content", "campaigns", "assistant", "help"],
  developer: ["today", "eng_log", "help"],
};

const MOBILE_BAR: Record<ViewerCategory, ViewId[]> = {
  admin: ["overview", "mkt_deals", "eng_log", "clients"],
  founder: ["today", "eng_log", "clients", "assistant"],
  marketing: ["today", "mkt_deals", "mkt_visits", "assistant"],
  developer: ["today", "eng_log", "help"],
};

/** Members see their own records, so some views take the original "My …" wording. */
const MEMBER_TEXT: Partial<Record<ViewId, Pick<ViewDef, "label" | "title" | "description">>> = {
  mkt_deals: { label: "My leads", title: "My Leads", description: "Your leads, their stage and the next follow-up." },
  mkt_visits: { label: "My visits", title: "My Visits", description: "Your client visits and calls, linked to their deals." },
  eng_log: { label: "My work log", title: "My Work Log", description: "Everything you've logged." },
  clients: { label: "My clients", title: "My Clients", description: "Accounts you originated." },
};

/** The view definition as this category sees it (member wording applied). */
export function viewFor(id: ViewId, category: ViewerCategory): ViewDef {
  const def = VIEWS[id];
  const text = category === "admin" ? undefined : MEMBER_TEXT[id];
  return text ? { ...def, ...text } : def;
}

function isViewId(v: string): v is ViewId {
  return Object.prototype.hasOwnProperty.call(VIEWS, v);
}

function orderFor(category: ViewerCategory): ViewId[] {
  return category === "admin" ? ADMIN_ORDER : MEMBER_NAV[category] ?? ["today", "help"];
}

/** Every view this category may open, in navigation order. */
export function viewsFor(category: ViewerCategory): ViewDef[] {
  return orderFor(category)
    .filter((id) => VIEWS[id].roles.includes(category))
    .map((id) => viewFor(id, category));
}

export interface NavGroup {
  /** Stable key for React lists. */
  id: ViewGroup | "help";
  /** '' renders no group label. */
  label: string;
  views: ViewDef[];
}

/** Admin: the labelled groups. Members: one unlabeled group, then Help in its own unlabeled group. */
export function navGroupsFor(category: ViewerCategory): NavGroup[] {
  const views = viewsFor(category);
  if (category === "admin") {
    const groups: NavGroup[] = [];
    for (const v of views) {
      const last = groups[groups.length - 1];
      if (last && last.id === v.group) last.views.push(v);
      else groups.push({ id: v.group, label: GROUP_LABEL[v.group], views: [v] });
    }
    return groups;
  }
  const main = views.filter((v) => v.id !== "help");
  const help = views.filter((v) => v.id === "help");
  return [
    { id: "main", label: "", views: main },
    ...(help.length ? [{ id: "help" as const, label: "", views: help }] : []),
  ];
}

export function homeViewFor(category: ViewerCategory): ViewId {
  return category === "admin" ? "overview" : "today";
}

/** The 3–4 views in the fixed bottom bar below md (the shell adds 'More'). */
export function mobileBarFor(category: ViewerCategory): ViewDef[] {
  return (MOBILE_BAR[category] ?? ["today", "help"])
    .filter((id) => VIEWS[id].roles.includes(category))
    .map((id) => viewFor(id, category));
}

export function canAccessView(category: ViewerCategory, id: string): boolean {
  return isViewId(id) && VIEWS[id].roles.includes(category);
}

/** ?view= value → a view this category may open. Legacy aliases resolve; unknown or forbidden → home. */
export function resolveView(raw: string | null | undefined, category: ViewerCategory): ViewId {
  const v = (raw ?? "").trim();
  const id: ViewId | undefined = isViewId(v)
    ? v
    : Object.prototype.hasOwnProperty.call(LEGACY_VIEW_ALIASES, v)
      ? LEGACY_VIEW_ALIASES[v]
      : undefined;
  return id && VIEWS[id].roles.includes(category) ? id : homeViewFor(category);
}

/** The title-row primary button for this view and category, or null. */
export function primaryActionFor(
  view: ViewId,
  category: ViewerCategory
): { label: string; overlay: OverlayKind } | null {
  const def = VIEWS[view];
  if (!def || !def.roles.includes(category) || !def.primary) return null;
  if (def.primary === "by_category") {
    if (category === "admin") return null;
    if (category === "marketing") return { label: "Log visit", overlay: "visit" };
    return { label: "Log work", overlay: "worklog" };
  }
  return def.primary;
}

// Keep ':' and ',' readable in links (open=deal:abc, ref=deal:abc); everything else is percent-encoded.
function enc(v: string): string {
  return encodeURIComponent(v).replace(/%3A/gi, ":").replace(/%2C/gi, ",");
}

function toQuery(entries: [string, string][]): string {
  return entries.map(([k, v]) => `${enc(k)}=${enc(v)}`).join("&");
}

/** `${basePath}?view=<view>&...`. Params with null, undefined or '' values are dropped. */
export function viewHref(
  basePath: string,
  view: ViewId,
  params?: ViewParams | URLSearchParams
): string {
  const entries: [string, string][] = [["view", view]];
  const extra: [string, string | null | undefined][] =
    params instanceof URLSearchParams ? [...params.entries()] : Object.entries(params ?? {});
  for (const [k, v] of extra) {
    if (k === "view" || v === null || v === undefined || v === "") continue;
    entries.push([k, v]);
  }
  return `${basePath}?${toQuery(entries)}`;
}

/** → `${basePath}?view=assistant&agent=<key>&ref=<type>:<id>` */
export function agentHref(basePath: string, key: AgentKey, ref?: AgentRef): string {
  return viewHref(basePath, "assistant", {
    agent: key,
    ref: ref ? `${ref.type}:${ref.id}` : undefined,
  });
}

const OVERLAY_KINDS: readonly OverlayKind[] = [
  "worklog",
  "deal",
  "visit",
  "client",
  "project",
  "invoice",
  "invoice_print",
  "quote_print",
  "post",
  "campaign",
  "agent",
  "draft",
];

function isOverlayKind(v: string): v is OverlayKind {
  return (OVERLAY_KINDS as readonly string[]).includes(v);
}

/** 'deal:abc' → { kind:'deal', id:'abc' }. Anything malformed → null. */
export function parseOpenParam(v: string | null | undefined): { kind: OverlayKind; id: string } | null {
  if (!v) return null;
  const i = v.indexOf(":");
  if (i <= 0) return null;
  const kind = v.slice(0, i);
  const id = v.slice(i + 1).trim();
  if (!isOverlayKind(kind) || !id) return null;
  return { kind, id };
}

export function openParam(kind: OverlayKind, id: string): string {
  return `${kind}:${id}`;
}

/**
 * The record id an overlay is about, for writing open=<kind>:<id>. Null for new records and for
 * 'agent' overlays, which are never written to the URL.
 */
export function overlayRecordId(o: Overlay): string | null {
  switch (o.kind) {
    case "worklog":
      return o.entry?.id ?? null;
    case "deal":
      return o.dealId ?? null;
    case "visit":
      return o.visitId ?? null;
    case "client":
      return o.clientId ?? null;
    case "project":
      return o.projectId ?? null;
    case "invoice":
      return o.invoiceId ?? null;
    case "invoice_print":
      return o.invoiceId;
    case "quote_print":
      return o.dealId;
    case "post":
      return o.postId ?? null;
    case "campaign":
      return o.campaignId ?? null;
    case "draft":
      return o.draftId;
    case "agent":
      return null;
  }
}

/**
 * Rebuilds an overlay from an open= param. Every kind except 'agent'.
 * A worklog overlay carries the entry itself, so pass the work logs to restore it (null when not found).
 * The caller still checks the record is visible in the scoped data.
 */
export function overlayFromParam(
  p: { kind: OverlayKind; id: string },
  lookup?: { workLogs?: readonly DailyWorkLogEntry[] }
): Overlay | null {
  const { id } = p;
  switch (p.kind) {
    case "worklog": {
      const entry = lookup?.workLogs?.find((l) => l.id === id);
      return entry ? { kind: "worklog", entry } : null;
    }
    case "deal":
      return { kind: "deal", dealId: id };
    case "visit":
      return { kind: "visit", visitId: id };
    case "client":
      return { kind: "client", clientId: id };
    case "project":
      return { kind: "project", projectId: id };
    case "invoice":
      return { kind: "invoice", invoiceId: id };
    case "invoice_print":
      return { kind: "invoice_print", invoiceId: id };
    case "quote_print":
      return { kind: "quote_print", dealId: id };
    case "post":
      return { kind: "post", postId: id };
    case "campaign":
      return { kind: "campaign", campaignId: id };
    case "draft":
      return { kind: "draft", draftId: id };
    case "agent":
      return null;
  }
}
