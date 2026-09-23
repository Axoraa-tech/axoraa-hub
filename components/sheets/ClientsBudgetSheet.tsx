"use client";

import React from "react";
import { ClientBudgetRecord } from "@/lib/types";
import { DollarSign, FileText, CheckCircle2, Clock, Plus } from "lucide-react";

interface ClientsBudgetSheetProps {
  budgets: ClientBudgetRecord[];
  onAddClient?: () => void;
}

export const ClientsBudgetSheet: React.FC<ClientsBudgetSheetProps> = ({
  budgets,
  onAddClient,
}) => {
  const totalValue = budgets.reduce((acc, b) => acc + b.totalContractValue, 0);
  const totalBilled = budgets.reduce((acc, b) => acc + b.billedAmount, 0);
  const totalReceived = budgets.reduce((acc, b) => acc + b.receivedAmount, 0);
  const totalPending = budgets.reduce((acc, b) => acc + b.pendingAmount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 shadow-card-subtle border border-zinc-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Client Accounts, Budget & Invoicing</h2>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Project 3 · Financial Operations
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Tracking contracts, milestones, billing status, amounts received, and accounts receivable.
          </p>
        </div>

        <button
          onClick={onAddClient}
          className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Client Account</span>
        </button>
      </div>

      {/* Financial KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-950 text-white rounded-3xl p-5 shadow-card-elevated border border-zinc-900">
          <div className="text-xs text-zinc-400 font-medium">Total Contract Value</div>
          <div className="text-3xl font-black text-white tracking-tight mt-1">
            ${totalValue.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-400 mt-2 font-medium">
            Across {budgets.length} enterprise clients
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-card-subtle border border-zinc-200/80">
          <div className="text-xs text-zinc-500 font-medium">Total Billed to Date</div>
          <div className="text-3xl font-black text-zinc-900 tracking-tight mt-1">
            ${totalBilled.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-500 mt-2 font-medium">
            {Math.round((totalBilled / (totalValue || 1)) * 100)}% of total portfolio
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-card-subtle border border-zinc-200/80">
          <div className="text-xs text-zinc-500 font-medium">Collected / Received</div>
          <div className="text-3xl font-black text-emerald-600 tracking-tight mt-1">
            ${totalReceived.toLocaleString()}
          </div>
          <div className="text-xs text-emerald-700 font-semibold mt-2">
            Verified in bank settlement
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-card-subtle border border-zinc-200/80">
          <div className="text-xs text-zinc-500 font-medium">Pending / Outstanding</div>
          <div className="text-3xl font-black text-[#E04F34] tracking-tight mt-1">
            ${totalPending.toLocaleString()}
          </div>
          <div className="text-xs text-[#E04F34] font-semibold mt-2">
            Milestones due this month
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-3xl shadow-card-subtle border border-zinc-200/80 overflow-hidden">
        <div className="p-6 border-b border-zinc-100">
          <h3 className="text-sm font-bold text-zinc-900">Client Accounts & Milestone Billing</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
              <tr>
                <th className="py-3 px-6">Client Name</th>
                <th className="py-3 px-4">Project Scope</th>
                <th className="py-3 px-4">Total Contract</th>
                <th className="py-3 px-4">Billed Amount</th>
                <th className="py-3 px-4">Received</th>
                <th className="py-3 px-4">Pending</th>
                <th className="py-3 px-4">Billing Status</th>
                <th className="py-3 px-6">Next Milestone Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {budgets.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-50/80 transition-colors">
                  <td className="py-4 px-6 font-bold text-zinc-900 whitespace-nowrap">
                    {item.clientName}
                  </td>
                  <td className="py-4 px-4 text-zinc-600 max-w-xs truncate">{item.projectName}</td>
                  <td className="py-4 px-4 font-mono font-bold text-zinc-900">
                    ${item.totalContractValue.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 font-mono text-zinc-700">
                    ${item.billedAmount.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 font-mono text-emerald-600 font-semibold">
                    ${item.receivedAmount.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 font-mono text-[#E04F34] font-bold">
                    ${item.pendingAmount.toLocaleString()}
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        item.status === "Up to Date"
                          ? "bg-emerald-50 text-emerald-700"
                          : item.status === "Retainer"
                          ? "bg-purple-50 text-purple-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-zinc-500">
                    <div className="font-medium text-zinc-800">{item.nextMilestone}</div>
                    <div className="text-[11px] font-mono text-zinc-400 mt-0.5">{item.dueDate}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
