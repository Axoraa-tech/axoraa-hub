"use client";

import React from "react";
import { INITIAL_SOP_GUIDE } from "@/lib/mockData";
import { BookOpen, AlertOctagon, CheckCircle2, XCircle, ArrowRight, ShieldCheck } from "lucide-react";

export const UserGuideSheet: React.FC = () => {
  const guide = INITIAL_SOP_GUIDE;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 shadow-card-subtle border border-zinc-200/80">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-zinc-950 text-white flex items-center justify-center">
            <BookOpen className="w-4 h-4" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Engineering SOP & Field Reference Manual</h2>
        </div>
        <p className="text-xs text-zinc-500 mt-1 max-w-3xl">
          Standard Operating Procedures (SOP) covering daily routines, blocker escalation protocols, and engineering golden rules for the AXORAA Dev Team.
        </p>
      </div>

      {/* Section 1: Workbook Map */}
      <div className="bg-white rounded-3xl p-6 shadow-card-subtle border border-zinc-200/80 space-y-4">
        <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-800">1</span>
          <span>Workbook Architecture Map</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {guide.workbookMap.map((tab, i) => (
            <div key={i} className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/70 flex flex-col justify-between">
              <div>
                <span className="font-bold text-sm text-zinc-900">{tab.tab}</span>
                <p className="text-xs text-zinc-600 mt-1 leading-relaxed">{tab.purpose}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-zinc-200/60 text-[11px] text-zinc-500 space-y-0.5">
                <div>Audience: <strong className="text-zinc-800">{tab.audience}</strong></div>
                <div>Update: <strong className="text-zinc-800">{tab.frequency}</strong></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Daily Developer Routine */}
      <div className="bg-white rounded-3xl p-6 shadow-card-subtle border border-zinc-200/80 space-y-4">
        <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-[#d4ff32] flex items-center justify-center text-xs font-bold text-zinc-950">2</span>
          <span>Daily Developer 5-Step Routine</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {guide.dailySteps.map((step, i) => (
            <div key={i} className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/70 flex flex-col justify-between">
              <span className="text-xs font-black text-zinc-400">0{i + 1}</span>
              <p className="text-xs font-semibold text-zinc-800 mt-2 leading-relaxed">{step}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Blocker Escalation Protocol */}
      <div className="bg-white rounded-3xl p-6 shadow-card-subtle border border-zinc-200/80 space-y-4">
        <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center text-xs font-bold text-rose-700">3</span>
          <span>Blocker Escalation Protocol (P1 - P4)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {guide.escalationLevels.map((esc, i) => (
            <div key={i} className="p-5 rounded-2xl border border-zinc-200 bg-white space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${esc.badgeColor}`}>
                  {esc.level}
                </span>
              </div>
              <div>
                <div className="text-[11px] font-bold text-zinc-400 uppercase">Trigger</div>
                <div className="text-xs font-medium text-zinc-800 mt-0.5">{esc.trigger}</div>
              </div>
              <div className="pt-2 border-t border-zinc-100">
                <div className="text-[11px] font-bold text-zinc-400 uppercase">Mandatory Action</div>
                <div className="text-xs font-semibold text-zinc-900 mt-0.5 bg-zinc-50 p-2.5 rounded-xl border border-zinc-200/60">
                  {esc.action}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 4: Golden Rules (Do's and Don'ts) */}
      <div className="bg-white rounded-3xl p-6 shadow-card-subtle border border-zinc-200/80 space-y-4">
        <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700">4</span>
          <span>Engineering Golden Rules (Do&apos;s and Don&apos;ts)</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
              <tr>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-emerald-800">DO (Standard Practice)</th>
                <th className="py-3 px-4 text-rose-800">DON&apos;T (Prohibited)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {guide.goldenRules.map((rule, i) => (
                <tr key={i} className="hover:bg-zinc-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-zinc-900 whitespace-nowrap">{rule.category}</td>
                  <td className="py-3.5 px-4 text-emerald-700 font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{rule.do}</span>
                  </td>
                  <td className="py-3.5 px-4 text-rose-700 font-medium">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>{rule.dont}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
