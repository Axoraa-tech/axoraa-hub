"use client";

import React, { useState } from "react";
import { MarketingCampaign } from "@/lib/types";
import { TrendingUp, Target, Users, DollarSign, Plus } from "lucide-react";

interface MarketingSheetProps {
  campaigns: MarketingCampaign[];
  onAddCampaign?: () => void;
}

export const MarketingSheet: React.FC<MarketingSheetProps> = ({ campaigns, onAddCampaign }) => {
  const totalBudget = campaigns.reduce((acc, c) => acc + c.budget, 0);
  const totalSpent = campaigns.reduce((acc, c) => acc + c.spent, 0);
  const totalLeads = campaigns.reduce((acc, c) => acc + c.leadsGenerated, 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 shadow-card-subtle border border-zinc-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Marketing Operations & Growth</h2>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              Project 2 · 3 Team Members
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Tracking paid acquisition, B2B leads, organic content, and marketing campaign budgets.
          </p>
        </div>

        <button
          onClick={onAddCampaign}
          className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Campaign</span>
        </button>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-5 shadow-card-subtle border border-zinc-200/80">
          <div className="text-xs text-zinc-500 font-medium">Total Marketing Budget</div>
          <div className="text-3xl font-black text-zinc-900 tracking-tight mt-1">
            ${totalBudget.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-400 mt-2 font-medium">
            Spent: ${totalSpent.toLocaleString()} ({Math.round((totalSpent / (totalBudget || 1)) * 100)}%)
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-card-subtle border border-zinc-200/80">
          <div className="text-xs text-zinc-500 font-medium">Qualified Leads Acquired</div>
          <div className="text-3xl font-black text-zinc-900 tracking-tight mt-1">
            {totalLeads}
          </div>
          <div className="text-xs text-emerald-600 font-semibold mt-2">
            Cost per Lead: ${(totalSpent / (totalLeads || 1)).toFixed(1)}
          </div>
        </div>

        <div className="bg-zinc-950 text-white rounded-3xl p-5 shadow-card-elevated border border-zinc-900">
          <div className="text-xs text-zinc-400 font-medium">Assigned Marketing Specialists</div>
          <div className="text-3xl font-black text-[#d4ff32] tracking-tight mt-1">3 Leads</div>
          <div className="text-xs text-zinc-400 mt-2">
            Priya Rao (Lead), Rohan (Paid), Sneha (SEO)
          </div>
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="bg-white rounded-3xl shadow-card-subtle border border-zinc-200/80 overflow-hidden">
        <div className="p-6 border-b border-zinc-100">
          <h3 className="text-sm font-bold text-zinc-900">Active Growth Campaigns</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
              <tr>
                <th className="py-3 px-6">Campaign Name</th>
                <th className="py-3 px-4">Client / Brand</th>
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Budget / Spent</th>
                <th className="py-3 px-4">Leads</th>
                <th className="py-3 px-4">Owner</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-6">End Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {campaigns.map((camp) => (
                <tr key={camp.id} className="hover:bg-zinc-50/80 transition-colors">
                  <td className="py-4 px-6 font-bold text-zinc-900">{camp.name}</td>
                  <td className="py-4 px-4 text-zinc-600">{camp.client}</td>
                  <td className="py-4 px-4">
                    <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 font-medium text-[11px]">
                      {camp.platform}
                    </span>
                  </td>
                  <td className="py-4 px-4 font-mono font-medium">
                    ${camp.spent.toLocaleString()} / <span className="text-zinc-400">${camp.budget.toLocaleString()}</span>
                  </td>
                  <td className="py-4 px-4 font-bold text-zinc-900">{camp.leadsGenerated}</td>
                  <td className="py-4 px-4 text-zinc-700 font-medium">{camp.owner}</td>
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      {camp.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-mono text-zinc-500">{camp.endDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
