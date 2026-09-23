"use client";

import React, { useState } from "react";
import { MarketingInteraction } from "@/lib/types";
import {
  Calendar,
  MapPin,
  ExternalLink,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Phone,
  Video,
  Building,
} from "lucide-react";

interface InteractionsSheetProps {
  interactions: MarketingInteraction[];
  onAddInteraction: () => void;
}

export const InteractionsSheet: React.FC<InteractionsSheetProps> = ({
  interactions,
  onAddInteraction,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRep, setSelectedRep] = useState("All");

  const kamilVisits = interactions.filter(
    (i) => i.marketingPerson === "Kamil" && i.meetingMode === "Physical (On-site)"
  ).length;
  const anushaVisits = interactions.filter(
    (i) => i.marketingPerson === "Anusha" && i.meetingMode === "Physical (On-site)"
  ).length;
  const advancingCount = interactions.filter(
    (i) => i.interactionOutcome === "Positive - Advancing"
  ).length;

  const filtered = interactions.filter((item) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const m =
        item.companyName.toLowerCase().includes(q) ||
        item.leadId.toLowerCase().includes(q) ||
        item.marketingPerson.toLowerCase().includes(q) ||
        item.agenda.toLowerCase().includes(q);
      if (!m) return false;
    }
    if (selectedRep !== "All" && item.marketingPerson !== selectedRep) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-6 shadow-card-subtle border border-zinc-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
              Daily Activity & Field Visit Log
            </h2>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              Interactions & Touchpoints
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Audit ledger of every on-site visit, client negotiation, and demo call mapped to Lead IDs.
          </p>
        </div>

        <button
          onClick={onAddInteraction}
          className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Log Client Visit</span>
        </button>
      </div>

      {/* SUMMARY HEADER KPIS (from JSON spec) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-zinc-950 text-white rounded-2xl p-4 shadow-card-subtle border border-zinc-900">
          <div className="text-[11px] text-zinc-400 font-medium">TOTAL VISITS LOGGED</div>
          <div className="text-2xl font-black mt-1 text-[#d4ff32]">{interactions.length}</div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-card-subtle border border-zinc-200/80">
          <div className="text-[11px] text-zinc-500 font-medium">KAMIL&apos;S VISITS</div>
          <div className="text-2xl font-black text-zinc-900 mt-1">{kamilVisits}</div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-card-subtle border border-zinc-200/80">
          <div className="text-[11px] text-zinc-500 font-medium">ANUSHA&apos;S VISITS</div>
          <div className="text-2xl font-black text-zinc-900 mt-1">{anushaVisits}</div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-card-subtle border border-zinc-200/80">
          <div className="text-[11px] text-zinc-500 font-medium">WON / ADVANCING</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{advancingCount}</div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-card-subtle border border-zinc-200/80">
          <div className="text-[11px] text-zinc-500 font-medium">ACTIVE LOG PERIOD</div>
          <div className="text-sm font-bold text-zinc-900 mt-2 font-mono">Sept 2026</div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white rounded-3xl p-4 shadow-card-subtle border border-zinc-200/80 flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search visit notes, company, lead ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none"
          />
        </div>

        <select
          value={selectedRep}
          onChange={(e) => setSelectedRep(e.target.value)}
          className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-800"
        >
          <option value="All">All Marketing Persons</option>
          <option value="Kamil">Kamil</option>
          <option value="Anusha">Anusha</option>
        </select>
      </div>

      {/* Interactions Cards / Table */}
      <div className="space-y-3">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-3xl p-5 shadow-card-subtle border border-zinc-200/80 space-y-3 hover:border-zinc-300 transition-all"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-bold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded">
                  {item.leadId}
                </span>
                <span className="font-bold text-sm text-zinc-900">{item.companyName}</span>
                <span className="text-xs text-zinc-500">· {item.interactionType}</span>
                {item.googleMapsLink && (
                  <a
                    href={item.googleMapsLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-500 hover:text-blue-700 flex items-center gap-1 text-[11px]"
                  >
                    <MapPin className="w-3 h-3" />
                    <span>Location</span>
                  </a>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono text-zinc-500">{item.date}</span>
                <span className="px-2.5 py-0.5 rounded-full bg-zinc-900 text-white font-bold text-[10px]">
                  @{item.marketingPerson}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                    item.meetingMode === "Physical (On-site)"
                      ? "bg-purple-100 text-purple-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {item.meetingMode}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase">Person Met</span>
                <div className="font-semibold text-zinc-900 mt-0.5">{item.personsMet}</div>
                <div className="text-[11px] text-zinc-500">{item.designation} · {item.phoneNumber}</div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase">Agenda & Purpose</span>
                <div className="text-zinc-800 mt-0.5">{item.agenda}</div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase">Discussion & Feedback</span>
                <div className="text-zinc-700 mt-0.5 italic">{item.discussionFeedback}</div>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-600">Outcome:</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  {item.interactionOutcome} ({item.probabilityPct}%)
                </span>
                <span className="text-zinc-400">· Next: {item.nextSteps}</span>
              </div>

              <div className="text-[11px] text-zinc-400 font-mono">
                Audit: {item.loggedBy}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
