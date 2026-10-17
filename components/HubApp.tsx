"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertOctagon,
  ArrowLeft,
  BookOpen,
  Briefcase,
  Code2,
  Database,
  FileDown,
  LayoutGrid,
  MapPin,
  Plus,
  ReceiptIndianRupee,
  ScrollText,
  Sparkles,
  TrendingUp,
  Users,
  UsersRound,
} from "lucide-react";
import type { DailyWorkLogEntry, MarketingDeal } from "@/lib/types";
import type { Person } from "@/lib/people";
import { useHubData, type HubData } from "@/lib/useHubData";
import { engineeringRollup, getRange, inRange } from "@/lib/analytics";
import { formatNumber } from "@/lib/format";
import { AppShell, type NavGroup } from "@/components/layout/AppShell";
import { OverviewView } from "@/components/views/OverviewView";
import { EngineeringView } from "@/components/views/EngineeringView";
import { MarketingView } from "@/components/views/MarketingView";
import { WorkLogView } from "@/components/views/WorkLogView";
import { BillingView, ClientsView, ExportsView, PeopleView } from "@/components/views/ExecutiveViews";
import { DealFinalizationSheet } from "@/components/marketing/DealFinalizationSheet";
import { InteractionsSheet } from "@/components/marketing/InteractionsSheet";
import { ConfigSheet } from "@/components/sheets/ConfigSheet";
import { UserGuideSheet } from "@/components/sheets/UserGuideSheet";
import { WorkLogModal } from "@/components/sheets/WorkLogModal";
import { DealModal } from "@/components/marketing/DealModal";
import { InteractionModal } from "@/components/marketing/InteractionModal";
import { GoogleSheetSyncModal } from "@/components/common/GoogleSheetSyncModal";

type Mode = { kind: "admin" } | { kind: "member"; person: Person; viewerIsAdmin: boolean };

const TITLES: Record<string, { title: string; subtitle?: string }> = {
  overview: { title: "Command Center", subtitle: "Everything the team shipped, sold and collected — by week, month or year." },
  people: { title: "People", subtitle: "Open anyone's personal dashboard." },
  clients: { title: "Clients & Delivery", subtitle: "Founder ownership, accounts and project progress." },
  billing: { title: "Invoices", subtitle: "Milestone billing and collections." },
  eng: { title: "Engineering", subtitle: "Team effort, completion and blockers." },
  eng_log: { title: "Daily Work Log", subtitle: "Every entry, filterable and exportable." },
  eng_blockers: { title: "Blockers", subtitle: "Items waiting on someone — resolve to unblock." },
  eng_roster: { title: "Team Roster" },
  eng_sop: { title: "SOP & Guidelines" },
  mkt: { title: "Pipeline", subtitle: "Leads, field activity and conversion." },
  mkt_deals: { title: "Deal Tracker" },
  mkt_visits: { title: "Visit Log" },
  exports: { title: "Export Center", subtitle: "Download any dataset for a week, month or year." },
  me: { title: "" },
  my_log: { title: "My Work Log", subtitle: "Everything you've logged." },
  my_clients: { title: "My Clients", subtitle: "Accounts you originated." },
};

export function HubApp({ mode }: { mode: Mode }) {
  const isAdmin = mode.kind === "admin";
  const data = useHubData({ isAdmin: isAdmin || (mode.kind === "member" && mode.viewerIsAdmin) });
  const person = mode.kind === "member" ? mode.person : null;
  const [tab, setTab] = useState(isAdmin ? "overview" : "me");

  // Modals
  const [logModal, setLogModal] = useState<{ open: boolean; entry: DailyWorkLogEntry | null }>({ open: false, entry: null });
  const [dealModal, setDealModal] = useState<{ open: boolean; deal: MarketingDeal | null }>({ open: false, deal: null });
  const [visitOpen, setVisitOpen] = useState(false);
  const [sheetsOpen, setSheetsOpen] = useState(false);

  // Scope data to the member (their own logs / deals / clients).
  const scoped: HubData = useMemo(() => {
    if (!person) return data;
    return {
      ...data,
      workLogs: data.workLogs.filter((l) => l.developerName === person.name),
      deals: data.deals.filter((d) => d.marketingPerson === person.name),
      interactions: data.interactions.filter((i) => i.marketingPerson === person.name),
      clients: data.clients.filter((c) => c.salesOwner === person.name),
      projects: data.projects.filter((p) => p.projectManager === person.name),
      founderMatrix: data.founderMatrix.filter((f) => f.founder === person.name),
    };
  }, [data, person]);

  const privileged = isAdmin || (mode.kind === "member" && mode.viewerIsAdmin);
  const canEdit = privileged || data.source === "local";
  const blockers = data.workLogs.filter((l) => l.isBlocked === "Yes" || l.workStatus === "Blocked").length;
  const overdue = data.payments.filter((p) => p.status === "Overdue").length;

  const openLog = (entry: DailyWorkLogEntry | null) => setLogModal({ open: true, entry });
  const resolve = (l: DailyWorkLogEntry) =>
    data.saveWorkLog({ isBlocked: "No", workStatus: "In Progress", blockerDetails: `Resolved on ${new Date().toLocaleDateString("en-GB")}` }, l.id);
  const remove = (l: DailyWorkLogEntry) => {
    if (confirm(`Delete "${l.module}" logged by ${l.developerName} on ${l.date}?`)) data.deleteWorkLog(l.id);
  };

  // ---------------------------------------------------------------- navigation
  const groups: NavGroup[] = isAdmin
    ? [
        {
          items: [
            { id: "overview", label: "Command Center", icon: <LayoutGrid /> },
            { id: "people", label: "People", icon: <UsersRound />, count: 9 },
          ],
        },
        {
          label: "Executive",
          items: [
            { id: "clients", label: "Clients & delivery", icon: <Briefcase />, count: data.clients.length },
            { id: "billing", label: "Invoices", icon: <ReceiptIndianRupee />, count: overdue || undefined, alert: overdue > 0 },
          ],
        },
        {
          label: "Engineering",
          items: [
            { id: "eng", label: "Team dashboard", icon: <Code2 /> },
            { id: "eng_log", label: "Daily work log", icon: <ScrollText />, count: data.workLogs.length },
            { id: "eng_blockers", label: "Blockers", icon: <AlertOctagon />, count: blockers || undefined, alert: blockers > 0 },
            { id: "eng_roster", label: "Roster", icon: <Users /> },
            { id: "eng_sop", label: "SOP", icon: <BookOpen /> },
          ],
        },
        {
          label: "Marketing",
          items: [
            { id: "mkt", label: "Pipeline", icon: <TrendingUp /> },
            { id: "mkt_deals", label: "Deal tracker", icon: <Briefcase />, count: data.deals.length },
            { id: "mkt_visits", label: "Visit log", icon: <MapPin />, count: data.interactions.length },
          ],
        },
        {
          label: "Data",
          items: [
            { id: "exports", label: "Export center", icon: <FileDown /> },
            { id: "sheets", label: "Google Sheets", icon: <Database /> },
          ],
        },
      ]
    : person!.category === "marketing"
    ? [
        {
          items: [
            { id: "me", label: "My dashboard", icon: <LayoutGrid /> },
            { id: "mkt_deals", label: "My leads", icon: <Briefcase />, count: scoped.deals.length },
            { id: "mkt_visits", label: "My visits", icon: <MapPin />, count: scoped.interactions.length },
          ],
        },
      ]
    : [
        {
          items: [
            { id: "me", label: "My dashboard", icon: <LayoutGrid /> },
            { id: "my_log", label: "My work log", icon: <ScrollText />, count: scoped.workLogs.length },
            ...(person!.category === "founder"
              ? [{ id: "my_clients", label: "My clients", icon: <Briefcase />, count: scoped.clients.length }]
              : []),
            { id: "eng_sop", label: "SOP", icon: <BookOpen /> },
          ],
        },
      ];

  const navigate = (id: string) => {
    if (id === "sheets") return setSheetsOpen(true);
    setTab(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ---------------------------------------------------------------- header
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const meta = TITLES[tab] ?? { title: "" };
  const title = tab === "me" ? `${greet}, ${person?.name}` : meta.title;
  const subtitle =
    tab === "me"
      ? person?.category === "marketing"
        ? "Your leads, visits and follow-ups."
        : "Your hours, entries and blockers — week by week."
      : meta.subtitle;

  const { weekHours, weekTouches } = useMemo(() => {
    const r = getRange("week", new Date());
    return {
      weekHours: engineeringRollup(scoped.workLogs, r).hours,
      weekTouches: scoped.interactions.filter((i) => inRange(i.date, r)).length,
    };
  }, [scoped.workLogs, scoped.interactions]);

  const primary =
    person?.category === "marketing" || tab.startsWith("mkt") ? (
      <button className="btn btn-ink" onClick={() => setDealModal({ open: true, deal: null })}>
        <Plus className="w-4 h-4" /> New lead
      </button>
    ) : (
      <button className="btn btn-ink" onClick={() => openLog(null)}>
        <Plus className="w-4 h-4" /> Log work
      </button>
    );

  const headerRight = (
    <>
      <span className={`chip h-10 px-4 ${data.source === "sheet" ? "chip-good" : ""}`} title={data.syncState.message}>
        <span className={`w-2 h-2 rounded-full ${data.source === "sheet" ? "bg-good" : "bg-amber"} ${data.syncState.busy ? "animate-pulse" : ""}`} />
        {data.source === "sheet" ? "Google Sheet" : "Local data"}
      </span>
      {isAdmin && (
        <button className="icon-btn" aria-label="Google Sheets" onClick={() => setSheetsOpen(true)}>
          <Database className="w-4 h-4" />
        </button>
      )}
      {primary}
    </>
  );

  const statusCard = isAdmin ? (
    <div className="card-lime p-4 rounded-[22px]!">
      <div className="flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-full bg-ink text-lime flex items-center justify-center">
          <Sparkles className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-medium leading-tight">Super user</div>
          <div className="text-[12px] text-ink/60">{data.source === "sheet" ? "Sheet connected" : "Sheet not connected"}</div>
        </div>
      </div>
      <button onClick={() => navigate(blockers ? "eng_blockers" : "overview")} className="mt-3 w-full h-10 rounded-full bg-white text-[13px] flex items-center justify-between px-4 hover:bg-white/80">
        <span>{blockers ? `${blockers} need your review` : "All caught up"}</span>
        <span aria-hidden>›</span>
      </button>
    </div>
  ) : (
    <div className="card-lime p-4 rounded-[22px]!">
      <div className="text-[12px] text-ink/60">This week</div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="num text-[34px]">{person?.category === "marketing" ? weekTouches : formatNumber(weekHours, 1)}</span>
        <span className="text-[13px] text-ink/60">{person?.category === "marketing" ? "touchpoints" : "hours"}</span>
      </div>
      <button
        onClick={() => (person?.category === "marketing" ? setVisitOpen(true) : openLog(null))}
        className="mt-3 w-full h-10 rounded-full bg-white text-[13px] flex items-center justify-between px-4 hover:bg-white/80"
      >
        <span>{person?.category === "marketing" ? "Log a visit" : "Log today's work"}</span>
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  const banner =
    mode.kind === "member" && mode.viewerIsAdmin ? (
      <div className="card-ink px-4 sm:px-5 py-3 mb-4 flex items-center justify-between gap-3 rounded-full! no-print">
        <span className="text-[13px] text-white/70">
          Viewing <span className="text-white font-medium">{mode.person.name}</span>&apos;s dashboard as administrator
        </span>
        <Link href="/admin" className="btn btn-lime btn-sm">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to admin
        </Link>
      </div>
    ) : null;

  // ---------------------------------------------------------------- body
  let body: React.ReactNode = null;
  if (!data.ready) body = <Skeleton />;
  else if (tab === "overview") body = <OverviewView data={data} onNavigate={navigate} />;
  else if (tab === "people") body = <PeopleView data={data} />;
  else if (tab === "clients") body = <ClientsView data={data} />;
  else if (tab === "my_clients") body = <ClientsView data={scoped} />;
  else if (tab === "billing") body = <BillingView data={data} />;
  else if (tab === "exports") body = <ExportsView data={data} />;
  else if (tab === "eng" || (tab === "me" && person?.category !== "marketing"))
    body = (
      <EngineeringView
        logs={scoped.workLogs}
        personal={person?.name}
        onOpenLog={(l) => openLog(l)}
        onOpenLogTable={() => navigate(person ? "my_log" : "eng_log")}
        onResolve={canEdit ? resolve : undefined}
      />
    );
  else if (tab === "eng_log" || tab === "my_log" || tab === "eng_blockers")
    body = (
      <WorkLogView
        key={tab}
        logs={scoped.workLogs}
        personal={person?.name}
        blockedOnly={tab === "eng_blockers"}
        canEdit={canEdit}
        canDelete={canEdit}
        onEdit={(l) => openLog(l)}
        onDelete={remove}
      />
    );
  else if (tab === "eng_roster")
    body = <ConfigSheet roster={data.roster} repositories={data.repositories} onUpdateRoster={data.setRoster} isAdmin={isAdmin} />;
  else if (tab === "eng_sop") body = <UserGuideSheet />;
  else if (tab === "mkt" || tab === "me")
    body = (
      <MarketingView
        deals={scoped.deals}
        interactions={scoped.interactions}
        personal={person?.name}
        onNewVisit={() => setVisitOpen(true)}
        onOpenDeal={(d) => setDealModal({ open: true, deal: d })}
        onOpenDeals={() => navigate("mkt_deals")}
        onOpenVisits={() => navigate("mkt_visits")}
      />
    );
  else if (tab === "mkt_deals")
    body = (
      <DealFinalizationSheet
        deals={scoped.deals}
        onAddDeal={() => setDealModal({ open: true, deal: null })}
        onEditDeal={(d) => setDealModal({ open: true, deal: d })}
        onOpenInteractions={() => navigate("mkt_visits")}
        activeRepFilter={person?.name ?? "All"}
      />
    );
  else if (tab === "mkt_visits") body = <InteractionsSheet interactions={scoped.interactions} onAddInteraction={() => setVisitOpen(true)} />;

  const memberRep = person && !isAdmin ? person.name : undefined;

  return (
    <>
      <AppShell
        groups={groups}
        active={tab}
        onNavigate={navigate}
        viewerName={isAdmin ? "Administrator" : person!.name}
        viewerRole={isAdmin ? "Super user" : person!.title}
        workspaceLabel={isAdmin ? "Axoraa HQ" : `${person!.name}'s workspace`}
        workspaceSub={isAdmin ? "4 founders · 9 team members" : person!.title}
        statusCard={statusCard}
        title={title}
        subtitle={subtitle}
        headerRight={headerRight}
        banner={banner}
      >
        {body}
      </AppShell>

      {logModal.open && (
      <WorkLogModal
        key={logModal.entry?.id ?? "new"}
        isOpen={logModal.open}
        onClose={() => setLogModal({ open: false, entry: null })}
        onSave={(entry) => data.saveWorkLog(entry, logModal.entry?.id)}
        initialData={logModal.entry}
        defaultDeveloper={memberRep ?? "Akshar"}
        lockDeveloper={!!memberRep}
      />
      )}
      {dealModal.open && (
      <DealModal
        key={dealModal.deal?.id ?? "new"}
        isOpen={dealModal.open}
        onClose={() => setDealModal({ open: false, deal: null })}
        onSave={(d) => data.saveDeal(d, dealModal.deal?.id)}
        initialData={dealModal.deal}
        defaultRep={memberRep ?? "Kamil"}
        lockRep={!!memberRep}
      />
      )}
      {visitOpen && (
      <InteractionModal
        isOpen={visitOpen}
        onClose={() => setVisitOpen(false)}
        onSave={(i) => data.saveInteraction(i)}
        defaultRep={memberRep ?? "Kamil"}
        lockRep={!!memberRep}
      />
      )}
      {isAdmin && <GoogleSheetSyncModal open={sheetsOpen} onClose={() => setSheetsOpen(false)} data={data} />}
    </>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className={`card animate-pulse ${i > 3 ? "col-span-2 h-72" : "h-44"}`} />
      ))}
    </div>
  );
}
