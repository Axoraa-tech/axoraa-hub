"use client";

import React, { useState } from "react";
import {
  ClientMasterRecord,
  ProjectProgressRecord,
  PaymentBillingRecord,
  FounderMatrixStats,
  CompanyTopLineMetrics,
} from "@/lib/types";
import {
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  Users,
  Briefcase,
  ArrowUpRight,
  ShieldCheck,
  ChevronRight,
  Building2,
  Calendar,
} from "lucide-react";

interface FoundersDashboardViewProps {
  metrics: CompanyTopLineMetrics;
  founders: FounderMatrixStats[];
  clients: ClientMasterRecord[];
  projects: ProjectProgressRecord[];
  payments: PaymentBillingRecord[];
  onSelectProject?: (projId: string) => void;
}

export const FoundersDashboardView: React.FC<FoundersDashboardViewProps> = ({
  metrics,
  founders,
  clients,
  projects,
  payments,
  onSelectProject,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "clients" | "billing">("overview");

  // Format INR Currency nicely (₹1.59 Cr / ₹78L / ₹60L)
  const formatInr = (amount: number) => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2)} Cr`;
    }
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)} L`;
    }
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  return (
    <div className="space-y-6">
      {/* Header Command Ribbon */}
      <div className="bg-white rounded-3xl p-6 shadow-card-subtle border border-zinc-200/70 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-950 text-white flex items-center justify-center font-bold shadow-xs">
              <Building2 className="w-4 h-4 text-[#d4ff32]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
                  Executive Command Center
                </h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  Live Telemetry
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                Executive portfolio overview: live revenue telemetry, founder ownership, delivery progress, and collection status.
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher Subtabs */}
        <div className="flex bg-zinc-100/80 p-1 rounded-2xl text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveSubTab("overview")}
            className={`px-3.5 py-1.5 rounded-xl transition-all ${
              activeSubTab === "overview"
                ? "bg-white text-zinc-900 shadow-xs font-bold"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Overview & Founders
          </button>
          <button
            onClick={() => setActiveSubTab("clients")}
            className={`px-3.5 py-1.5 rounded-xl transition-all ${
              activeSubTab === "clients"
                ? "bg-white text-zinc-900 shadow-xs font-bold"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Clients & Delivery ({clients.length})
          </button>
          <button
            onClick={() => setActiveSubTab("billing")}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
              activeSubTab === "billing"
                ? "bg-white text-zinc-900 shadow-xs font-bold"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            <span>Billing & Invoices</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#E04F34]"></span>
          </button>
        </div>
      </div>

      {/* TOP-LINE COMPANY METRICS (Exact metrics from prompt) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Metric 1: Total Deal Value */}
        <div className="bg-zinc-950 text-white rounded-3xl p-5 shadow-card-elevated flex flex-col justify-between border border-zinc-900">
          <div className="text-xs text-zinc-400 font-medium">Total Deal Value</div>
          <div className="text-2xl sm:text-3xl font-black tracking-tight mt-1 text-[#d4ff32]">
            {formatInr(metrics.totalDealValue)}
          </div>
          <div className="text-[11px] text-zinc-400 mt-2 font-mono">
            {metrics.totalClients} Accounts Tracked
          </div>
        </div>

        {/* Metric 2: Total Invoiced */}
        <div className="bg-white rounded-3xl p-5 shadow-card-subtle border border-zinc-200/70 flex flex-col justify-between">
          <div className="text-xs text-zinc-500 font-medium">Total Invoiced</div>
          <div className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight mt-1">
            {formatInr(metrics.totalInvoiced)}
          </div>
          <div className="text-[11px] text-zinc-400 mt-2 font-medium">
            Active milestone billings
          </div>
        </div>

        {/* Metric 3: Total Received */}
        <div className="bg-white rounded-3xl p-5 shadow-card-subtle border border-zinc-200/70 flex flex-col justify-between">
          <div className="text-xs text-zinc-500 font-medium">Total Collected</div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight mt-1">
            {formatInr(metrics.totalReceived)}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>76.9% collection rate</span>
          </div>
        </div>

        {/* Metric 4: Total Pending */}
        <div className="bg-white rounded-3xl p-5 shadow-card-subtle border border-zinc-200/70 flex flex-col justify-between">
          <div className="text-xs text-zinc-500 font-medium">Pending Collection</div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 tracking-tight mt-1">
            {formatInr(metrics.totalPending)}
          </div>
          <div className="text-[11px] text-zinc-400 mt-2">
            Awaiting client settlement
          </div>
        </div>

        {/* Metric 5: Overdue Payments */}
        <div className="bg-white rounded-3xl p-5 shadow-card-subtle border border-rose-200/60 bg-rose-50/20 flex flex-col justify-between">
          <div className="text-xs text-rose-600 font-semibold uppercase tracking-wider">Overdue Payments</div>
          <div className="text-2xl sm:text-3xl font-black text-[#E04F34] tracking-tight mt-1">
            {formatInr(metrics.overduePayments)}
          </div>
          <div className="text-[11px] text-rose-700 font-medium mt-2 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>GreenPulse (INV-004)</span>
          </div>
        </div>
      </div>

      {/* SUBTAB 1: OVERVIEW & FOUNDER MATRIX */}
      {activeSubTab === "overview" && (
        <div className="space-y-6">
          {/* Section: Founder Ownership Matrix */}
          <div className="bg-white rounded-3xl p-6 shadow-card-subtle border border-zinc-200/70 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900 tracking-tight">
                  Founder Ownership Matrix
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Deal generation, project delivery leadership, and collection allocations
                </p>
              </div>
              <div className="text-xs font-semibold text-zinc-400">4 Co-Founders</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {founders.map((f) => (
                <div
                  key={f.founder}
                  className="bg-zinc-50/70 hover:bg-white transition-all p-5 rounded-2xl border border-zinc-200/70 space-y-3 group hover:shadow-card-subtle"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-zinc-900">{f.founder}</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">{f.role}</div>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                      {f.founder[0]}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-zinc-200/60 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Clients Originated:</span>
                      <strong className="text-zinc-900">{f.clientsBrought} accounts</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Deal Value:</span>
                      <strong className="text-zinc-900 font-mono">{formatInr(f.totalDealValue)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Delivery Projects:</span>
                      <strong className="text-zinc-900">
                        {f.projectsLed.completed} completed, {f.projectsLed.active} active
                      </strong>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-zinc-200/60">
                      <span className="text-zinc-500">Pending Collection:</span>
                      <strong className="text-amber-700 font-mono">{formatInr(f.pendingCollection)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Sales Pipeline Breakdown & Project Health */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Sales Pipeline Breakdown (Span 5) */}
            <div className="lg:col-span-5 bg-white rounded-3xl p-6 shadow-card-subtle border border-zinc-200/70 space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 tracking-tight">Sales Pipeline Breakdown</h3>
                <p className="text-xs text-zinc-500 mt-0.5">8 Accounts across lifecycle stages</p>

                <div className="mt-4 space-y-2.5">
                  {/* Won */}
                  <div className="p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-emerald-900">Closed Won (5 Deals)</span>
                      <div className="text-[11px] text-emerald-700">Apex, GreenPulse, CloudScale, NexaHealth, Omnikart</div>
                    </div>
                    <span className="font-mono font-bold text-xs text-emerald-950">₹1,02,00,000</span>
                  </div>

                  {/* Negotiation */}
                  <div className="p-3 rounded-2xl bg-purple-50/50 border border-purple-100 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-purple-900">Negotiation (1 Deal)</span>
                      <div className="text-[11px] text-purple-700">Zeta AI Labs (Adnaan)</div>
                    </div>
                    <span className="font-mono font-bold text-xs text-purple-950">₹28,00,000</span>
                  </div>

                  {/* Proposal Sent */}
                  <div className="p-3 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-blue-900">Proposal Sent (1 Deal)</span>
                      <div className="text-[11px] text-blue-700">Bharat Mobility (Abhinav)</div>
                    </div>
                    <span className="font-mono font-bold text-xs text-blue-950">₹20,00,000</span>
                  </div>

                  {/* Discussion */}
                  <div className="p-3 rounded-2xl bg-amber-50/50 border border-amber-100 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-amber-900">Discussion (1 Deal)</span>
                      <div className="text-[11px] text-amber-700">SwiftLogistics Corp (Bhuvan)</div>
                    </div>
                    <span className="font-mono font-bold text-xs text-amber-950">₹9,00,000</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-zinc-950 text-white flex items-center justify-between text-xs font-semibold">
                <span>Total Portfolio Value</span>
                <span className="text-[#d4ff32] font-mono text-sm font-bold">₹1,59,00,000</span>
              </div>
            </div>

            {/* Delivery Progress & Blockers (Span 7) */}
            <div className="lg:col-span-7 bg-white rounded-3xl p-6 shadow-card-subtle border border-zinc-200/70 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 tracking-tight">Active Project Delivery & Blockers</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">5 Software projects in active delivery</p>
                </div>
                <button
                  onClick={() => setActiveSubTab("clients")}
                  className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 flex items-center gap-1 transition-colors"
                >
                  <span>View All</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-2xl border border-zinc-200/60 bg-zinc-50/40 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-zinc-700 bg-white px-2 py-0.5 rounded border border-zinc-200/80">
                          {p.projectId}
                        </span>
                        <span className="font-semibold text-xs text-zinc-900">{p.projectName}</span>
                        <span className="text-[11px] text-zinc-400">· @{p.projectManager}</span>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          p.status === "Completed"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : p.status === "On Hold"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {p.status} ({p.completionPercentage}%)
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 rounded-full bg-zinc-200/70 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          p.status === "Completed"
                            ? "bg-emerald-500"
                            : p.status === "On Hold"
                            ? "bg-rose-400"
                            : "bg-zinc-900"
                        }`}
                        style={{ width: `${p.completionPercentage}%` }}
                      ></div>
                    </div>

                    {/* Blocker alert if any */}
                    {p.blockerDetails && p.blockerDetails !== "None - Live in Production" && (
                      <div className="flex items-center gap-1.5 text-[11px] text-rose-700 bg-rose-50/70 border border-rose-100 px-2.5 py-1 rounded-xl">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                        <span className="truncate">
                          <strong>Blocker:</strong> {p.blockerDetails} (Owner: @{p.blockerOwner})
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: CLIENT MASTER TABLE */}
      {activeSubTab === "clients" && (
        <div className="bg-white rounded-3xl shadow-card-subtle border border-zinc-200/70 overflow-hidden">
          <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-zinc-900 tracking-tight">
                Client Accounts & Delivery Status
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                8 Master client accounts mapped to project delivery and founder owners
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                <tr>
                  <th className="py-3 px-5">Client ID</th>
                  <th className="py-3 px-4">Project ID</th>
                  <th className="py-3 px-4">Company Name & Industry</th>
                  <th className="py-3 px-4">Founder Owner</th>
                  <th className="py-3 px-4">Deal Value</th>
                  <th className="py-3 px-4">Deal Status</th>
                  <th className="py-3 px-4">Delivery Progress</th>
                  <th className="py-3 px-5">Contract Scope</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {clients.map((c) => {
                  const proj = projects.find((p) => p.clientId === c.clientId);
                  return (
                    <tr key={c.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="py-3.5 px-5 font-mono font-bold text-zinc-900 whitespace-nowrap">
                        {c.clientId}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-blue-600 whitespace-nowrap">
                        {c.projectId || "-"}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-zinc-900">{c.companyName}</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">{c.industry}</div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-semibold text-zinc-800">
                          <span className="w-5 h-5 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[10px]">
                            {c.salesOwner[0]}
                          </span>
                          <span>{c.salesOwner}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-zinc-900 whitespace-nowrap">
                        {formatInr(c.dealValue)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            c.dealStatus === "Won"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200/60"
                              : c.dealStatus === "Negotiation"
                              ? "bg-purple-50 text-purple-800 border border-purple-200/60"
                              : "bg-blue-50 text-blue-800 border border-blue-200/60"
                          }`}
                        >
                          {c.dealStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {proj ? (
                          <div>
                            <span className="font-semibold text-xs text-zinc-800">
                              {proj.status} ({proj.completionPercentage}%)
                            </span>
                            <div className="w-20 h-1.5 bg-zinc-200/80 rounded-full mt-1">
                              <div
                                className="h-full bg-zinc-900 rounded-full"
                                style={{ width: `${proj.completionPercentage}%` }}
                              ></div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-zinc-400">Pre-Delivery</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-zinc-500 max-w-xs truncate">
                        {c.contractScope}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: PAYMENTS & BILLING */}
      {activeSubTab === "billing" && (
        <div className="bg-white rounded-3xl shadow-card-subtle border border-zinc-200/70 overflow-hidden">
          <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-zinc-900 tracking-tight">
                Billing & Collections Ledger
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Total Invoiced: {formatInr(metrics.totalInvoiced)} · Collected: {formatInr(metrics.totalReceived)} · Overdue: {formatInr(metrics.overduePayments)}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                <tr>
                  <th className="py-3 px-5">Invoice ID</th>
                  <th className="py-3 px-4">Client ID</th>
                  <th className="py-3 px-4">Company Name</th>
                  <th className="py-3 px-4">Invoiced Amount</th>
                  <th className="py-3 px-4">Received Amount</th>
                  <th className="py-3 px-4">Pending / Overdue</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Payment Status</th>
                  <th className="py-3 px-5">Milestone Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-3.5 px-5 font-mono font-semibold text-zinc-900 whitespace-nowrap">
                      {p.invoiceId}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-zinc-500 whitespace-nowrap">
                      {p.clientId}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-zinc-900 whitespace-nowrap">
                      {p.companyName}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-zinc-900 whitespace-nowrap">
                      {formatInr(p.invoicedAmount)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-emerald-600 font-semibold whitespace-nowrap">
                      {formatInr(p.receivedAmount)}
                    </td>
                    <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                      {p.overdueAmount > 0 ? (
                        <span className="text-[#E04F34] font-bold">{formatInr(p.overdueAmount)} (Overdue)</span>
                      ) : p.pendingAmount > 0 ? (
                        <span className="text-amber-600 font-bold">{formatInr(p.pendingAmount)}</span>
                      ) : (
                        <span className="text-zinc-400">₹0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-zinc-500 whitespace-nowrap">
                      {p.dueDate}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          p.status === "Fully Paid"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200/60"
                            : p.status === "Overdue"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-amber-50 text-amber-800 border border-amber-200/60"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-zinc-500 max-w-xs truncate">
                      {p.milestoneDescription}
                    </td>
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
