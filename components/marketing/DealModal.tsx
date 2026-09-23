"use client";

import React, { useState, useEffect } from "react";
import { MarketingDeal } from "@/lib/types";
import { X, Save } from "lucide-react";

interface DealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (deal: Partial<MarketingDeal>) => void;
  initialData?: MarketingDeal | null;
  defaultRep?: string;
}

const MARKETING_PERSONS = ["Kamil", "Anusha"];
const LEAD_STAGES = [
  "New Lead",
  "Contacted",
  "Meeting Scheduled",
  "Demo Completed",
  "Proposal Sent",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
  "On Hold",
];
const VISIT_TYPES = [
  "Intro Meeting",
  "Product Demo",
  "Follow-up",
  "Commercial Negotiation",
  "Technical Scoping",
  "Check-in",
];
const LEAD_SOURCES = [
  "Website / Inbound",
  "Field Visit / Direct Walk-in",
  "Referral",
  "LinkedIn / Outreach",
  "Exhibition / Event",
  "Cold Call",
];
const PRIORITIES = ["High", "Medium", "Low"];

export const DealModal: React.FC<DealModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  defaultRep,
}) => {
  const [formData, setFormData] = useState<Partial<MarketingDeal>>({
    leadId: "LD-" + Math.floor(1000 + Math.random() * 9000),
    dateAdded: new Date().toISOString().substring(0, 10),
    marketingPerson: defaultRep || "Kamil",
    companyName: "",
    industry: "Logistics",
    contactPerson: "",
    designation: "Managing Director",
    phoneNumber: "+91 ",
    emailAddress: "",
    officeAddress: "",
    city: "Bangalore",
    stateRegion: "Karnataka",
    googleMapsLink: "",
    leadSource: "Field Visit / Direct Walk-in",
    initialVisitDate: new Date().toISOString().substring(0, 10),
    lastInteractionDate: new Date().toISOString().substring(0, 10),
    visitType: "Intro Meeting",
    isDecisionMaker: true,
    decisionMakerDetails: "Primary contact",
    clientRequirements: "",
    solutionsPitched: "SeekFactory Operations Engine",
    budgetSpecified: 1500000,
    estimatedDealValue: 1500000,
    weightedValue: 1200000,
    demoRequired: "Scheduled",
    proposalSent: false,
    proposalValue: 0,
    leadStatus: "New Lead",
    nextFollowUpDate: new Date().toISOString().substring(0, 10),
    followUpAction: "Schedule initial discovery discussion",
    followUpPriority: "High",
    followUpStatus: "Pending",
    daysSinceLastVisit: 0,
    dueStatus: "Upcoming",
    notesNextSteps: "",
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        leadId: "LD-" + Math.floor(1000 + Math.random() * 9000),
        dateAdded: new Date().toISOString().substring(0, 10),
        marketingPerson: defaultRep || "Kamil",
        companyName: "",
        industry: "Logistics",
        contactPerson: "",
        designation: "Managing Director",
        phoneNumber: "+91 ",
        emailAddress: "",
        officeAddress: "",
        city: "Bangalore",
        stateRegion: "Karnataka",
        googleMapsLink: "",
        leadSource: "Field Visit / Direct Walk-in",
        initialVisitDate: new Date().toISOString().substring(0, 10),
        lastInteractionDate: new Date().toISOString().substring(0, 10),
        visitType: "Intro Meeting",
        isDecisionMaker: true,
        decisionMakerDetails: "Primary contact",
        clientRequirements: "",
        solutionsPitched: "SeekFactory Operations Engine",
        budgetSpecified: 1500000,
        estimatedDealValue: 1500000,
        weightedValue: 1200000,
        demoRequired: "Scheduled",
        proposalSent: false,
        proposalValue: 0,
        leadStatus: "New Lead",
        nextFollowUpDate: new Date().toISOString().substring(0, 10),
        followUpAction: "Schedule initial discovery discussion",
        followUpPriority: "High",
        followUpStatus: "Pending",
        daysSinceLastVisit: 0,
        dueStatus: "Upcoming",
        notesNextSteps: "",
      });
    }
  }, [initialData, defaultRep, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName?.trim() || !formData.contactPerson?.trim()) {
      alert("Please provide both Company Name and Contact Person.");
      return;
    }
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
              {initialData ? "Edit Deal Record" : "Add New Lead Deal"}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              AXORAA MARKETING TEAM · Master Deal Finalization Tracker
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {/* Row 1: Lead ID & Marketing Person & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                Lead ID *
              </label>
              <input
                type="text"
                required
                value={formData.leadId}
                onChange={(e) => setFormData({ ...formData, leadId: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-mono font-bold text-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                Marketing Person *
              </label>
              <select
                required
                value={formData.marketingPerson}
                onChange={(e) => setFormData({ ...formData, marketingPerson: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900"
              >
                {MARKETING_PERSONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                Date Added *
              </label>
              <input
                type="date"
                required
                value={formData.dateAdded}
                onChange={(e) => setFormData({ ...formData, dateAdded: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900"
              />
            </div>
          </div>

          {/* Row 2: Company Name, Industry, City */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                Company Name *
              </label>
              <input
                type="text"
                required
                placeholder="Target company name"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                Industry / Vertical
              </label>
              <input
                type="text"
                placeholder="e.g. Logistics, AI, HealthTech"
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                City / Location
              </label>
              <input
                type="text"
                placeholder="Bangalore, Gurugram, etc."
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900"
              />
            </div>
          </div>

          {/* Row 3: Contact Person, Designation, Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                Contact Person *
              </label>
              <input
                type="text"
                required
                placeholder="Primary stakeholder"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                Designation
              </label>
              <input
                type="text"
                placeholder="VP Operations, CTO, etc."
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                Phone Number
              </label>
              <input
                type="text"
                placeholder="+91 ..."
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900"
              />
            </div>
          </div>

          {/* Row 4: Financial Deal Sizing (Estimated Value, Stage, Lead Source) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                Estimated Deal Value (INR ₹) *
              </label>
              <input
                type="number"
                required
                value={formData.estimatedDealValue}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setFormData({
                    ...formData,
                    estimatedDealValue: val,
                    weightedValue: Math.round(val * 0.8),
                  });
                }}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-mono font-bold text-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                Lead Status / Stage *
              </label>
              <select
                value={formData.leadStatus}
                onChange={(e) => setFormData({ ...formData, leadStatus: e.target.value as any })}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900"
              >
                {LEAD_STAGES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                Lead Source
              </label>
              <select
                value={formData.leadSource}
                onChange={(e) => setFormData({ ...formData, leadSource: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900"
              >
                {LEAD_SOURCES.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 5: Follow-Up Action, Next Date, Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                Next Follow-Up Date
              </label>
              <input
                type="date"
                value={formData.nextFollowUpDate}
                onChange={(e) => setFormData({ ...formData, nextFollowUpDate: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                Follow-Up Priority
              </label>
              <select
                value={formData.followUpPriority}
                onChange={(e) => setFormData({ ...formData, followUpPriority: e.target.value as any })}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                Action Agenda
              </label>
              <input
                type="text"
                placeholder="e.g. Schedule commercial contract signoff"
                value={formData.followUpAction}
                onChange={(e) => setFormData({ ...formData, followUpAction: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900"
              />
            </div>
          </div>

          {/* Qualitative Scoping Notes */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
              Client Requirements / Pain Points
            </label>
            <textarea
              rows={2}
              placeholder="Qualitative requirements and solutions discussed..."
              value={formData.clientRequirements}
              onChange={(e) => setFormData({ ...formData, clientRequirements: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-900"
            />
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-zinc-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>Save Lead Record</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
