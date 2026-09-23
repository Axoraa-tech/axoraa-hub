"use client";

import React from "react";
import { ChevronRight } from "lucide-react";
import { DailyWorkLogEntry } from "@/lib/types";

interface PipelineStageBarProps {
  logs: DailyWorkLogEntry[];
  onOpenStage?: (stage: string) => void;
}

export const PipelineStageBar: React.FC<PipelineStageBarProps> = ({ logs, onOpenStage }) => {
  const completed = logs.filter((l) => l.workStatus === "Completed").length;
  const inProgress = logs.filter((l) => l.workStatus === "In Progress").length;
  const review = logs.filter((l) => l.reviewRequired === "Yes" && l.workStatus !== "Completed").length;
  const blocked = logs.filter((l) => l.isBlocked === "Yes").length;

  const stages = [
    { name: "Architecture", count: 8, color: "bg-zinc-200" },
    { name: "In Dev", count: Math.max(inProgress, 4), color: "bg-[#d4ff32]" },
    { name: "Review", count: Math.max(review, 3), color: "bg-zinc-300" },
    { name: "QA / Test", count: 6, color: "bg-zinc-200" },
    { name: "Production", count: Math.max(completed, 5), color: "bg-zinc-950 text-white" },
  ];

  return (
    <div className="bg-white rounded-3xl p-5 shadow-card-subtle border border-zinc-200/80 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-900">Project pipeline</h3>
        <button
          onClick={() => onOpenStage?.("all")}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-900 flex items-center gap-1 transition-colors"
        >
          <span>Average velocity 1.8 days</span>
          <span className="font-bold text-zinc-800 ml-1">Open</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Segmented Bar matching design */}
      <div className="flex gap-1.5 h-5 rounded-full overflow-hidden p-0.5 bg-zinc-100">
        <div className="flex-[2] bg-zinc-300/80 rounded-full"></div>
        <div className="flex-[4] bg-[#d4ff32] rounded-full shadow-xs"></div>
        <div className="flex-[2] bg-zinc-300 rounded-full"></div>
        <div className="flex-[2] bg-zinc-200 rounded-full"></div>
        <div className="flex-[3] bg-zinc-950 rounded-full"></div>
      </div>

      {/* Stage labels & counts below bar */}
      <div className="grid grid-cols-5 gap-2 pt-1">
        {stages.map((st, i) => (
          <div key={i} className="text-left">
            <div className="text-sm font-black text-zinc-900">{st.count}</div>
            <div className="text-[11px] text-zinc-500 truncate">{st.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
