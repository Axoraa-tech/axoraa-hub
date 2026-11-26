"use client";

// The hub: one client app per workspace (/admin and /u/<id>). It owns the viewer, the data hook,
// the ?view= / ?open= URL state, the single overlay host, shortcuts and the command bar, and hands
// everything to views through HubProvider. Views take no props.
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import type { FeatureFlags } from "@/lib/features";
import { deriveAlerts, type HubAlert } from "@/lib/alerts";
import { engineeringRollup, getRange, inRange } from "@/lib/analytics";
import { COMPANY_EMAIL } from "@/lib/company";
import { formatNumber, todayKeyIST } from "@/lib/format";
import { HubProvider, type HubContextValue } from "@/lib/hub/context";
import { can, type HubAction } from "@/lib/hub/permissions";
import { scopeHubData } from "@/lib/hub/scope";
import type { HubViewer } from "@/lib/hub/types";
import { FOUNDER_NAMES, MEMBER_COUNT, type Person } from "@/lib/people";
import { useNow } from "@/lib/prefs";
import { useHubData, type HubData } from "@/lib/useHubData";
import {
  openParam,
  overlayFromParam,
  overlayRecordId,
  parseOpenParam,
  primaryActionFor,
  resolveView,
  viewFor,
  viewHref,
  viewsFor,
  type Overlay,
  type OverlayKind,
  type ViewId,
  type ViewParams,
} from "@/lib/views";
import { AppShell, type PrimaryAction } from "@/components/layout/AppShell";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { ShortcutsDialog } from "@/components/layout/ShortcutsDialog";
import type { LimeCardContent, NavCounts } from "@/components/layout/Sidebar";
import { useShortcuts } from "@/components/layout/useShortcuts";
import { ViewBoundary } from "@/components/layout/ViewErrorFallback";
import { DelayedSkeleton, SkeletonPage } from "@/components/ui/Skeleton";

// Views (each package owns its file; views take no props and read useHub()).
import { OverviewView } from "@/components/views/OverviewView";
import { TodayView } from "@/components/views/TodayView";
import { PeopleView } from "@/components/views/PeopleView";
import { EngineeringView } from "@/components/views/EngineeringView";
import { WorkLogView } from "@/components/views/WorkLogView";
import { RosterView } from "@/components/views/RosterView";
import { MarketingView } from "@/components/views/MarketingView";
import { DealsView } from "@/components/views/DealsView";
import { VisitsView } from "@/components/views/VisitsView";
import { ClientsView } from "@/components/views/ClientsView";
import { InvoicesView } from "@/components/views/InvoicesView";
import { ExportsView } from "@/components/views/ExportsView";
import { AssistantView } from "@/components/views/AssistantView";
import { ContentView } from "@/components/views/ContentView";
import { CampaignsView } from "@/components/views/CampaignsView";
import { SettingsView } from "@/components/views/SettingsView";
import { IntegrationsView } from "@/components/views/IntegrationsView";
import { HelpView } from "@/components/views/HelpView";

// Overlays (editors take { overlay, onClose }).
import { WorkLogEditor } from "@/components/engineering/WorkLogEditor";
import { DealSheet } from "@/components/crm/DealSheet";
import { VisitEditor } from "@/components/crm/VisitEditor";
import { QuotePrint } from "@/components/crm/QuotePrint";
import { ClientEditor } from "@/components/finance/ClientEditor";
import { ProjectEditor } from "@/components/finance/ProjectEditor";
import { InvoiceEditor } from "@/components/finance/InvoiceEditor";
import { InvoicePrint } from "@/components/finance/InvoicePrint";
import { PostEditor } from "@/components/studio/PostEditor";
import { CampaignEditor } from "@/components/studio/CampaignEditor";
import { AgentSheet } from "@/components/studio/AgentSheet";
import { DraftSheet } from "@/components/studio/DraftSheet";

export type HubMode = { kind: "admin" } | { kind: "member"; person: Person; viewerIsAdmin: boolean };

/* ------------------------------------------------------------------ small helpers */

const subscribeNothing = () => () => {};
function useIsMac(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent),
    () => false
  );
}

/** 0–23 in India Standard Time. */
function istHour(now: number): number {
  return new Date(now + 330 * 60_000).getUTCHours();
}

function greeting(now: number, name: string): string {
  if (!now) return `Hello, ${name}`;
  const h = istHour(now);
  const part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return `${part}, ${name}`;
}

const CREATE_ACTION: Partial<Record<OverlayKind, HubAction>> = {
  worklog: "worklog.edit",
  deal: "deal.edit",
  visit: "visit.edit",
  client: "client.edit",
  project: "project.edit",
  invoice: "invoice.edit",
  post: "content.edit",
  campaign: "campaign.edit",
};

/** A blank "new record" overlay for a primary action. */
function newOverlay(kind: OverlayKind): Overlay | null {
  switch (kind) {
    case "worklog":
      return { kind: "worklog", entry: null };
    case "deal":
      return { kind: "deal", dealId: null };
    case "visit":
      return { kind: "visit", visitId: null };
    case "client":
      return { kind: "client", clientId: null };
    case "project":
      return { kind: "project", projectId: null };
    case "invoice":
      return { kind: "invoice", invoiceId: null };
    case "post":
      return { kind: "post", postId: null };
    case "campaign":
      return { kind: "campaign", campaignId: null };
    default:
      return null;
  }
}

const hasId = (rows: readonly { id: string }[], id: string) => rows.some((r) => r.id === id);

/** May this viewer see this overlay with this (scoped) data? New records need create rights. */
function overlayAllowed(o: Overlay, viewer: HubViewer, data: HubData, features: FeatureFlags): boolean {
  const ctx = { data, features };
  switch (o.kind) {
    case "worklog":
      return o.entry ? hasId(data.workLogs, o.entry.id) : can(viewer, "worklog.edit", ctx);
    case "deal":
      return o.dealId ? hasId(data.deals, o.dealId) : can(viewer, "deal.edit", ctx);
    case "visit":
      return o.visitId ? hasId(data.interactions, o.visitId) : can(viewer, "visit.edit", ctx);
    case "client":
      return o.clientId ? hasId(data.clients, o.clientId) : can(viewer, "client.edit", ctx);
    case "project":
      return o.projectId ? hasId(data.projects, o.projectId) : can(viewer, "project.edit", ctx);
    case "invoice":
      return can(viewer, "invoice.edit", ctx) && (!o.invoiceId || hasId(data.payments, o.invoiceId));
    case "invoice_print":
      return can(viewer, "invoice.edit", ctx) && hasId(data.payments, o.invoiceId);
    case "quote_print":
      return hasId(data.deals, o.dealId);
    case "post":
      return can(viewer, "content.edit", ctx) && (!o.postId || hasId(data.posts, o.postId));
    case "campaign":
      return can(viewer, "campaign.edit", ctx) && (!o.campaignId || hasId(data.campaigns, o.campaignId));
    case "agent":
      return can(viewer, "agent.run", { ...ctx, agentKey: o.agentKey });
    case "draft":
      return hasId(data.drafts, o.draftId);
  }
}

/** Exactly one overlay component, chosen by kind, keyed on kind and record id. */
function OverlayHost({ overlay, onClose }: { overlay: Overlay; onClose: () => void }) {
  const key = `${overlay.kind}:${overlay.kind === "agent" ? overlay.agentKey : overlayRecordId(overlay) ?? "new"}`;
  switch (overlay.kind) {
    case "worklog":
      return <WorkLogEditor key={key} overlay={overlay} onClose={onClose} />;
    case "deal":
      return <DealSheet key={key} overlay={overlay} onClose={onClose} />;
    case "visit":
      return <VisitEditor key={key} overlay={overlay} onClose={onClose} />;
    case "quote_print":
      return <QuotePrint key={key} overlay={overlay} onClose={onClose} />;
    case "client":
      return <ClientEditor key={key} overlay={overlay} onClose={onClose} />;
    case "project":
      return <ProjectEditor key={key} overlay={overlay} onClose={onClose} />;
    case "invoice":
      return <InvoiceEditor key={key} overlay={overlay} onClose={onClose} />;
    case "invoice_print":
      return <InvoicePrint key={key} overlay={overlay} onClose={onClose} />;
    case "post":
      return <PostEditor key={key} overlay={overlay} onClose={onClose} />;
    case "campaign":
      return <CampaignEditor key={key} overlay={overlay} onClose={onClose} />;
    case "agent":
      return <AgentSheet key={key} overlay={overlay} onClose={onClose} />;
    case "draft":
      return <DraftSheet key={key} overlay={overlay} onClose={onClose} />;
  }
}

/** The active view. Personal components switch to personal mode when view === 'today'. */
function ViewBody({ view, category }: { view: ViewId; category: HubViewer["category"] }) {
  switch (view) {
    case "today":
      if (category === "admin") return <TodayView />;
      return (
        <div className="space-y-8">
          <TodayView />
          {category === "marketing" ? <MarketingView /> : <EngineeringView />}
        </div>
      );
    case "overview":
      return <OverviewView />;
    case "people":
      return <PeopleView />;
    case "eng":
      return <EngineeringView />;
    case "eng_log":
    case "eng_blockers":
      return <WorkLogView />;
    case "eng_roster":
      return <RosterView />;
    case "mkt":
      return <MarketingView />;
    case "mkt_deals":
      return <DealsView />;
    case "mkt_visits":
      return <VisitsView />;
    case "content":
      return <ContentView />;
    case "campaigns":
      return <CampaignsView />;
    case "assistant":
      return <AssistantView />;
    case "clients":
      return <ClientsView />;
    case "billing":
      return <InvoicesView />;
    case "exports":
      return <ExportsView />;
    case "integrations":
      return <IntegrationsView />;
    case "settings":
      return <SettingsView />;
    case "help":
      return <HelpView />;
  }
}

/* ------------------------------------------------------------------ HubApp */

export function HubApp({ mode, features }: { mode: HubMode; features: FeatureFlags }) {
  const person = mode.kind === "member" ? mode.person : null;
  const viewerIsAdmin = mode.kind === "member" && mode.viewerIsAdmin;

  const viewer = useMemo<HubViewer>(() => {
    if (!person) {
      return {
        kind: "admin",
        accountId: "admin",
        name: "Administrator",
        category: "admin",
        person: null,
        isAdmin: true,
        viewerIsAdmin: false,
        privileged: true,
        email: COMPANY_EMAIL,
      };
    }
    return {
      kind: "member",
      accountId: person.id,
      name: person.name,
      category: person.category,
      person,
      isAdmin: false,
      viewerIsAdmin,
      privileged: viewerIsAdmin,
      email: person.email,
    };
  }, [person, viewerIsAdmin]);
  const { category } = viewer;

  const all = useHubData({
    isAdmin: viewer.privileged,
    actor: { accountId: viewer.accountId, name: viewer.name, category },
  });
  const data = useMemo(() => (person ? scopeHubData(all, person) : all), [all, person]);

  /* ---------------- URL state */
  const searchParams = useSearchParams();
  const rawView = searchParams.get("view");
  const view = resolveView(rawView, category);
  const def = viewFor(view, category);
  const basePath = person ? `/u/${person.id}` : "/admin";
  const query = searchParams.toString();
  const params = useMemo(() => new URLSearchParams(query), [query]);

  // Legacy aliases and forbidden views are rewritten to the view actually shown.
  useEffect(() => {
    if (rawView !== null && rawView !== view) {
      const cur = new URLSearchParams(window.location.search);
      // The old Drafts page is the Assistant's History tab.
      if (rawView === "drafts" && view === "assistant" && !cur.has("tab")) cur.set("tab", "history");
      window.history.replaceState(null, "", viewHref(window.location.pathname, view, cur));
    }
  }, [rawView, view]);

  useEffect(() => {
    document.title = `${def.title} – Axoraa Hub`;
  }, [def.title]);

  const [local, setLocal] = useState<{ overlay: Overlay; key: string | null } | null>(null);

  const setParams = useCallback(
    (patch: ViewParams) => {
      const cur = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === "") cur.delete(k);
        else cur.set(k, v);
      }
      const v = resolveView(cur.get("view"), category);
      window.history.replaceState(null, "", viewHref(window.location.pathname, v, cur));
    },
    [category]
  );

  const navigate = useCallback((next: ViewId, p?: ViewParams) => {
    const href = viewHref(window.location.pathname, next, p);
    if (href !== `${window.location.pathname}${window.location.search}`) window.history.pushState(null, "", href);
    setLocal(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  /* ---------------- overlays */
  const openOverlay = useCallback(
    (o: Overlay) => {
      const id = o.kind === "agent" ? null : overlayRecordId(o);
      const key = id ? openParam(o.kind, id) : null;
      setLocal({ overlay: o, key });
      setParams({ open: key });
    },
    [setParams]
  );

  const closeOverlay = useCallback(() => {
    setLocal(null);
    if (new URLSearchParams(window.location.search).has("open")) setParams({ open: null });
  }, [setParams]);

  const openRaw = searchParams.get("open");
  const urlOverlay = useMemo(() => {
    const p = parseOpenParam(openRaw);
    if (!p || p.kind === "agent") return null;
    return overlayFromParam(p, { workLogs: data.workLogs });
  }, [openRaw, data.workLogs]);
  const candidate = local && (local.key === null || local.key === openRaw) ? local.overlay : urlOverlay;
  const overlay = candidate && data.ready && overlayAllowed(candidate, viewer, data, features) ? candidate : null;

  /* ---------------- search registration, palette, shortcuts */
  const searchRef = useRef<HTMLInputElement | null>(null);
  const registerSearch = useCallback((el: HTMLInputElement | null) => {
    searchRef.current = el;
  }, []);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const mac = useIsMac();

  const primaryDef = primaryActionFor(view, category);
  const primary: PrimaryAction | null = useMemo(() => {
    if (!primaryDef) return null;
    const action = CREATE_ACTION[primaryDef.overlay];
    const o = newOverlay(primaryDef.overlay);
    if (!o || !action || !can(viewer, action, { data, features })) return null;
    return { label: primaryDef.label, run: () => openOverlay(o) };
  }, [primaryDef, viewer, data, features, openOverlay]);

  const views = useMemo(() => viewsFor(category), [category]);

  useShortcuts({
    views,
    paletteOpen,
    onPalette: () => setPaletteOpen((o) => !o),
    onSlash: () => {
      const el = searchRef.current;
      if (el && el.isConnected) {
        el.focus();
        el.select();
      } else setPaletteOpen(true);
    },
    onPrimary: () => primary?.run(),
    onHelp: () => setShortcutsOpen(true),
    onView: (id) => navigate(id),
  });

  /* ---------------- alerts, counts, lime card */
  const now = useNow();
  const todayKey = now ? todayKeyIST(now) : "";
  const alerts = useMemo<HubAlert[]>(
    () => (todayKey && data.ready ? deriveAlerts(data, viewer, { todayKey, features }) : []),
    [data, viewer, todayKey, features]
  );

  const onAlert = useCallback(
    (a: HubAlert) => {
      if (a.view !== view) navigate(a.view);
      if (a.overlay) openOverlay(a.overlay);
    },
    [view, navigate, openOverlay]
  );

  const counts = useMemo<NavCounts>(() => {
    if (!data.ready) return {};
    const blockers = data.workLogs.filter((l) => (l.isBlocked === "Yes" || l.workStatus === "Blocked") && l.workStatus !== "Completed").length;
    const overdue = data.payments.filter((p) => p.status === "Overdue").length;
    const negative = alerts.filter((a) => a.tone === "negative").length;
    return {
      today: { count: alerts.length, alert: negative > 0, label: alerts.length === 1 ? "item needs you" : "items need you" },
      people: { count: MEMBER_COUNT },
      clients: { count: data.clients.length },
      billing: { count: overdue, alert: overdue > 0, label: "overdue" },
      mkt_deals: { count: data.deals.length },
      mkt_visits: { count: data.interactions.length },
      eng_log: { count: data.workLogs.length },
      eng_blockers: { count: blockers, alert: blockers > 0, label: "open" },
    };
  }, [data, alerts]);

  const weekFigure = useMemo(() => {
    if (!now || !data.ready || category === "admin") return null;
    const range = getRange("week", new Date(now));
    if (category === "marketing") return String(data.interactions.filter((i) => inRange(i.date, range)).length);
    return formatNumber(engineeringRollup(data.workLogs, range).hours, 1);
  }, [now, data, category]);

  const lime: LimeCardContent = useMemo(() => {
    if (category === "admin") {
      const urgent = alerts.filter((a) => a.tone === "negative");
      return {
        kind: "admin",
        attention: urgent.length,
        onReview: () => (urgent[0] ? onAlert(urgent[0]) : navigate("overview")),
      };
    }
    const todayPrimary = primaryActionFor("today", category);
    const o = todayPrimary ? newOverlay(todayPrimary.overlay) : null;
    const action = todayPrimary ? CREATE_ACTION[todayPrimary.overlay] : undefined;
    const allowed = !!o && !!action && can(viewer, action, { data, features });
    return {
      kind: "member",
      label: "This week",
      value: weekFigure,
      unit: category === "marketing" ? "touchpoints" : "hours",
      action: allowed && o ? { label: category === "marketing" ? "Log a visit" : "Log today's work", run: () => openOverlay(o) } : null,
    };
  }, [category, alerts, onAlert, navigate, weekFigure, viewer, data, features, openOverlay]);

  /* ---------------- header */
  const title = view === "today" ? greeting(now, viewer.name) : def.title;
  const description =
    view === "today" && category !== "admin"
      ? category === "marketing"
        ? "Your leads, visits and follow-ups."
        : "Your hours, entries and blockers, week by week."
      : def.description;

  const ctx: HubContextValue = {
    data,
    all,
    viewer,
    features,
    view,
    params,
    basePath,
    navigate,
    setParams,
    openOverlay,
    closeOverlay,
    registerSearch,
  };

  return (
    <HubProvider value={ctx}>
      <AppShell
        title={title}
        description={description}
        primary={primary}
        alerts={alerts}
        onAlert={onAlert}
        counts={counts}
        lime={lime}
        workspaceLabel={person ? `${person.name}'s workspace` : "Axoraa HQ"}
        workspaceSub={person ? person.title : `${FOUNDER_NAMES.length} founders · ${MEMBER_COUNT} team members`}
        roleLabel={person ? person.title : "Super user"}
        onOpenPalette={() => setPaletteOpen(true)}
        onShortcuts={() => setShortcutsOpen(true)}
        mac={mac}
      >
        {!data.ready ? (
          <DelayedSkeleton label={`Loading ${def.label}`}>
            <SkeletonPage />
          </DelayedSkeleton>
        ) : (
          <ViewBoundary key={view} view={view} label={def.label}>
            <ViewBody view={view} category={category} />
          </ViewBoundary>
        )}
      </AppShell>

      {overlay && <OverlayHost overlay={overlay} onClose={closeOverlay} />}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        data={data}
        viewer={viewer}
        features={features}
        navigate={navigate}
        openOverlay={openOverlay}
        onShortcuts={() => setShortcutsOpen(true)}
        mac={mac}
      />
      <ShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        views={views}
        primaryLabel={primary?.label}
        mac={mac}
      />
    </HubProvider>
  );
}
