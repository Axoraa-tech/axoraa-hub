"use client";

import React from "react";
import { UserProfile } from "@/lib/types";
import { Search, Bell, Plus, AlertCircle, ChevronDown, Calendar, AlertTriangle } from "lucide-react";
import { WorkspaceType } from "./Sidebar";

interface TopNavProps {
  currentUser: UserProfile;
  activeWorkspace: WorkspaceType;
  blockerCount: number;
  overduePaymentCount: number;
  onOpenRoleSwitcher: () => void;
  onOpenNewModal: () => void;
  onOpenSyncModal: () => void;
  onActionClick: () => void;
  searchTerm: string;
  onSearchChange: (val: string) => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  currentUser,
  activeWorkspace,
  blockerCount,
  overduePaymentCount,
  onOpenRoleSwitcher,
  onOpenNewModal,
  onOpenSyncModal,
  onActionClick,
  searchTerm,
  onSearchChange,
}) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <header className="h-18 bg-white/95 backdrop-blur-md border-b border-zinc-200/70 px-6 sm:px-8 flex items-center justify-between sticky top-0 z-20">
      {/* Left: Greeting & Contextual Alert Badge */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
          {getGreeting()}, <span className="text-zinc-900">{currentUser.name.split(" ")[0]}</span>
        </h1>

        {/* Dynamic Contextual Alert Pill matching Permitly reference */}
        {activeWorkspace === "founders" && overduePaymentCount > 0 && (
          <button
            onClick={onActionClick}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors border border-rose-200 shadow-2xs cursor-pointer"
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>₹6L payment overdue</span>
          </button>
        )}

        {activeWorkspace === "engineering" && blockerCount > 0 && (
          <button
            onClick={onActionClick}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#d4ff32] text-zinc-950 hover:bg-[#c4f024] transition-colors border border-[#c4f024] shadow-2xs cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-zinc-950" />
            <span>{blockerCount} items need attention</span>
          </button>
        )}

        {activeWorkspace === "marketing" && (
          <button
            onClick={onActionClick}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors border border-purple-200 shadow-2xs cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-purple-600" />
            <span>2 follow-ups pending today</span>
          </button>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block w-64 lg:w-72">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={
              activeWorkspace === "founders"
                ? "Search accounts, values..."
                : activeWorkspace === "marketing"
                ? "Search leads, reps..."
                : "Search modules, PRs..."
            }
            className="w-full pl-9 pr-11 py-1.5 bg-zinc-50 border border-zinc-200 hover:border-zinc-300 rounded-full text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all"
          />
          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
            <span className="text-[10px] font-mono font-bold bg-[#d4ff32] text-zinc-900 px-1.5 py-0.5 rounded">
              ⌘K
            </span>
          </div>
        </div>

        {/* Notifications Icon Button */}
        <button
          onClick={onActionClick}
          className="relative w-9 h-9 rounded-full border border-zinc-200/80 flex items-center justify-center text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
          title="Alerts and Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#E04F34]"></span>
        </button>

        {/* Primary "+ Add" Button - sleek dark pill */}
        <button
          onClick={onOpenNewModal}
          className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>
            {activeWorkspace === "founders" && "New Account"}
            {activeWorkspace === "engineering" && "Log Entry"}
            {activeWorkspace === "marketing" && "New Deal"}
          </span>
        </button>

        {/* User Persona & Role Switcher */}
        <div className="border-l border-zinc-200 pl-3 ml-1">
          <button
            onClick={onOpenRoleSwitcher}
            className="flex items-center gap-2 p-1 rounded-full hover:bg-zinc-100 transition-colors group text-left cursor-pointer"
            title="Switch User / Role"
          >
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-7 h-7 rounded-full object-cover ring-1 ring-zinc-300 group-hover:ring-zinc-500 transition-all"
            />
            <div className="hidden xl:block text-left pr-1">
              <div className="text-xs font-semibold text-zinc-900 leading-tight flex items-center gap-1">
                {currentUser.name}
                <ChevronDown className="w-3 h-3 text-zinc-400" />
              </div>
              <div className="text-[10px] text-zinc-400 font-medium leading-none mt-0.5">
                {currentUser.roleTitle.split("/")[0]}
              </div>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};
