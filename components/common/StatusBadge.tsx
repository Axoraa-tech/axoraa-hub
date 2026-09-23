import React from "react";
import { WorkStatus, PriorityLevel, BlockedFlag, ProductionImpactLevel } from "@/lib/types";

interface StatusBadgeProps {
  status?: WorkStatus | string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = "" }) => {
  switch (status) {
    case "Completed":
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Completed
        </span>
      );
    case "In Progress":
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/60 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
          In Progress
        </span>
      );
    case "Blocked":
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200/60 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          Blocked
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 ${className}`}>
          {status || "Unknown"}
        </span>
      );
  }
};

interface PriorityBadgeProps {
  priority?: PriorityLevel | string;
  className?: string;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, className = "" }) => {
  switch (priority) {
    case "Critical":
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#E04F34] text-white shadow-xs ${className}`}>
          Critical
        </span>
      );
    case "High":
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#E04F34] text-white shadow-xs ${className}`}>
          High
        </span>
      );
    case "Medium":
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 ${className}`}>
          Medium
        </span>
      );
    case "Low":
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 ${className}`}>
          Low
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 ${className}`}>
          {priority || "-"}
        </span>
      );
  }
};

interface BlockedBadgeProps {
  isBlocked: BlockedFlag | string;
}

export const BlockedBadge: React.FC<BlockedBadgeProps> = ({ isBlocked }) => {
  if (isBlocked === "Yes") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
        Blocked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs text-slate-500 bg-slate-100">
      No
    </span>
  );
};

interface ImpactBadgeProps {
  impact?: ProductionImpactLevel | string;
}

export const ImpactBadge: React.FC<ImpactBadgeProps> = ({ impact }) => {
  switch (impact) {
    case "High":
      return <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded">High</span>;
    case "Medium":
      return <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Medium</span>;
    case "Low":
      return <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Low</span>;
    default:
      return <span className="text-xs text-slate-400">None</span>;
  }
};
