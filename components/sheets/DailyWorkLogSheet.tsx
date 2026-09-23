"use client";

import React, { useState, useMemo } from "react";
import { DailyWorkLogEntry, WorkStatus } from "@/lib/types";
import { StatusBadge, PriorityBadge, BlockedBadge, ImpactBadge } from "@/components/common/StatusBadge";
import {
  Search,
  Filter,
  Plus,
  Download,
  Database,
  Edit2,
  Trash2,
  GitPullRequest,
  CheckCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
} from "lucide-react";
import { GoogleSheetsService } from "@/lib/googleSheetsService";

interface DailyWorkLogSheetProps {
  logs: DailyWorkLogEntry[];
  onAddLog: () => void;
  onEditLog: (log: DailyWorkLogEntry) => void;
  onDeleteLog: (id: string) => void;
  onOpenSyncModal: () => void;
  onUpdateStatus: (id: string, status: WorkStatus) => void;
  activeDeveloperFilter?: string;
}

export const DailyWorkLogSheet: React.FC<DailyWorkLogSheetProps> = ({
  logs,
  onAddLog,
  onEditLog,
  onDeleteLog,
  onOpenSyncModal,
  onUpdateStatus,
  activeDeveloperFilter,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDeveloper, setSelectedDeveloper] = useState(activeDeveloperFilter || "All");
  const [selectedRepo, setSelectedRepo] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [showBlockedOnly, setShowBlockedOnly] = useState(false);

  // Filtered entries
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          log.module.toLowerCase().includes(q) ||
          log.taskDescription.toLowerCase().includes(q) ||
          log.developerName.toLowerCase().includes(q) ||
          log.repository.toLowerCase().includes(q) ||
          (log.githubPr && log.githubPr.toLowerCase().includes(q)) ||
          (log.notes && log.notes.toLowerCase().includes(q));
        if (!matches) return false;
      }

      // Developer filter
      if (selectedDeveloper !== "All" && log.developerName !== selectedDeveloper) {
        return false;
      }

      // Repo filter
      if (selectedRepo !== "All" && log.repository !== selectedRepo) {
        return false;
      }

      // Status filter
      if (selectedStatus !== "All" && log.workStatus !== selectedStatus) {
        return false;
      }

      // Blocked toggle
      if (showBlockedOnly && log.isBlocked !== "Yes") {
        return false;
      }

      return true;
    });
  }, [logs, searchQuery, selectedDeveloper, selectedRepo, selectedStatus, showBlockedOnly]);

  const handleExportCsv = () => {
    GoogleSheetsService.exportToCsv(filteredLogs);
  };

  const totalEffort = filteredLogs.reduce((acc, curr) => acc + (Number(curr.hours) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Top Banner & Action Controls */}
      <div className="bg-white rounded-3xl p-5 shadow-card-subtle border border-zinc-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Daily Work Log</h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
              {filteredLogs.length} Entries
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Engineering operations ledger tracking module progress, GitHub pull requests, effort hours, and deployments
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenSyncModal}
            className="px-3.5 py-2 bg-white border border-zinc-200 hover:border-zinc-300 rounded-xl text-xs font-semibold text-zinc-800 transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Database className="w-3.5 h-3.5 text-zinc-600" />
            <span>Google Sheets Sync</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-white border border-zinc-200 hover:border-zinc-300 rounded-xl text-xs font-semibold text-zinc-800 transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-zinc-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onAddLog}
            className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Log Daily Work</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-3xl p-4 shadow-card-subtle border border-zinc-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search module, task, PR #, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Developer filter */}
          <select
            value={selectedDeveloper}
            onChange={(e) => setSelectedDeveloper(e.target.value)}
            className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          >
            <option value="All">All Developers</option>
            <option value="Akshar">Akshar (Lead)</option>
            <option value="Abhinav">Abhinav</option>
            <option value="Adnaan">Adnaan</option>
            <option value="Bhuvan">Bhuvan</option>
            <option value="Manish">Manish</option>
            <option value="Vinod">Vinod</option>
            <option value="Chakravarthi">Chakravarthi</option>
          </select>

          {/* Repo filter */}
          <select
            value={selectedRepo}
            onChange={(e) => setSelectedRepo(e.target.value)}
            className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          >
            <option value="All">All Repositories</option>
            <option value="seekfactory-b">seekfactory-b</option>
            <option value="seekfactory-web-f">seekfactory-web-f</option>
            <option value="seekfactory-app-f">seekfactory-app-f</option>
          </select>

          {/* Status filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          >
            <option value="All">All Statuses</option>
            <option value="Completed">Completed</option>
            <option value="In Progress">In Progress</option>
            <option value="Blocked">Blocked</option>
          </select>

          {/* Blocked only toggle button */}
          <button
            onClick={() => setShowBlockedOnly(!showBlockedOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              showBlockedOnly
                ? "bg-[#E04F34] text-white shadow-xs"
                : "bg-zinc-50 text-zinc-600 border border-zinc-200 hover:bg-zinc-100"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Blocked Only</span>
          </button>
        </div>
      </div>

      {/* Main 19-Column Data Table */}
      <div className="bg-white rounded-3xl shadow-card-subtle border border-zinc-200/80 overflow-hidden">
        <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[1300px]">
            <thead className="sticky top-0 bg-zinc-50/95 backdrop-blur-xs border-b border-zinc-200 z-10 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Developer</th>
                <th className="py-3 px-4">Repository & Module</th>
                <th className="py-3 px-4 min-w-[280px]">Task Description</th>
                <th className="py-3 px-3">PR #</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Priority</th>
                <th className="py-3 px-3">Effort</th>
                <th className="py-3 px-3">Blocked?</th>
                <th className="py-3 px-3">Review</th>
                <th className="py-3 px-3">Deployment</th>
                <th className="py-3 px-3">Impact</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-800">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-50/80 transition-colors group">
                  {/* Date */}
                  <td className="py-3.5 px-4 font-mono text-[11px] whitespace-nowrap text-zinc-600">
                    {log.date}
                  </td>

                  {/* Developer */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[10px] font-bold">
                        {log.developerName[0]}
                      </div>
                      <span className="font-bold text-zinc-900">{log.developerName}</span>
                    </div>
                  </td>

                  {/* Repo & Module */}
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-zinc-900">{log.module}</div>
                    <div className="text-[10px] font-mono text-zinc-500 mt-0.5">{log.repository}</div>
                  </td>

                  {/* Task Description */}
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-zinc-900 leading-snug">{log.taskDescription}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">
                        {log.workType}
                      </span>
                      {log.notes && (
                        <span className="text-[10px] text-zinc-400 truncate max-w-xs italic">
                          Note: {log.notes}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* PR */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    {log.githubPr && log.githubPr !== "-" ? (
                      <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        <GitPullRequest className="w-3 h-3" />
                        {log.githubPr}
                      </span>
                    ) : (
                      <span className="text-zinc-400 font-mono">-</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <StatusBadge status={log.workStatus} />
                  </td>

                  {/* Priority */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <PriorityBadge priority={log.priority} />
                  </td>

                  {/* Hours */}
                  <td className="py-3.5 px-3 whitespace-nowrap font-mono font-bold text-zinc-900">
                    {log.hours}h
                  </td>

                  {/* Blocked? */}
                  <td className="py-3.5 px-3">
                    {log.isBlocked === "Yes" ? (
                      <div className="text-rose-600 font-bold flex items-center gap-1" title={log.blockerDetails}>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[120px]">{log.blockerDetails || "Yes"}</span>
                      </div>
                    ) : (
                      <span className="text-zinc-400">No</span>
                    )}
                  </td>

                  {/* Review */}
                  <td className="py-3.5 px-3 whitespace-nowrap text-[11px]">
                    {log.reviewRequired === "Yes" ? (
                      <div>
                        <span className="font-semibold text-amber-700">Req</span>
                        {log.reviewer && log.reviewer !== "-" && (
                          <div className="text-[10px] text-zinc-500">@{log.reviewer}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                  </td>

                  {/* Deployment */}
                  <td className="py-3.5 px-3 whitespace-nowrap text-[11px] font-medium text-zinc-600">
                    {log.deployment}
                  </td>

                  {/* Impact */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <ImpactBadge impact={log.productionImpact} />
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEditLog(log)}
                        className="w-7 h-7 rounded-lg hover:bg-zinc-200 flex items-center justify-center text-zinc-600 hover:text-zinc-900 transition-colors"
                        title="Edit Log Entry"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onDeleteLog(log.id)}
                        className="w-7 h-7 rounded-lg hover:bg-rose-100 flex items-center justify-center text-zinc-400 hover:text-rose-600 transition-colors"
                        title="Delete Entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary */}
        <div className="px-6 py-3.5 bg-zinc-50 border-t border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-zinc-500 gap-2">
          <div>
            Showing <strong className="text-zinc-900">{filteredLogs.length}</strong> of{" "}
            <strong className="text-zinc-900">{logs.length}</strong> total operational entries
          </div>
          <div className="flex items-center gap-4">
            <span>
              Total Effort: <strong className="text-zinc-900 font-mono">{totalEffort.toFixed(1)} hours</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
