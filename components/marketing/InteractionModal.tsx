"use client";

import React, { useState } from "react";
import { MarketingInteraction } from "@/lib/types";
import { X, Save } from "lucide-react";

interface InteractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Partial<MarketingInteraction>) => void;
  defaultRep?: string;
}

export const InteractionModal: React.FC<InteractionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  defaultRep,
}) => {
  const [formData, setFormData] = useState<Partial<MarketingInteraction>>({
    date: new Date().toISOString().substring(0, 10),
    marketingPerson: defaultRep || "Kamil",
    companyName: "",
    leadId: "LD-1002",
    googleMapsLink: "",
    leadSource: "Field Visit / Direct Walk-in",
    interactionType: "Intro Meeting",
    meetingMode: "Physical (On-site)",
    personsMet: "",
    designation: "VP Operations",
    phoneNumber: "+91 ",
    email: "",
    agenda: "",
    discussionFeedback: "",
    demoRequired: "No",
    interestLevel: "Warm",
    probabilityPct: 75,
    interactionOutcome: "Positive - Advancing",
    actionItemsAgreed: "",
    nextSteps: "",
    nextFollowUpDate: new Date().toISOString().substring(0, 10),
    followUpPriority: "High",
    loggedBy: (defaultRep || "Kamil") + " (" + new Date().toISOString().substring(0, 10) + ")",
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName?.trim() || !formData.personsMet?.trim()) {
      alert("Please provide both Company Name and Person Met.");
      return;
    }
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Log Field Visit / Touchpoint</h2>
            <p className="text-xs text-zinc-500 mt-0.5">AXORAA MARKETING · Interactions Ledger</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Date *</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Rep *</label>
              <select
                value={formData.marketingPerson}
                onChange={(e) => setFormData({ ...formData, marketingPerson: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs"
              >
                <option value="Kamil">Kamil</option>
                <option value="Anusha">Anusha</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Mode *</label>
              <select
                value={formData.meetingMode}
                onChange={(e) => setFormData({ ...formData, meetingMode: e.target.value as any })}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold"
              >
                <option value="Physical (On-site)">Physical (On-site)</option>
                <option value="Virtual (Video)">Virtual (Video)</option>
                <option value="Phone Call">Phone Call</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Company *</label>
              <input
                type="text"
                required
                placeholder="Company name"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Person Met *</label>
              <input
                type="text"
                required
                placeholder="Name of stakeholder"
                value={formData.personsMet}
                onChange={(e) => setFormData({ ...formData, personsMet: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Agenda & Purpose *</label>
            <input
              type="text"
              required
              placeholder="e.g. On-site telematics demo and invoice review"
              value={formData.agenda}
              onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Discussion & Feedback</label>
            <textarea
              rows={2}
              placeholder="Client reaction, objections, feedback..."
              value={formData.discussionFeedback}
              onChange={(e) => setFormData({ ...formData, discussionFeedback: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Outcome</label>
              <select
                value={formData.interactionOutcome}
                onChange={(e) => setFormData({ ...formData, interactionOutcome: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs"
              >
                <option value="Positive - Advancing">Positive - Advancing</option>
                <option value="Needs Demo">Needs Demo</option>
                <option value="Proposal Requested">Proposal Requested</option>
                <option value="Follow-up Required">Follow-up Required</option>
                <option value="Cold / Unresponsive">Cold / Unresponsive</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Probability (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.probabilityPct}
                onChange={(e) => setFormData({ ...formData, probabilityPct: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Next Follow-Up</label>
              <input
                type="date"
                value={formData.nextFollowUpDate}
                onChange={(e) => setFormData({ ...formData, nextFollowUpDate: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Visit Log</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
