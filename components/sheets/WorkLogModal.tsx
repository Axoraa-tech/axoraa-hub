"use client";

import React, { useState } from "react";
import { DailyWorkLogEntry } from "@/lib/types";
import { X, Save } from "lucide-react";

interface WorkLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Partial<DailyWorkLogEntry>) => void;
  initialData?: DailyWorkLogEntry | null;
  defaultDeveloper?: string;
  lockDeveloper?: boolean;
}

const DEVELOPER_OPTIONS = [
  "Akshar",
  "Abhinav",
  "Adnaan",
  "Bhuvan",
  "Manish",
  "Vinod",
  "Chakravarthi",
  "Intern",
];

const PROJECT_OPTIONS = ["SeekFactory", "Seek factory APK"];

const REPOSITORY_OPTIONS = ["seekfactory-b", "seekfactory-web-f", "seekfactory-app-f"];

const WORK_TYPE_OPTIONS = [
  "Authentication / Authorization",
  "Refactoring",
  "Database",
  "Bug Fix / UI Enhancement",
  "DevOps / Infrastructure",
  "UI/UX Improvement",
  "API Integration",
  "New Feature",
  "Feature Enhancement",
];

const WORK_STATUS_OPTIONS = ["In Progress", "Completed", "Blocked"];
const PRIORITY_OPTIONS = ["Critical", "High", "Medium", "Low"];
const DEPLOYMENT_OPTIONS = ["Development", "Staging", "Production", "Not Applicable"];
const IMPACT_OPTIONS = ["High", "Medium", "Low", "None"];
const REVIEWER_OPTIONS = [
  "Akshar",
  "Abhinav",
  "Adnaan",
  "Bhuvan",
  "Manish",
  "Vinod",
  "Chakravarthi",
  "all",
  "-",
];

export const WorkLogModal: React.FC<WorkLogModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  defaultDeveloper,
  lockDeveloper,
}) => {
  const [formData, setFormData] = useState<Partial<DailyWorkLogEntry>>(() => initialData ?? {
    date: new Date().toISOString().substring(0, 10),
    developerName: defaultDeveloper || "Akshar",
    project: "SeekFactory",
    repository: "seekfactory-b",
    module: "",
    workType: "New Feature",
    taskDescription: "",
    githubPr: "",
    workStatus: "In Progress",
    priority: "Medium",
    hours: 7.0,
    isBlocked: "No",
    blockerDetails: "",
    reviewRequired: "No",
    reviewer: "-",
    deployment: "Development",
    productionImpact: "None",
    notes: "",
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.module?.trim() || !formData.taskDescription?.trim()) {
      alert("Please provide both Module name and Task description.");
      return;
    }
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/35 backdrop-blur-[3px] p-0 sm:p-6">
      <div className="bg-surface rounded-t-[28px] sm:rounded-[28px] max-w-3xl w-full shadow-[var(--shadow-float)] overflow-hidden flex flex-col max-h-[92vh] animate-rise">
        {/* Header */}
        <div className="px-6 sm:px-7 pt-6 pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-[22px] font-medium tracking-[-0.03em]">
              {initialData ? "Edit Operational Task" : "Log Daily Work Entry"}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              AXORAA DEV TEAM · SeekFactory Engineering Operations Tracker
            </p>
          </div>
          <button
            onClick={onClose}
            className="icon-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="px-6 sm:px-7 pb-6 overflow-y-auto space-y-5">
          {/* Row 1: Date & Developer & Project */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="eyebrow block mb-1.5">
                Date *
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="field"
              />
            </div>

            <div>
              <label className="eyebrow block mb-1.5">
                Developer Name *
              </label>
              <select
                required
                value={formData.developerName}
                onChange={(e) => setFormData({ ...formData, developerName: e.target.value })}
                disabled={lockDeveloper}
                className="field"
              >
                {DEVELOPER_OPTIONS.map((dev) => (
                  <option key={dev} value={dev}>
                    {dev}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="eyebrow block mb-1.5">
                Project *
              </label>
              <select
                required
                value={formData.project}
                onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                className="field"
              >
                {PROJECT_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Repository & Module & Work Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="eyebrow block mb-1.5">
                Repository *
              </label>
              <select
                required
                value={formData.repository}
                onChange={(e) => setFormData({ ...formData, repository: e.target.value })}
                className="field font-mono"
              >
                {REPOSITORY_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="eyebrow block mb-1.5">
                Module / Feature Area *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Auth Microservice"
                value={formData.module}
                onChange={(e) => setFormData({ ...formData, module: e.target.value })}
                className="field"
              />
            </div>

            <div>
              <label className="eyebrow block mb-1.5">
                Work Type *
              </label>
              <select
                required
                value={formData.workType}
                onChange={(e) => setFormData({ ...formData, workType: e.target.value })}
                className="field"
              >
                {WORK_TYPE_OPTIONS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Task Description (Full narrative) */}
          <div>
            <label className="eyebrow block mb-1.5">
              Task / Work Description *
            </label>
            <textarea
              required
              rows={2}
              placeholder="Detailed explanation of technical implementation or work completed..."
              value={formData.taskDescription}
              onChange={(e) => setFormData({ ...formData, taskDescription: e.target.value })}
              className="field"
            />
          </div>

          {/* Row 4: Status, Priority, Hours, PR Number */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="eyebrow block mb-1.5">
                Work Status *
              </label>
              <select
                value={formData.workStatus}
                onChange={(e) => setFormData({ ...formData, workStatus: e.target.value as DailyWorkLogEntry["workStatus"] })}
                className="field"
              >
                {WORK_STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="eyebrow block mb-1.5">
                Priority *
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as DailyWorkLogEntry["priority"] })}
                className="field"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="eyebrow block mb-1.5">
                Hours / Effort *
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="24"
                required
                value={formData.hours}
                onChange={(e) => setFormData({ ...formData, hours: parseFloat(e.target.value) || 0 })}
                className="field"
              />
            </div>

            <div>
              <label className="eyebrow block mb-1.5">
                GitHub PR #
              </label>
              <input
                type="text"
                placeholder="#138 or branch"
                value={formData.githubPr}
                onChange={(e) => setFormData({ ...formData, githubPr: e.target.value })}
                className="field font-mono"
              />
            </div>
          </div>

          {/* Row 5: Blocker Section (Highlighted in light red if Blocked) */}
          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-800">
                Are you Blocked on this task?
              </label>
              <div className="flex gap-2">
                {(["No", "Yes"] as const).map((opt) => (
                  <button
                    type="button"
                    key={opt}
                    onClick={() =>
                      setFormData({
                        ...formData,
                        isBlocked: opt,
                        workStatus: opt === "Yes" ? "Blocked" : formData.workStatus === "Blocked" ? "In Progress" : formData.workStatus,
                      })
                    }
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      formData.isBlocked === opt
                        ? opt === "Yes"
                          ? "bg-coral text-white"
                          : "bg-zinc-900 text-white"
                        : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {formData.isBlocked === "Yes" && (
              <div className="animate-in fade-in duration-100">
                <label className="block text-[11px] font-medium text-rose-700 mb-1">
                  Blocker / Dependency Details (Mandatory when Blocked) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Root cause & requirements to unblock (e.g. Awaiting AWS IAM S3 policy)..."
                  value={formData.blockerDetails}
                  onChange={(e) => setFormData({ ...formData, blockerDetails: e.target.value })}
                  className="field bg-coral-soft! text-[#8f2a17]"
                />
              </div>
            )}
          </div>

          {/* Row 6: Review, Deployment, Production Impact */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="eyebrow block mb-1.5">
                Review Required?
              </label>
              <select
                value={formData.reviewRequired}
                onChange={(e) => setFormData({ ...formData, reviewRequired: e.target.value as DailyWorkLogEntry["reviewRequired"] })}
                className="field"
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            <div>
              <label className="eyebrow block mb-1.5">
                Reviewer
              </label>
              <select
                value={formData.reviewer}
                onChange={(e) => setFormData({ ...formData, reviewer: e.target.value })}
                className="field"
              >
                {REVIEWER_OPTIONS.map((rev) => (
                  <option key={rev} value={rev}>
                    {rev}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="eyebrow block mb-1.5">
                Deployment / Release
              </label>
              <select
                value={formData.deployment}
                onChange={(e) => setFormData({ ...formData, deployment: e.target.value as DailyWorkLogEntry["deployment"] })}
                className="field"
              >
                {DEPLOYMENT_OPTIONS.map((dep) => (
                  <option key={dep} value={dep}>
                    {dep}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="eyebrow block mb-1.5">
                Production Impact
              </label>
              <select
                value={formData.productionImpact}
                onChange={(e) => setFormData({ ...formData, productionImpact: e.target.value as DailyWorkLogEntry["productionImpact"] })}
                className="field"
              >
                {IMPACT_OPTIONS.map((imp) => (
                  <option key={imp} value={imp}>
                    {imp}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 7: Notes */}
          <div>
            <label className="eyebrow block mb-1.5">
              Notes (Optional Context / Ticket References)
            </label>
            <input
              type="text"
              placeholder="Additional technical context, Jira ticket, or deployment notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="field"
            />
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-zinc-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-ink"
            >
              <Save className="w-4 h-4" />
              <span>{initialData ? "Update Task" : "Save Daily Log"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
