"use client";

import React from "react";
import { ArrowUpRight, GitPullRequest, ShieldCheck, CheckCircle } from "lucide-react";
import { DailyWorkLogEntry } from "@/lib/types";

interface HeroSpotlightCardProps {
  featuredLog?: DailyWorkLogEntry;
  onViewDetails?: () => void;
}

export const HeroSpotlightCard: React.FC<HeroSpotlightCardProps> = ({
  featuredLog,
  onViewDetails,
}) => {
  const log = featuredLog || {
    id: "spotlight-default",
    date: "2026-09-23",
    developerName: "Akshar",
    project: "SeekFactory",
    repository: "seekfactory-b",
    module: "Auth Microservice",
    workType: "Authentication / Authorization",
    taskDescription: "Implemented JWT refresh token rotation with Redis revocation list & distributed session lock",
    githubPr: "#142",
    workStatus: "In Progress",
    priority: "Critical",
    hours: 7.5,
    isBlocked: "No",
    blockerDetails: "",
    reviewRequired: "Yes",
    reviewer: "Manish",
    deployment: "Staging",
    productionImpact: "High",
    notes: "Requires Redis cache migration before production deployment.",
    lastUpdated: "2026-09-23 15:40:12",
  };

  return (
    <div className="relative rounded-3xl overflow-hidden border border-zinc-200/90 shadow-card-elevated bg-zinc-900 min-h-[340px] flex flex-col justify-between p-6">
      {/* Background Graphic Pattern */}
      <div className="absolute inset-0 bg-gradient-to-tr from-zinc-950 via-zinc-900 to-zinc-800 opacity-95"></div>
      <div className="absolute top-0 right-0 w-80 h-80 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#d4ff32]/15 via-transparent to-transparent pointer-events-none"></div>

      {/* Top Header Chips */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white text-xs font-semibold">
          <GitPullRequest className="w-3.5 h-3.5 text-[#d4ff32]" />
          <span>{log.githubPr || "SF-PR-142"}</span>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 backdrop-blur-md border border-amber-400/30 text-amber-300 text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
          <span>{log.reviewRequired === "Yes" ? "Under review" : "Active Development"}</span>
        </div>
      </div>

      {/* Center Visual Context */}
      <div className="relative z-10 my-4">
        <span className="text-xs uppercase tracking-wider text-[#d4ff32] font-bold">
          High Priority Milestone · {log.project}
        </span>
        <h3 className="text-xl sm:text-2xl font-extrabold text-white mt-1 leading-snug line-clamp-2">
          {log.module}: {log.taskDescription}
        </h3>
      </div>

      {/* Bottom Floating White Overlay Card - Exact matching Permitly design */}
      <div className="relative z-10 bg-white rounded-2xl p-4 shadow-xl border border-zinc-100 text-zinc-900">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              <span>{log.module}</span>
              <span className="text-[11px] font-medium text-zinc-500">by {log.developerName}</span>
            </h4>
            <p className="text-xs text-zinc-500 mt-0.5">
              Target Repo: <span className="font-mono text-zinc-700">{log.repository}</span> · {log.workType}
            </p>
          </div>
          <button
            onClick={onViewDetails}
            className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-700 transition-colors shadow-xs"
            title="Inspect Details"
          >
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar matching design */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs font-semibold mb-1">
            <span className="text-zinc-600">Implementation Progress</span>
            <span className="text-zinc-900 font-bold">
              {log.workStatus === "Completed" ? "100%" : "78%"}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
            <div
              className="h-full bg-zinc-900 rounded-full transition-all duration-500"
              style={{ width: log.workStatus === "Completed" ? "100%" : "78%" }}
            ></div>
          </div>
        </div>

        {/* 3 Metric Columns matching bottom of the Permitly card */}
        <div className="mt-3 pt-3 border-t border-zinc-100 grid grid-cols-3 gap-2 text-left">
          <div>
            <div className="text-[10px] text-zinc-400 uppercase font-semibold">Effort</div>
            <div className="text-xs font-bold text-zinc-800 mt-0.5">{log.hours} hrs</div>
          </div>
          <div className="border-l border-zinc-100 pl-2">
            <div className="text-[10px] text-zinc-400 uppercase font-semibold">Stage</div>
            <div className="text-xs font-bold text-zinc-800 mt-0.5 truncate">
              {log.reviewRequired === "Yes" ? "Peer Review" : "In Dev"}
            </div>
          </div>
          <div className="border-l border-zinc-100 pl-2">
            <div className="text-[10px] text-zinc-400 uppercase font-semibold">Signoff</div>
            <div className="text-xs font-bold text-zinc-800 mt-0.5 truncate">
              {log.reviewer || "Akshar"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
