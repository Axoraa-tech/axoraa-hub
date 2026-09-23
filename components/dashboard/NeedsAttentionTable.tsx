"use client";

import React from "react";
import { DailyWorkLogEntry } from "@/lib/types";
import { PriorityBadge } from "@/components/common/StatusBadge";
import { Sparkles, SlidersHorizontal, CheckCircle2, AlertOctagon, User } from "lucide-react";

interface NeedsAttentionTableProps {
  logs: DailyWorkLogEntry[];
  onResolveBlocker: (id: string) => void;
  onSelectLog: (log: DailyWorkLogEntry) => void;
}

export const NeedsAttentionTable: React.FC<NeedsAttentionTableProps> = ({
  logs,
  onResolveBlocker,
  onSelectLog,
}) => {
  // Filter for blocked items or critical issues
  const blockedLogs = logs.filter((l) => l.isBlocked === "Yes" || l.workStatus === "Blocked");

  return (
    <div className="bg-white rounded-3xl p-6 shadow-card-subtle border border-zinc-200/80 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-100">
        <div>
          <h3 className="text-lg font-bold text-zinc-900 tracking-tight">Needs attention</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            {blockedLogs.length} active impediments flagged · updated in real-time
          </p>
        </div>

        {/* AI Ranking badge & filter buttons matching image */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#d4ff32] text-zinc-950 text-xs font-bold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 fill-current" />
            <span>Ranked by Axoraa AI</span>
          </div>
          <button className="w-8 h-8 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-colors">
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Blockers List / Table */}
      {blockedLogs.length === 0 ? (
        <div className="py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-zinc-800">No active blockers flagged!</h4>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            All team tasks are progressing smoothly. Any developer can set &quot;Blocked? = Yes&quot; in the Daily Work Log to escalate here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-100 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="pb-3 pl-1">Key</th>
                <th className="pb-3">Module & Description</th>
                <th className="pb-3">Developer</th>
                <th className="pb-3">Blocker Reason</th>
                <th className="pb-3">Priority</th>
                <th className="pb-3 text-right pr-1">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {blockedLogs.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-zinc-50/80 transition-colors group cursor-pointer"
                  onClick={() => onSelectLog(item)}
                >
                  <td className="py-3.5 pl-1 font-mono font-bold text-zinc-900 whitespace-nowrap">
                    {item.githubPr || "SF-TASK"}
                  </td>
                  <td className="py-3.5 pr-4 max-w-xs">
                    <div className="font-bold text-zinc-900 truncate">{item.module}</div>
                    <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                      {item.taskDescription}
                    </div>
                  </td>
                  <td className="py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 font-medium text-zinc-800">
                      <div className="w-5 h-5 rounded-full bg-zinc-200 text-zinc-700 flex items-center justify-center text-[10px] font-bold">
                        {item.developerName[0]}
                      </div>
                      <span>{item.developerName}</span>
                    </div>
                  </td>
                  <td className="py-3.5 pr-4 max-w-xs text-zinc-700">
                    <div className="flex items-center gap-1.5 text-rose-700 font-medium">
                      <AlertOctagon className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                      <span className="truncate">{item.blockerDetails || "Unspecified dependency"}</span>
                    </div>
                  </td>
                  <td className="py-3.5 whitespace-nowrap">
                    <PriorityBadge priority={item.priority} />
                  </td>
                  <td className="py-3.5 text-right pr-1 whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onResolveBlocker(item.id);
                      }}
                      className="px-3 py-1 bg-zinc-950 hover:bg-zinc-800 text-white rounded-full text-[11px] font-semibold transition-colors shadow-xs"
                    >
                      Resolve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
