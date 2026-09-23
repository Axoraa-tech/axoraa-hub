"use client";

import React, { useState } from "react";
import { DeveloperRosterMember, RepositoryMapping } from "@/lib/types";
import { ShieldCheck, Users, GitBranch, Plus, Check, Edit2 } from "lucide-react";

interface ConfigSheetProps {
  roster: DeveloperRosterMember[];
  repositories: RepositoryMapping[];
  onUpdateRoster: (roster: DeveloperRosterMember[]) => void;
  isAdmin: boolean;
}

export const ConfigSheet: React.FC<ConfigSheetProps> = ({
  roster,
  repositories,
  onUpdateRoster,
  isAdmin,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"roster" | "repos">("roster");

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 shadow-card-subtle border border-zinc-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Master System Config</h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              Restricted (Tech Lead / Admin)
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Master lookup tables defining active developer roster, engineering roles, and target GitHub repositories.
          </p>
        </div>

        {/* Sub tab toggles */}
        <div className="flex bg-zinc-100 p-1 rounded-2xl text-xs font-bold">
          <button
            onClick={() => setActiveSubTab("roster")}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
              activeSubTab === "roster"
                ? "bg-zinc-950 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Developer Roster ({roster.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab("repos")}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
              activeSubTab === "repos"
                ? "bg-zinc-950 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Repository Mappings ({repositories.length})</span>
          </button>
        </div>
      </div>

      {/* Roster Table */}
      {activeSubTab === "roster" ? (
        <div className="bg-white rounded-3xl shadow-card-subtle border border-zinc-200/80 overflow-hidden">
          <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">Developer Team Roster</h3>
              <p className="text-xs text-zinc-500">Active engineers assigned to SeekFactory sprints</p>
            </div>
            {isAdmin && (
              <button className="px-3.5 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs">
                <Plus className="w-3.5 h-3.5" />
                <span>Add Engineer</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                <tr>
                  <th className="py-3 px-6">Developer Name</th>
                  <th className="py-3 px-4">Role Title</th>
                  <th className="py-3 px-4">Primary Area</th>
                  <th className="py-3 px-4">Active Status</th>
                  <th className="py-3 px-4">Joining Date</th>
                  <th className="py-3 px-6">Operational Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {roster.map((dev) => (
                  <tr key={dev.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-4 px-6 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <img
                          src={dev.avatar}
                          alt={dev.developerName}
                          className="w-9 h-9 rounded-full object-cover border border-zinc-200 shadow-xs"
                        />
                        <div>
                          <div className="font-bold text-zinc-900 text-sm">{dev.developerName}</div>
                          {dev.developerName === "Akshar" && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              TECH LEAD
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 font-semibold text-zinc-800">{dev.role}</td>
                    <td className="py-4 px-4 text-zinc-600">{dev.primaryArea}</td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Active
                      </span>
                    </td>
                    <td className="py-4 px-4 font-mono text-zinc-500">{dev.joiningDate}</td>
                    <td className="py-4 px-6 text-zinc-500 text-xs italic">{dev.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Repository Mappings Table */
        <div className="bg-white rounded-3xl shadow-card-subtle border border-zinc-200/80 overflow-hidden">
          <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">Projects & Repositories Mappings</h3>
              <p className="text-xs text-zinc-500">Target repositories mapped to SeekFactory operations</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                <tr>
                  <th className="py-3 px-6">Project Name</th>
                  <th className="py-3 px-4">Repository</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-6">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {repositories.map((repo) => (
                  <tr key={repo.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-4 px-6 font-bold text-zinc-900">{repo.projectName}</td>
                    <td className="py-4 px-4 font-mono font-bold text-blue-600 bg-blue-50/50 rounded inline-block my-2">
                      {repo.repository}
                    </td>
                    <td className="py-4 px-4 text-zinc-700 font-medium">{repo.type}</td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {repo.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-zinc-500">{repo.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
