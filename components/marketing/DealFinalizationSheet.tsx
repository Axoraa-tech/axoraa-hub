"use client";

import React, { useState, useMemo } from "react";
import { MarketingDeal } from "@/lib/types";
import {
  Search,
  Filter,
  Plus,
  Download,
  MapPin,
  Calendar,
  ExternalLink,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Phone,
  Mail,
} from "lucide-react";

interface DealFinalizationSheetProps {
  deals: MarketingDeal[];
  onAddDeal: () => void;
  onEditDeal: (deal: MarketingDeal) => void;
  onOpenInteractions: () => void;
  activeRepFilter?: string;
}

export const DealFinalizationSheet: React.FC<DealFinalizationSheetProps> = ({
  deals,
  onAddDeal,
  onEditDeal,
  onOpenInteractions,
  activeRepFilter,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRep, setSelectedRep] = useState(activeRepFilter || "All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedPriority, setSelectedPriority] = useState("All");

  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          deal.leadId.toLowerCase().includes(q) ||
          deal.companyName.toLowerCase().includes(q) ||
          deal.contactPerson.toLowerCase().includes(q) ||
          deal.industry.toLowerCase().includes(q) ||
          deal.marketingPerson.toLowerCase().includes(q) ||
          deal.city.toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (selectedRep !== "All" && deal.marketingPerson !== selectedRep) {
        return false;
      }

      if (selectedStatus !== "All" && deal.leadStatus !== selectedStatus) {
        return false;
      }

      if (selectedPriority !== "All" && deal.followUpPriority !== selectedPriority) {
        return false;
      }

      return true;
    });
  }, [deals, searchQuery, selectedRep, selectedStatus, selectedPriority]);

  const formatInr = (amt: number) => {
    if (amt >= 100000) return `₹${(amt / 100000).toFixed(1)} L`;
    return `₹${amt.toLocaleString("en-IN")}`;
  };

  const handleExportCsv = () => {
    const headers = [
      "Lead ID",
      "Date Added",
      "Marketing Person",
      "Company Name",
      "Industry",
      "Contact Person",
      "Designation",
      "Phone Number",
      "Email Address",
      "City",
      "Lead Source",
      "Initial Visit Date",
      "Last Interaction Date",
      "Visit Type",
      "Decision Maker?",
      "Client Requirements",
      "Estimated Deal Value",
      "Weighted Value",
      "Proposal Sent?",
      "Proposal Value",
      "Lead Status",
      "Next Follow-up Date",
      "Follow-up Action",
      "Follow-up Priority",
      "Follow-up Status",
      "Days Since Last Visit",
      "Due Status",
      "Notes & Next Steps",
    ];

    const escapeCsv = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    const rows = [headers.join(",")];

    for (const d of filteredDeals) {
      rows.push(
        [
          escapeCsv(d.leadId),
          escapeCsv(d.dateAdded),
          escapeCsv(d.marketingPerson),
          escapeCsv(d.companyName),
          escapeCsv(d.industry),
          escapeCsv(d.contactPerson),
          escapeCsv(d.designation),
          escapeCsv(d.phoneNumber),
          escapeCsv(d.emailAddress),
          escapeCsv(d.city),
          escapeCsv(d.leadSource),
          escapeCsv(d.initialVisitDate),
          escapeCsv(d.lastInteractionDate),
          escapeCsv(d.visitType),
          escapeCsv(d.isDecisionMaker ? "Yes" : "No"),
          escapeCsv(d.clientRequirements),
          escapeCsv(d.estimatedDealValue),
          escapeCsv(d.weightedValue),
          escapeCsv(d.proposalSent ? "Yes" : "No"),
          escapeCsv(d.proposalValue),
          escapeCsv(d.leadStatus),
          escapeCsv(d.nextFollowUpDate),
          escapeCsv(d.followUpAction),
          escapeCsv(d.followUpPriority),
          escapeCsv(d.followUpStatus),
          escapeCsv(d.daysSinceLastVisit),
          escapeCsv(d.dueStatus),
          escapeCsv(d.notesNextSteps),
        ].join(",")
      );
    }

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(rows.join("\n"));
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `axoraa_deals_crm_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalValue = filteredDeals.reduce((sum, d) => sum + (d.estimatedDealValue || 0), 0);
  const totalWeighted = filteredDeals.reduce((sum, d) => sum + (d.weightedValue || 0), 0);

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-5 shadow-card-subtle border border-zinc-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
              Deal Finalization Tracker
            </h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
              {filteredDeals.length} Deals
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Master pipeline accounts, deal sizing, stage velocity, and scheduled touchpoints
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenInteractions}
            className="px-3.5 py-2 bg-white border border-zinc-200 hover:border-zinc-300 rounded-xl text-xs font-semibold text-zinc-800 transition-colors shadow-xs"
          >
            Visit Log
          </button>
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-white border border-zinc-200 hover:border-zinc-300 rounded-xl text-xs font-semibold text-zinc-800 transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-zinc-600" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={onAddDeal}
            className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Lead Deal</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-3xl p-4 shadow-card-subtle border border-zinc-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search company, contact, Lead ID, city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedRep}
            onChange={(e) => setSelectedRep(e.target.value)}
            className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-800"
          >
            <option value="All">All Reps</option>
            <option value="Kamil">Kamil</option>
            <option value="Anusha">Anusha</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-800"
          >
            <option value="All">All Stages</option>
            <option value="New Lead">New Lead</option>
            <option value="Meeting Scheduled">Meeting Scheduled</option>
            <option value="Demo Completed">Demo Completed</option>
            <option value="Proposal Sent">Proposal Sent</option>
            <option value="Negotiation">Negotiation</option>
            <option value="Closed Won">Closed Won</option>
            <option value="Closed Lost">Closed Lost</option>
          </select>

          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-800"
          >
            <option value="All">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      {/* Main 36-Column Table */}
      <div className="bg-white rounded-3xl shadow-card-subtle border border-zinc-200/80 overflow-hidden">
        <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[1450px]">
            <thead className="sticky top-0 bg-zinc-50/95 backdrop-blur-xs border-b border-zinc-200 z-10 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
              <tr>
                <th className="py-3 px-4">Lead ID</th>
                <th className="py-3 px-4">Company & Location</th>
                <th className="py-3 px-4">Rep</th>
                <th className="py-3 px-4">Primary Contact</th>
                <th className="py-3 px-3">Lead Source</th>
                <th className="py-3 px-3">Deal Value</th>
                <th className="py-3 px-3">Weighted</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4">Next Follow-Up</th>
                <th className="py-3 px-3">Priority</th>
                <th className="py-3 px-4">Action Agenda</th>
                <th className="py-3 px-4 text-right">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-800">
              {filteredDeals.map((deal) => (
                <tr key={deal.id} className="hover:bg-zinc-50/80 transition-colors group">
                  <td className="py-3.5 px-4 font-mono font-bold text-zinc-900 whitespace-nowrap">
                    {deal.leadId}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-zinc-900">{deal.companyName}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-zinc-400" />
                      <span>{deal.city}, {deal.stateRegion}</span>
                      {deal.googleMapsLink && (
                        <a
                          href={deal.googleMapsLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-500 hover:underline inline-flex items-center ml-1"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 font-bold text-zinc-900">
                      <div className="w-5 h-5 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[10px]">
                        {deal.marketingPerson[0]}
                      </div>
                      <span>{deal.marketingPerson}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-zinc-900">{deal.contactPerson}</div>
                    <div className="text-[10px] text-zinc-500">{deal.designation}</div>
                  </td>
                  <td className="py-3.5 px-3 whitespace-nowrap text-zinc-600">
                    {deal.leadSource}
                  </td>
                  <td className="py-3.5 px-3 font-mono font-bold text-zinc-900 whitespace-nowrap">
                    {formatInr(deal.estimatedDealValue)}
                  </td>
                  <td className="py-3.5 px-3 font-mono text-zinc-600 whitespace-nowrap">
                    {formatInr(deal.weightedValue)}
                  </td>
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        deal.leadStatus === "Closed Won"
                          ? "bg-emerald-50 text-emerald-800"
                          : deal.leadStatus === "Negotiation"
                          ? "bg-purple-50 text-purple-800"
                          : deal.leadStatus === "Proposal Sent"
                          ? "bg-blue-50 text-blue-800"
                          : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      {deal.leadStatus}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-zinc-700">
                    {deal.nextFollowUpDate}
                  </td>
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        deal.followUpPriority === "High"
                          ? "bg-rose-100 text-rose-800"
                          : deal.followUpPriority === "Medium"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {deal.followUpPriority}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 max-w-xs truncate text-zinc-700">
                    {deal.followUpAction}
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <button
                      onClick={() => onEditDeal(deal)}
                      className="w-7 h-7 rounded-lg hover:bg-zinc-200 flex items-center justify-center text-zinc-600 hover:text-zinc-900 transition-colors ml-auto"
                      title="Edit Deal Record"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="px-6 py-3.5 bg-zinc-50 border-t border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-zinc-500 gap-2">
          <div>
            Showing <strong className="text-zinc-900">{filteredDeals.length}</strong> of{" "}
            <strong className="text-zinc-900">{deals.length}</strong> deals
          </div>
          <div className="flex items-center gap-4">
            <span>
              Total Pipeline: <strong className="text-zinc-900 font-mono">{formatInr(totalValue)}</strong>
            </span>
            <span>
              Weighted: <strong className="text-emerald-700 font-mono">{formatInr(totalWeighted)}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
