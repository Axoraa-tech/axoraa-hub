"use client";

import React from "react";
import { ArrowUpRight } from "lucide-react";
import { DailyWorkLogEntry } from "@/lib/types";

interface SpeedometerGaugeProps {
  logs: DailyWorkLogEntry[];
  onOpenCompliance?: () => void;
}

export const SpeedometerGauge: React.FC<SpeedometerGaugeProps> = ({ logs, onOpenCompliance }) => {
  const total = logs.length;
  const completed = logs.filter((l) => l.workStatus === "Completed").length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 88;

  // SVG Gauge calculations (semi-circle speedometer from -180 to 0 deg)
  const radius = 70;
  const strokeWidth = 10;
  const circumference = Math.PI * radius; // Half-circle
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="bg-white rounded-3xl p-6 shadow-card-subtle border border-zinc-200/80 flex flex-col justify-between space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-900">Sprint compliance</h3>
        <button
          onClick={onOpenCompliance}
          className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-700 transition-colors shadow-xs"
        >
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>

      {/* Neon Lime Speedometer Container - matching the design image */}
      <div className="bg-[#d4ff32] rounded-3xl p-6 text-zinc-950 flex flex-col items-center justify-center relative overflow-hidden border border-[#c4f024]">
        {/* Radial Speedometer Dial */}
        <div className="relative w-48 h-28 flex items-center justify-center">
          <svg className="w-48 h-32 overflow-visible" viewBox="0 0 160 90">
            {/* Background Arch Track */}
            <path
              d="M 15 80 A 65 65 0 0 1 145 80"
              fill="none"
              stroke="rgba(0, 0, 0, 0.15)"
              strokeWidth="12"
              strokeLinecap="round"
            />
            {/* Dotted Tickmarks Effect */}
            <path
              d="M 15 80 A 65 65 0 0 1 145 80"
              fill="none"
              stroke="#121316"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray="204"
              strokeDashoffset={204 - (percentage / 100) * 204}
              className="transition-all duration-1000 ease-out"
            />
          </svg>

          {/* Centered Percentage Display */}
          <div className="absolute bottom-0 flex flex-col items-center">
            <span className="text-4xl font-black text-zinc-950 tracking-tight leading-none">
              {percentage}<span className="text-2xl font-bold">%</span>
            </span>
            <span className="text-[11px] font-bold text-zinc-800 uppercase tracking-wider mt-1">
              ready to release
            </span>
          </div>
        </div>

        {/* Bottom Status Bar inside the lime card */}
        <div className="w-full mt-4 bg-white/90 backdrop-blur-xs rounded-xl px-3 py-2 flex items-center justify-between text-xs font-bold text-zinc-900 shadow-xs">
          <span className="truncate">SeekFactory Sprint v2.4</span>
          <span className="text-zinc-700 shrink-0 font-mono">
            {completed} / {total} done
          </span>
        </div>
      </div>
    </div>
  );
};
