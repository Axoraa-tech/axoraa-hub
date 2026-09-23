"use client";

import React from "react";
import { MarketingDeal, MarketingInteraction } from "@/lib/types";
import {
  TrendingUp,
  Target,
  Users,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  MapPin,
  Sparkles,
} from "lucide-react";

interface MarketingDashboardViewProps {
  deals: MarketingDeal[];
  interactions: MarketingInteraction[];
  onOpenDeals: () => void;
  onOpenInteractions: () => void;
  onSelectDeal: (deal: MarketingDeal) => void;
}

export const MarketingDashboardView: React.FC<MarketingDashboardViewProps> = ({
  deals,
  interactions,
  onOpenDeals,
  onOpenInteractions,
  onSelectDeal,
}) => {
  // Calculations for Executive KPI Ribbon
  const totalLeads = deals.length;
  const fieldVisits = interactions.filter((i) => i.meetingMode === "Physical (On-site)").length;
  const touchpoints = interactions.length;
  const activeProposals = deals.filter((d) => d.proposalSent && d.leadStatus !== "Closed Won" && d.leadStatus !== "Closed Lost").length;
  const dealsWon = deals.filter((d) => d.leadStatus === "Closed Won").length;
  const winRate = totalLeads > 0 ? Math.round((dealsWon / totalLeads) * 100) : 0;
  const totalPipeline = deals.reduce((acc, d) => acc + (d.estimatedDealValue || 0), 0);
  const weightedPipeline = deals.reduce((acc, d) => acc + (d.weightedValue || 0), 0);
  const wonRevenue = deals
    .filter((d) => d.leadStatus === "Closed Won")
    .reduce((acc, d) => acc + (d.estimatedDealValue || 0), 0);

  // Rep Performance: Kamil vs Anusha
  const reps = ["Kamil", "Anusha"] as const;
  const repStats = reps.map((rep) => {
    const repDeals = deals.filter((d) => d.marketingPerson === rep);
    const repInts = interactions.filter((i) => i.marketingPerson === rep);
    const physicalVisits = repInts.filter((i) => i.meetingMode === "Physical (On-site)").length;
    const repWon = repDeals.filter((d) => d.leadStatus === "Closed Won");
    const repProposals = repDeals.filter((d) => d.proposalSent).length;
    const repPipeline = repDeals.reduce((sum, d) => sum + (d.estimatedDealValue || 0), 0);
    const repWonRev = repWon.reduce((sum, d) => sum + (d.estimatedDealValue || 0), 0);
    const rate = repDeals.length > 0 ? Math.round((repWon.length / repDeals.length) * 100) : 0;

    return {
      name: rep,
      leadsAssigned: repDeals.length,
      physicalVisits,
      touchpoints: repInts.length,
      proposalsSubmitted: repProposals,
      dealsWon: repWon.length,
      pipelineValue: repPipeline,
      wonRevenue: repWonRev,
      winRate: rate,
    };
  });

  // Urgent follow-ups queue
  const urgentFollowUps = deals.filter(
    (d) => d.followUpPriority === "High" && d.leadStatus !== "Closed Won" && d.leadStatus !== "Closed Lost"
  );

  const formatInr = (amt: number) => {
    if (amt >= 10000000) return `₹${(amt / 10000000).toFixed(2)} Cr`;
    if (amt >= 100000) return `₹${(amt / 100000).toFixed(1)} L`;
    return `₹${amt.toLocaleString("en-IN")}`;
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 shadow-card-subtle border border-zinc-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
              Marketing & Commercial Pipeline
            </h2>
            <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/60">
              Field Operations
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Field visits, lead velocity, weighted deal values, and sales rep performance across accounts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenInteractions}
            className="px-3.5 py-2 bg-white border border-zinc-200 hover:border-zinc-300 rounded-xl text-xs font-semibold text-zinc-800 transition-colors shadow-xs"
          >
            Visit Log ({interactions.length})
          </button>
          <button
            onClick={onOpenDeals}
            className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            All Deals ({deals.length})
          </button>
        </div>
      </div>

      {/* EXECUTIVE KPI RIBBON (Cells B4:J5 from JSON spec) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-zinc-950 text-white rounded-3xl p-4 shadow-card-elevated border border-zinc-900 flex flex-col justify-between">
          <div className="text-[11px] text-zinc-400 font-medium">TOTAL PIPELINE</div>
          <div className="text-xl sm:text-2xl font-black text-[#d4ff32] mt-1">
            {formatInr(totalPipeline)}
          </div>
          <div className="text-[10px] text-zinc-400 mt-1">
            Weighted: <strong className="text-white">{formatInr(weightedPipeline)}</strong>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 shadow-card-subtle border border-zinc-200/80 flex flex-col justify-between">
          <div className="text-[11px] text-zinc-500 font-medium">WON REVENUE</div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">
            {formatInr(wonRevenue)}
          </div>
          <div className="text-[10px] text-emerald-700 font-semibold mt-1">
            {dealsWon} Closed Deals
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 shadow-card-subtle border border-zinc-200/80 flex flex-col justify-between">
          <div className="text-[11px] text-zinc-500 font-medium">WIN CONVERSION</div>
          <div className="text-xl sm:text-2xl font-black text-zinc-900 mt-1">
            {winRate}%
          </div>
          <div className="text-[10px] text-zinc-400 mt-1">
            {dealsWon} won of {totalLeads} leads
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 shadow-card-subtle border border-zinc-200/80 flex flex-col justify-between">
          <div className="text-[11px] text-zinc-500 font-medium">FIELD VISITS</div>
          <div className="text-xl sm:text-2xl font-black text-zinc-900 mt-1">
            {fieldVisits}
          </div>
          <div className="text-[10px] text-zinc-400 mt-1">
            On-site client meetings
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 shadow-card-subtle border border-zinc-200/80 flex flex-col justify-between">
          <div className="text-[11px] text-zinc-500 font-medium">ACTIVE PROPOSALS</div>
          <div className="text-xl sm:text-2xl font-black text-zinc-900 mt-1">
            {activeProposals}
          </div>
          <div className="text-[10px] text-zinc-400 mt-1">
            In commercial review
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 shadow-card-subtle border border-zinc-200/80 flex flex-col justify-between">
          <div className="text-[11px] text-zinc-500 font-medium">TOUCHPOINTS</div>
          <div className="text-xl sm:text-2xl font-black text-zinc-900 mt-1">
            {touchpoints}
          </div>
          <div className="text-[10px] text-zinc-400 mt-1">
            Calls & demos logged
          </div>
        </div>
      </div>

      {/* 2-COLUMN SECTION: REP PERFORMANCE & URGENT FOLLOW-UPS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Rep Performance Table (Cells B19:J22 from JSON spec) (Span 7) */}
        <div className="lg:col-span-7 bg-white rounded-3xl shadow-card-subtle border border-zinc-200/80 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 tracking-tight">
                Rep Performance Table
              </h3>
              <p className="text-xs text-zinc-500">Field visits, proposal velocity, and pipeline quota</p>
            </div>
            <span className="text-[11px] font-bold text-zinc-500">Kamil & Anusha</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider border-b border-zinc-100">
                <tr>
                  <th className="pb-2.5">Marketing Person</th>
                  <th className="pb-2.5">Leads</th>
                  <th className="pb-2.5">Visits</th>
                  <th className="pb-2.5">Proposals</th>
                  <th className="pb-2.5">Deals Won</th>
                  <th className="pb-2.5">Pipeline Value</th>
                  <th className="pb-2.5 text-right">Win Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium text-zinc-800">
                {repStats.map((rep) => (
                  <tr key={rep.name} className="hover:bg-zinc-50 transition-colors">
                    <td className="py-3.5 font-bold text-zinc-900 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-zinc-950 text-white flex items-center justify-center text-[10px] font-bold">
                          {rep.name[0]}
                        </div>
                        <span>{rep.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5">{rep.leadsAssigned}</td>
                    <td className="py-3.5 font-bold text-zinc-900">{rep.physicalVisits}</td>
                    <td className="py-3.5">{rep.proposalsSubmitted}</td>
                    <td className="py-3.5">
                      <span className="text-emerald-700 font-bold">{rep.dealsWon} won</span>
                    </td>
                    <td className="py-3.5 font-mono font-bold text-zinc-900">
                      {formatInr(rep.pipelineValue)}
                    </td>
                    <td className="py-3.5 text-right font-bold text-emerald-600">
                      {rep.winRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Follow-up Management & Pending Action Queue (Cells B7:E10) (Span 5) */}
        <div className="lg:col-span-5 bg-white rounded-3xl shadow-card-subtle border border-zinc-200/80 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 tracking-tight">
                Urgent Follow-Up Queue
              </h3>
              <p className="text-xs text-zinc-500">Pending touchpoints requiring sales action</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E04F34] text-white">
              {urgentFollowUps.length} Urgent
            </span>
          </div>

          <div className="space-y-3">
            {urgentFollowUps.map((deal) => (
              <div
                key={deal.id}
                onClick={() => onSelectDeal(deal)}
                className="p-3.5 rounded-2xl border border-zinc-200 bg-zinc-50 hover:bg-white hover:border-zinc-300 transition-all cursor-pointer space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-zinc-900 bg-white px-2 py-0.5 rounded border border-zinc-200">
                      {deal.leadId}
                    </span>
                    <span className="font-bold text-xs text-zinc-900">{deal.companyName}</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    {deal.leadStatus}
                  </span>
                </div>

                <div className="text-xs text-zinc-700 font-medium">
                  {deal.followUpAction}
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-zinc-200/60">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Due: <strong>{deal.nextFollowUpDate}</strong>
                  </span>
                  <span>Owner: @{deal.marketingPerson}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
