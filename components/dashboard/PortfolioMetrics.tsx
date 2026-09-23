"use client";

import React, { useState } from "react";
import { DailyWorkLogEntry } from "@/lib/types";

interface PortfolioMetricsProps {
  logs: DailyWorkLogEntry[];
}

export const PortfolioMetrics: React.FC<PortfolioMetricsProps> = ({ logs }) => {
  const [timeRange, setTimeRange] = useState<"Today" | "7 days" | "30 days">("7 days");

  // Dynamic calculations from logs
  const totalItems = logs.length;
  const inProgressCount = logs.filter((l) => l.workStatus === "In Progress").length;
  const reviewCount = logs.filter((l) => l.reviewRequired === "Yes" && l.workStatus !== "Completed").length;
  const blockedCount = logs.filter((l) => l.isBlocked === "Yes" || l.workStatus === "Blocked").length;
  const completedCount = logs.filter((l) => l.workStatus === "Completed").length;
  const totalHours = logs.reduce((sum, l) => sum + (Number(l.hours) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Top Header with Date Switcher */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Portfolio & Telemetry</h2>
        <div className="flex items-center bg-zinc-200/70 p-1 rounded-full text-xs font-semibold">
          {(["Today", "7 days", "30 days"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3.5 py-1 rounded-full transition-all ${
                timeRange === range
                  ? "bg-zinc-950 text-white shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* 4 KPI Cards in a row matching image */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Dark Slate Card */}
        <div className="bg-zinc-950 text-white rounded-3xl p-5 shadow-card-elevated flex flex-col justify-between min-h-[130px] border border-zinc-900">
          <div className="text-xs text-zinc-400 font-medium">Active work items</div>
          <div className="text-3xl sm:text-4xl font-black tracking-tight mt-1">{totalItems}</div>
          <div className="text-xs text-zinc-400 font-medium mt-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d4ff32]"></span>
            <span>3 active repositories</span>
          </div>
        </div>

        {/* Card 2: In Progress */}
        <div className="bg-white rounded-3xl p-5 shadow-card-subtle border border-zinc-200/80 flex flex-col justify-between min-h-[130px]">
          <div className="text-xs text-zinc-500 font-medium">In development</div>
          <div className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tight mt-1">
            {inProgressCount}
          </div>
          <div className="text-xs text-emerald-600 font-semibold mt-2 flex items-center gap-1">
            <span>↗</span>
            <span>{completedCount} completed recently</span>
          </div>
        </div>

        {/* Card 3: Awaiting Review */}
        <div className="bg-white rounded-3xl p-5 shadow-card-subtle border border-zinc-200/80 flex flex-col justify-between min-h-[130px]">
          <div className="text-xs text-zinc-500 font-medium">Awaiting review</div>
          <div className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tight mt-1">
            {reviewCount}
          </div>
          <div className="text-xs text-zinc-400 font-medium mt-2">
            <span>{totalHours.toFixed(1)} hrs logged</span>
          </div>
        </div>

        {/* Card 4: Blocked / At Risk */}
        <div className="bg-white rounded-3xl p-5 shadow-card-subtle border border-zinc-200/80 flex flex-col justify-between min-h-[130px]">
          <div className="text-xs text-zinc-500 font-medium">Active Blockers</div>
          <div
            className={`text-3xl sm:text-4xl font-black tracking-tight mt-1 ${
              blockedCount > 0 ? "text-[#E04F34]" : "text-zinc-900"
            }`}
          >
            {blockedCount}
          </div>
          <div
            className={`text-xs font-semibold mt-2 ${
              blockedCount > 0 ? "text-[#E04F34]" : "text-emerald-600"
            }`}
          >
            {blockedCount > 0 ? "needs action today" : "all systems clear"}
          </div>
        </div>
      </div>
    </div>
  );
};
