"use client";

import React, { useState, useEffect } from "react";
import {
  DailyWorkLogEntry,
  DeveloperRosterMember,
  RepositoryMapping,
  UserProfile,
  GoogleSheetsConfig,
  MarketingDeal,
  MarketingInteraction,
  ClientMasterRecord,
  ProjectProgressRecord,
  PaymentBillingRecord,
  FounderMatrixStats,
  CompanyTopLineMetrics,
} from "@/lib/types";
import { StorageService } from "@/lib/storage";
import {
  INITIAL_USER_PROFILES,
  COMPANY_TOP_LINE_METRICS,
} from "@/lib/mockData";

import { Sidebar, WorkspaceType, ActiveTab } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";

// Engineering Hub Components
import { HeroSpotlightCard } from "@/components/dashboard/HeroSpotlightCard";
import { PortfolioMetrics } from "@/components/dashboard/PortfolioMetrics";
import { PipelineStageBar } from "@/components/dashboard/PipelineStageBar";
import { NeedsAttentionTable } from "@/components/dashboard/NeedsAttentionTable";
import { AiInsightsCard } from "@/components/dashboard/AiInsightsCard";
import { SpeedometerGauge } from "@/components/dashboard/SpeedometerGauge";
import { DailyWorkLogSheet } from "@/components/sheets/DailyWorkLogSheet";
import { WorkLogModal } from "@/components/sheets/WorkLogModal";
import { ConfigSheet } from "@/components/sheets/ConfigSheet";
import { UserGuideSheet } from "@/components/sheets/UserGuideSheet";

// Marketing CRM Components
import { MarketingDashboardView } from "@/components/marketing/MarketingDashboardView";
import { DealFinalizationSheet } from "@/components/marketing/DealFinalizationSheet";
import { InteractionsSheet } from "@/components/marketing/InteractionsSheet";
import { DealModal } from "@/components/marketing/DealModal";
import { InteractionModal } from "@/components/marketing/InteractionModal";

// Founders Command Center Components
import { FoundersDashboardView } from "@/components/founders/FoundersDashboardView";

// Shared Modals
import { RoleSwitcherModal } from "@/components/common/RoleSwitcherModal";
import { GoogleSheetSyncModal } from "@/components/common/GoogleSheetSyncModal";

export default function AxoraaUnifiedHub() {
  // Navigation State
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceType>("founders");
  const [activeTab, setActiveTab] = useState<ActiveTab>("founders_dashboard");
  const [currentUser, setCurrentUser] = useState<UserProfile>(INITIAL_USER_PROFILES[0]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isAiEnabled, setIsAiEnabled] = useState<boolean>(true);

  // Track 1: Engineering Data
  const [workLogs, setWorkLogs] = useState<DailyWorkLogEntry[]>([]);
  const [roster, setRoster] = useState<DeveloperRosterMember[]>([]);
  const [repositories, setRepositories] = useState<RepositoryMapping[]>([]);
  const [isWorkLogModalOpen, setIsWorkLogModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<DailyWorkLogEntry | null>(null);

  // Track 2: Marketing CRM Data
  const [deals, setDeals] = useState<MarketingDeal[]>([]);
  const [interactions, setInteractions] = useState<MarketingInteraction[]>([]);
  const [isDealModalOpen, setIsDealModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<MarketingDeal | null>(null);
  const [isInteractionModalOpen, setIsInteractionModalOpen] = useState(false);

  // Track 3: Founders & Executive Data
  const [clients, setClients] = useState<ClientMasterRecord[]>([]);
  const [projects, setProjects] = useState<ProjectProgressRecord[]>([]);
  const [payments, setPayments] = useState<PaymentBillingRecord[]>([]);
  const [founderMatrix, setFounderMatrix] = useState<FounderMatrixStats[]>([]);
  const [topLineMetrics, setTopLineMetrics] = useState<CompanyTopLineMetrics>(COMPANY_TOP_LINE_METRICS);

  // Shared Modals & Config
  const [sheetsConfig, setSheetsConfig] = useState<GoogleSheetsConfig>({
    sheetId: "1_m3ld9Eb_zizpDB31fOZ5w59SKPYsNoMI9Ru7f2cfDY",
    webAppUrl: "",
    autoSync: false,
    lastSyncedAt: null,
    status: "disconnected",
  });
  const [isRoleSwitcherOpen, setIsRoleSwitcherOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Load from StorageService & listen to events
  useEffect(() => {
    loadAllData();

    const handleDataChange = () => {
      setWorkLogs(StorageService.getWorkLogs());
      setDeals(StorageService.getMarketingDeals());
      setInteractions(StorageService.getInteractions());
      setClients(StorageService.getClientMaster());
      setProjects(StorageService.getProjectProgress());
      setPayments(StorageService.getPayments());
    };

    window.addEventListener("axoraa_data_changed", handleDataChange);
    window.addEventListener("axoraa_deals_changed", handleDataChange);
    window.addEventListener("axoraa_interactions_changed", handleDataChange);
    window.addEventListener("axoraa_clients_changed", handleDataChange);
    window.addEventListener("axoraa_projects_changed", handleDataChange);
    window.addEventListener("axoraa_payments_changed", handleDataChange);

    return () => {
      window.removeEventListener("axoraa_data_changed", handleDataChange);
      window.removeEventListener("axoraa_deals_changed", handleDataChange);
      window.removeEventListener("axoraa_interactions_changed", handleDataChange);
      window.removeEventListener("axoraa_clients_changed", handleDataChange);
      window.removeEventListener("axoraa_projects_changed", handleDataChange);
      window.removeEventListener("axoraa_payments_changed", handleDataChange);
    };
  }, []);

  const loadAllData = () => {
    setWorkLogs(StorageService.getWorkLogs());
    setRoster(StorageService.getRoster());
    setRepositories(StorageService.getRepositories());
    setDeals(StorageService.getMarketingDeals());
    setInteractions(StorageService.getInteractions());
    setClients(StorageService.getClientMaster());
    setProjects(StorageService.getProjectProgress());
    setPayments(StorageService.getPayments());
    setFounderMatrix(StorageService.getFounderMatrix());
    setSheetsConfig(StorageService.getGoogleSheetsConfig());

    const savedUserId = StorageService.getActiveUserId();
    const foundUser = INITIAL_USER_PROFILES.find((u) => u.id === savedUserId);
    if (foundUser) setCurrentUser(foundUser);
  };

  // CRUD Handlers for Engineering
  const handleSaveWorkLog = (entryData: Partial<DailyWorkLogEntry>) => {
    if (editingLog) {
      StorageService.updateWorkLog(editingLog.id, entryData);
      setEditingLog(null);
    } else {
      StorageService.addWorkLog(entryData as any);
    }
    setWorkLogs(StorageService.getWorkLogs());
  };

  const handleResolveBlocker = (id: string) => {
    StorageService.resolveBlocker(id);
    setWorkLogs(StorageService.getWorkLogs());
  };

  const handleUpdateLogStatus = (id: string, status: any) => {
    StorageService.updateWorkLog(id, { workStatus: status });
    setWorkLogs(StorageService.getWorkLogs());
  };

  const handleDeleteWorkLog = (id: string) => {
    if (confirm("Delete this daily work log entry?")) {
      StorageService.deleteWorkLog(id);
      setWorkLogs(StorageService.getWorkLogs());
    }
  };

  // CRUD Handlers for Marketing
  const handleSaveDeal = (dealData: Partial<MarketingDeal>) => {
    if (editingDeal) {
      StorageService.updateMarketingDeal(editingDeal.id, dealData);
      setEditingDeal(null);
    } else {
      StorageService.addMarketingDeal(dealData as any);
    }
    setDeals(StorageService.getMarketingDeals());
  };

  const handleSaveInteraction = (intData: Partial<MarketingInteraction>) => {
    StorageService.addInteraction(intData as any);
    setInteractions(StorageService.getInteractions());
  };

  // Role switching handler
  const handleSelectUser = (user: UserProfile) => {
    setCurrentUser(user);
    StorageService.setActiveUserId(user.id);

    // Contextually switch active workspace if appropriate
    if (user.category === "marketing") {
      setActiveWorkspace("marketing");
      setActiveTab("mkt_dashboard");
    } else if (user.category === "founder") {
      setActiveWorkspace("founders");
      setActiveTab("founders_dashboard");
    } else {
      setActiveWorkspace("engineering");
      setActiveTab("eng_dashboard");
    }
  };

  // Top action button click ("+ New...")
  const handleNewActionClick = () => {
    if (activeWorkspace === "founders") {
      alert("New Client Account onboarding modal ready");
    } else if (activeWorkspace === "marketing") {
      setEditingDeal(null);
      setIsDealModalOpen(true);
    } else {
      setEditingLog(null);
      setIsWorkLogModalOpen(true);
    }
  };

  // Counters
  const blockedLogs = workLogs.filter((l) => l.isBlocked === "Yes" || l.workStatus === "Blocked");
  const blockerCount = blockedLogs.length;
  const overduePayments = payments.filter((p) => p.status === "Overdue");
  const overduePaymentCount = overduePayments.length;

  return (
    <div className="min-h-screen bg-[#f4f5f7] flex text-zinc-900 font-sans selection:bg-[#d4ff32] selection:text-zinc-950">
      {/* 3-in-1 Left Sidebar */}
      <Sidebar
        activeWorkspace={activeWorkspace}
        onWorkspaceChange={setActiveWorkspace}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        blockerCount={blockerCount}
        totalLogCount={workLogs.length}
        dealCount={deals.length}
        overduePaymentCount={overduePaymentCount}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        isAiEnabled={isAiEnabled}
        onToggleAi={() => setIsAiEnabled(!isAiEnabled)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav
          currentUser={currentUser}
          activeWorkspace={activeWorkspace}
          blockerCount={blockerCount}
          overduePaymentCount={overduePaymentCount}
          onOpenRoleSwitcher={() => setIsRoleSwitcherOpen(true)}
          onOpenNewModal={handleNewActionClick}
          onOpenSyncModal={() => setIsSyncModalOpen(true)}
          onActionClick={() => {
            if (activeWorkspace === "founders") setActiveTab("founders_billing");
            else if (activeWorkspace === "engineering") setActiveTab("eng_blockers");
            else setActiveTab("mkt_dashboard");
          }}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />

        {/* Dynamic Workspace Rendering */}
        <main className="p-4 sm:p-6 lg:p-8 flex-1 max-w-[1600px] w-full mx-auto space-y-6">
          {/* ============================================================== */}
          {/* TRACK 1: FOUNDERS & EXECUTIVE COMMAND CENTER                   */}
          {/* ============================================================== */}
          {activeWorkspace === "founders" && (
            <FoundersDashboardView
              metrics={topLineMetrics}
              founders={founderMatrix}
              clients={clients}
              projects={projects}
              payments={payments}
              onSelectProject={() => {
                setActiveWorkspace("engineering");
                setActiveTab("eng_dashboard");
              }}
            />
          )}

          {/* ============================================================== */}
          {/* TRACK 2: ENGINEERING OPERATIONS (SEEKFACTORY)                  */}
          {/* ============================================================== */}
          {activeWorkspace === "engineering" && (
            <>
              {/* SPRINT OVERVIEW DASHBOARD (Matching Permitly 2-column image layout) */}
              {activeTab === "eng_dashboard" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column (Span 5) */}
                  <div className="lg:col-span-5 space-y-6">
                    <HeroSpotlightCard
                      featuredLog={workLogs[0]}
                      onViewDetails={() => {
                        if (workLogs[0]) {
                          setEditingLog(workLogs[0]);
                          setIsWorkLogModalOpen(true);
                        }
                      }}
                    />

                    <NeedsAttentionTable
                      logs={workLogs}
                      onResolveBlocker={handleResolveBlocker}
                      onSelectLog={(log) => {
                        setEditingLog(log);
                        setIsWorkLogModalOpen(true);
                      }}
                    />
                  </div>

                  {/* Right Column (Span 7) */}
                  <div className="lg:col-span-7 space-y-6">
                    <PortfolioMetrics logs={workLogs} />

                    <PipelineStageBar
                      logs={workLogs}
                      onOpenStage={() => setActiveTab("eng_daily_log")}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <AiInsightsCard
                        logs={workLogs}
                        onReviewRisks={() => setActiveTab("eng_blockers")}
                      />

                      <SpeedometerGauge
                        logs={workLogs}
                        onOpenCompliance={() => setActiveTab("eng_daily_log")}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 19-COLUMN DAILY WORK LOG */}
              {activeTab === "eng_daily_log" && (
                <DailyWorkLogSheet
                  logs={workLogs}
                  onAddLog={() => {
                    setEditingLog(null);
                    setIsWorkLogModalOpen(true);
                  }}
                  onEditLog={(log) => {
                    setEditingLog(log);
                    setIsWorkLogModalOpen(true);
                  }}
                  onDeleteLog={handleDeleteWorkLog}
                  onOpenSyncModal={() => setIsSyncModalOpen(true)}
                  onUpdateStatus={handleUpdateLogStatus}
                  activeDeveloperFilter={currentUser.category === "developer" ? currentUser.name : "All"}
                />
              )}

              {/* BLOCKER TRIAGE */}
              {activeTab === "eng_blockers" && (
                <div className="space-y-6">
                  <div className="bg-white rounded-3xl p-6 shadow-card-subtle border border-zinc-200/80 flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Active Blocker & Escalation Triage</h2>
                      <p className="text-xs text-zinc-500 mt-1">
                        Impediments requiring Tech Lead / DevOps unblocking
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingLog(null);
                        setIsWorkLogModalOpen(true);
                      }}
                      className="px-4 py-2 bg-[#E04F34] hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                    >
                      + Flag Blocker
                    </button>
                  </div>

                  <NeedsAttentionTable
                    logs={workLogs}
                    onResolveBlocker={handleResolveBlocker}
                    onSelectLog={(log) => {
                      setEditingLog(log);
                      setIsWorkLogModalOpen(true);
                    }}
                  />
                  <UserGuideSheet />
                </div>
              )}

              {/* TEAM ROSTER */}
              {activeTab === "eng_roster" && (
                <ConfigSheet
                  roster={roster}
                  repositories={repositories}
                  onUpdateRoster={setRoster}
                  isAdmin={currentUser.category === "founder" || currentUser.category === "admin"}
                />
              )}

              {/* SOP MANUAL */}
              {activeTab === "eng_sop" && <UserGuideSheet />}
            </>
          )}

          {/* ============================================================== */}
          {/* TRACK 3: FIELD MARKETING & SALES CRM (AXORAA MARKETING)       */}
          {/* ============================================================== */}
          {activeWorkspace === "marketing" && (
            <>
              {/* MARKETING DASHBOARD */}
              {activeTab === "mkt_dashboard" && (
                <MarketingDashboardView
                  deals={deals}
                  interactions={interactions}
                  onOpenDeals={() => setActiveTab("mkt_deals")}
                  onOpenInteractions={() => setActiveTab("mkt_interactions")}
                  onSelectDeal={(deal) => {
                    setEditingDeal(deal);
                    setIsDealModalOpen(true);
                  }}
                />
              )}

              {/* 36-COLUMN DEAL FINALIZATION TRACKER */}
              {activeTab === "mkt_deals" && (
                <DealFinalizationSheet
                  deals={deals}
                  onAddDeal={() => {
                    setEditingDeal(null);
                    setIsDealModalOpen(true);
                  }}
                  onEditDeal={(deal) => {
                    setEditingDeal(deal);
                    setIsDealModalOpen(true);
                  }}
                  onOpenInteractions={() => setActiveTab("mkt_interactions")}
                  activeRepFilter={currentUser.category === "marketing" ? currentUser.name : "All"}
                />
              )}

              {/* 23-COLUMN INTERACTIONS & VISIT LOG */}
              {activeTab === "mkt_interactions" && (
                <InteractionsSheet
                  interactions={interactions}
                  onAddInteraction={() => setIsInteractionModalOpen(true)}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* MODAL 1: Engineering Work Log */}
      <WorkLogModal
        isOpen={isWorkLogModalOpen}
        onClose={() => {
          setIsWorkLogModalOpen(false);
          setEditingLog(null);
        }}
        onSave={handleSaveWorkLog}
        initialData={editingLog}
        defaultDeveloper={currentUser.name}
      />

      {/* MODAL 2: Master Deal Finalization */}
      <DealModal
        isOpen={isDealModalOpen}
        onClose={() => {
          setIsDealModalOpen(false);
          setEditingDeal(null);
        }}
        onSave={handleSaveDeal}
        initialData={editingDeal}
        defaultRep={currentUser.category === "marketing" ? currentUser.name : "Kamil"}
      />

      {/* MODAL 3: Marketing Field Visit / Touchpoint Log */}
      <InteractionModal
        isOpen={isInteractionModalOpen}
        onClose={() => setIsInteractionModalOpen(false)}
        onSave={handleSaveInteraction}
        defaultRep={currentUser.category === "marketing" ? currentUser.name : "Kamil"}
      />

      {/* MODAL 4: Role Switcher (Founders, Marketing Reps, Developers) */}
      <RoleSwitcherModal
        isOpen={isRoleSwitcherOpen}
        onClose={() => setIsRoleSwitcherOpen(false)}
        currentUser={currentUser}
        onSelectUser={handleSelectUser}
      />

      {/* MODAL 5: Google Sheets Database Sync */}
      <GoogleSheetSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        config={sheetsConfig}
        onSaveConfig={setSheetsConfig}
        currentLogs={workLogs}
        onLogsUpdated={setWorkLogs}
      />
    </div>
  );
}
