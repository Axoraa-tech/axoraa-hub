"use client";

import React from "react";
import {
  LayoutDashboard,
  ClipboardList,
  AlertCircle,
  Users,
  BookOpen,
  DollarSign,
  ChevronDown,
  Sparkles,
  Database,
  Layers,
  ShieldCheck,
  Briefcase,
  MapPin,
  Building2,
  Code2,
  TrendingUp,
} from "lucide-react";

export type WorkspaceType = "founders" | "engineering" | "marketing";

export type ActiveTab =
  // Founders tabs
  | "founders_dashboard"
  | "founders_clients"
  | "founders_billing"
  // Engineering tabs
  | "eng_dashboard"
  | "eng_daily_log"
  | "eng_blockers"
  | "eng_roster"
  | "eng_sop"
  // Marketing tabs
  | "mkt_dashboard"
  | "mkt_deals"
  | "mkt_interactions"
  | "mkt_queue";

interface SidebarProps {
  activeWorkspace: WorkspaceType;
  onWorkspaceChange: (ws: WorkspaceType) => void;
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  blockerCount: number;
  totalLogCount: number;
  dealCount: number;
  overduePaymentCount: number;
  onOpenSyncModal: () => void;
  isAiEnabled: boolean;
  onToggleAi: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeWorkspace,
  onWorkspaceChange,
  activeTab,
  onTabChange,
  blockerCount,
  totalLogCount,
  dealCount,
  overduePaymentCount,
  onOpenSyncModal,
  isAiEnabled,
  onToggleAi,
}) => {
  return (
    <aside className="w-64 bg-white border-r border-zinc-200/70 flex flex-col justify-between h-screen sticky top-0 shrink-0 select-none z-30">
      <div className="p-4 flex flex-col gap-4 overflow-y-auto">
        {/* Brand & Logo */}
        <div className="flex items-center justify-between px-2 pt-1 pb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-950 flex items-center justify-center text-white shadow-xs">
              <div className="grid grid-cols-2 gap-1 w-3.5 h-3.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#d4ff32]"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-[#d4ff32]"></div>
              </div>
            </div>
            <span className="font-bold text-base tracking-tight text-zinc-900">
              Axoraa<span className="text-[#98c000] ml-0.5">.</span>
            </span>
          </div>
          <button
            onClick={onOpenSyncModal}
            title="Google Sheets Database Settings"
            className="w-7 h-7 rounded-lg border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:border-zinc-300 transition-colors"
          >
            <Database className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Workspace Switcher - Clean Corporate Dropdown */}
        <div>
          <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-1 mb-1.5">
            Workspace
          </div>
          <button
            onClick={() => {
              if (activeWorkspace === "founders") {
                onWorkspaceChange("engineering");
                onTabChange("eng_dashboard");
              } else if (activeWorkspace === "engineering") {
                onWorkspaceChange("marketing");
                onTabChange("mkt_dashboard");
              } else {
                onWorkspaceChange("founders");
                onTabChange("founders_dashboard");
              }
            }}
            className="w-full p-2.5 rounded-2xl bg-zinc-50 border border-zinc-200/80 hover:bg-zinc-100/70 hover:border-zinc-300 transition-all flex items-center justify-between text-left group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-zinc-900 flex items-center justify-center text-white shrink-0 shadow-xs">
                {activeWorkspace === "founders" && <Building2 className="w-3.5 h-3.5 text-zinc-200" />}
                {activeWorkspace === "engineering" && <Code2 className="w-3.5 h-3.5 text-[#d4ff32]" />}
                {activeWorkspace === "marketing" && <TrendingUp className="w-3.5 h-3.5 text-zinc-200" />}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-zinc-900 truncate">
                  {activeWorkspace === "founders" && "Executive Command"}
                  {activeWorkspace === "engineering" && "Engineering Operations"}
                  {activeWorkspace === "marketing" && "Field Marketing CRM"}
                </div>
                <div className="text-[11px] text-zinc-400 truncate">
                  {activeWorkspace === "founders" && "₹1.59 Cr Portfolio"}
                  {activeWorkspace === "engineering" && "SeekFactory · 7 Devs"}
                  {activeWorkspace === "marketing" && "Pipeline & Field Visits"}
                </div>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 shrink-0 ml-1 transition-colors" />
          </button>
        </div>

        {/* Dynamic Navigation according to active workspace */}

        {/* TRACK 1: FOUNDERS & EXECUTIVE COMMAND */}
        {activeWorkspace === "founders" && (
          <div className="space-y-0.5">
            <div className="px-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              Executive
            </div>

            <button
              onClick={() => onTabChange("founders_dashboard")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeTab === "founders_dashboard"
                  ? "bg-zinc-900 text-white font-semibold shadow-xs"
                  : "text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-900"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Building2 className="w-4 h-4 text-zinc-400" />
                <span>Executive Overview</span>
              </div>
            </button>

            <button
              onClick={() => onTabChange("founders_clients")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeTab === "founders_clients"
                  ? "bg-zinc-900 text-white font-semibold shadow-xs"
                  : "text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-900"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Briefcase className="w-4 h-4 text-zinc-400" />
                <span>Client Portfolio</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded-md font-semibold bg-zinc-100 text-zinc-600">
                8
              </span>
            </button>

            <button
              onClick={() => onTabChange("founders_billing")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeTab === "founders_billing"
                  ? "bg-zinc-900 text-white font-semibold shadow-xs"
                  : "text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-900"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <DollarSign className="w-4 h-4 text-zinc-400" />
                <span>Invoicing & Collections</span>
              </div>
              {overduePaymentCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-md font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                  {overduePaymentCount} Overdue
                </span>
              )}
            </button>
          </div>
        )}

        {/* TRACK 2: ENGINEERING OPS (SEEKFACTORY) */}
        {activeWorkspace === "engineering" && (
          <div className="space-y-0.5">
            <div className="px-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              Engineering
            </div>

            <button
              onClick={() => onTabChange("eng_dashboard")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeTab === "eng_dashboard"
                  ? "bg-zinc-900 text-white font-semibold shadow-xs"
                  : "text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-900"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className="w-4 h-4 text-zinc-400" />
                <span>Sprint Overview</span>
              </div>
            </button>

            <button
              onClick={() => onTabChange("eng_daily_log")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeTab === "eng_daily_log"
                  ? "bg-zinc-900 text-white font-semibold shadow-xs"
                  : "text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-900"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ClipboardList className="w-4 h-4 text-zinc-400" />
                <span>Daily Work Log</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded-md font-semibold bg-zinc-100 text-zinc-600">
                {totalLogCount}
              </span>
            </button>

            <button
              onClick={() => onTabChange("eng_blockers")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeTab === "eng_blockers"
                  ? "bg-zinc-900 text-white font-semibold shadow-xs"
                  : "text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-900"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <AlertCircle className={`w-4 h-4 ${blockerCount > 0 ? "text-rose-500" : "text-zinc-400"}`} />
                <span>Blocker Triage</span>
              </div>
              {blockerCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-md font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                  {blockerCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onTabChange("eng_roster")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeTab === "eng_roster"
                  ? "bg-zinc-900 text-white font-semibold shadow-xs"
                  : "text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-900"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-zinc-400" />
                <span>Team Roster</span>
              </div>
            </button>

            <button
              onClick={() => onTabChange("eng_sop")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeTab === "eng_sop"
                  ? "bg-zinc-900 text-white font-semibold shadow-xs"
                  : "text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-900"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-zinc-400" />
                <span>SOP Guidelines</span>
              </div>
            </button>
          </div>
        )}

        {/* TRACK 3: FIELD MARKETING & SALES CRM */}
        {activeWorkspace === "marketing" && (
          <div className="space-y-0.5">
            <div className="px-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              Sales Pipeline
            </div>

            <button
              onClick={() => onTabChange("mkt_dashboard")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeTab === "mkt_dashboard"
                  ? "bg-zinc-900 text-white font-semibold shadow-xs"
                  : "text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-900"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className="w-4 h-4 text-zinc-400" />
                <span>Pipeline Analytics</span>
              </div>
            </button>

            <button
              onClick={() => onTabChange("mkt_deals")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeTab === "mkt_deals"
                  ? "bg-zinc-900 text-white font-semibold shadow-xs"
                  : "text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-900"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Briefcase className="w-4 h-4 text-zinc-400" />
                <span>Deal Tracker</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded-md font-semibold bg-zinc-100 text-zinc-600">
                {dealCount}
              </span>
            </button>

            <button
              onClick={() => onTabChange("mkt_interactions")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeTab === "mkt_interactions"
                  ? "bg-zinc-900 text-white font-semibold shadow-xs"
                  : "text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-900"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-zinc-400" />
                <span>Visit & Touchpoint Log</span>
              </div>
            </button>
          </div>
        )}

        {/* Minimalist Segmented Workspace Selector (Clean corporate finish) */}
        <div className="pt-3 border-t border-zinc-100">
          <div className="bg-zinc-100/80 p-1 rounded-xl flex items-center gap-1 text-[11px] font-semibold text-zinc-600">
            <button
              onClick={() => {
                onWorkspaceChange("founders");
                onTabChange("founders_dashboard");
              }}
              className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
                activeWorkspace === "founders"
                  ? "bg-white text-zinc-900 shadow-xs font-bold"
                  : "hover:text-zinc-900"
              }`}
            >
              Exec
            </button>
            <button
              onClick={() => {
                onWorkspaceChange("engineering");
                onTabChange("eng_dashboard");
              }}
              className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
                activeWorkspace === "engineering"
                  ? "bg-white text-zinc-900 shadow-xs font-bold"
                  : "hover:text-zinc-900"
              }`}
            >
              Dev
            </button>
            <button
              onClick={() => {
                onWorkspaceChange("marketing");
                onTabChange("mkt_dashboard");
              }}
              className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
                activeWorkspace === "marketing"
                  ? "bg-white text-zinc-900 shadow-xs font-bold"
                  : "hover:text-zinc-900"
              }`}
            >
              CRM
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Neon Lime AI Card - Exact replica of Permit AI card from reference */}
      <div className="p-3">
        <div className="bg-[#d4ff32] rounded-2xl p-4 text-zinc-950 shadow-xs border border-[#c4f024] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-zinc-950 text-white flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-[#d4ff32]" />
              </div>
              <div>
                <div className="text-xs font-bold leading-tight">Axoraa AI</div>
                <div className="text-[10px] text-zinc-700 font-medium">
                  {activeWorkspace === "founders" && "Portfolio Telemetry"}
                  {activeWorkspace === "engineering" && `${totalLogCount} active items`}
                  {activeWorkspace === "marketing" && `${dealCount} active accounts`}
                </div>
              </div>
            </div>

            <button
              onClick={onToggleAi}
              className={`w-9 h-5 rounded-full transition-colors p-0.5 flex items-center ${
                isAiEnabled ? "bg-zinc-950 justify-end" : "bg-zinc-300 justify-start"
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-xs"></div>
            </button>
          </div>

          <button
            onClick={() => {
              if (activeWorkspace === "founders") onTabChange("founders_billing");
              else if (activeWorkspace === "engineering") onTabChange("eng_blockers");
              else onTabChange("mkt_dashboard");
            }}
            className="bg-white/80 hover:bg-white rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center justify-between text-zinc-900 transition-colors shadow-xs"
          >
            <span>
              {activeWorkspace === "founders" && `${overduePaymentCount} overdue payment`}
              {activeWorkspace === "engineering" && `${blockerCount} need attention`}
              {activeWorkspace === "marketing" && "Review sales queue"}
            </span>
            <span className="text-zinc-400 group-hover:text-zinc-700 text-sm font-normal">&rsaquo;</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
