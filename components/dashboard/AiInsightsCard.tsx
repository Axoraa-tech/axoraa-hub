"use client";

import React from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { DailyWorkLogEntry } from "@/lib/types";

interface AiInsightsCardProps {
  logs: DailyWorkLogEntry[];
  onReviewRisks: () => void;
}

export const AiInsightsCard: React.FC<AiInsightsCardProps> = ({ logs, onReviewRisks }) => {
  const blockedCount = logs.filter((l) => l.isBlocked === "Yes").length;
  const reviewCount = logs.filter((l) => l.reviewRequired === "Yes" && l.workStatus !== "Completed").length;

  return (
    <div className="bg-zinc-950 text-white rounded-3xl p-6 shadow-card-elevated flex flex-col justify-between space-y-5 border border-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#d4ff32] text-zinc-950 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 fill-current" />
          </div>
          <span className="text-xs font-bold tracking-tight text-white">Axoraa AI</span>
        </div>
        <span className="text-[11px] text-zinc-400 font-medium">real-time</span>
      </div>

      {/* Title */}
      <div>
        <h3 className="text-xl font-extrabold tracking-tight text-white leading-snug">
          {blockedCount > 0
            ? `${blockedCount} tasks at risk of slipping sprint`
            : "Engineering velocity optimal"}
        </h3>

        {/* Bullet points with colored indicators matching image */}
        <div className="mt-4 space-y-2.5 text-xs text-zinc-300">
          <div className="flex items-start gap-2.5">
            <span className="w-2 h-2 rounded-full bg-orange-500 mt-1 shrink-0"></span>
            <span>
              {blockedCount > 0
                ? `${blockedCount} critical blockers awaiting infrastructure or 3rd-party keys`
                : "Zero unresolved dependencies"}
            </span>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 mt-1 shrink-0"></span>
            <span>
              {reviewCount} pull requests awaiting tech lead peer review
            </span>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#d4ff32] mt-1 shrink-0"></span>
            <span>SeekFactory v2.4 staging release scheduled for Friday</span>
          </div>
        </div>
      </div>

      {/* Action Button - Neon Lime full width pill matching design */}
      <button
        onClick={onReviewRisks}
        className="w-full py-3 px-4 bg-[#d4ff32] hover:bg-[#c4f024] text-zinc-950 rounded-2xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 group cursor-pointer"
      >
        <span>Review & Triage Risks</span>
        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>
  );
};
