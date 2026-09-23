"use client";

import React from "react";
import { UserProfile } from "@/lib/types";
import { INITIAL_USER_PROFILES } from "@/lib/mockData";
import { X, Check, Building2, Code2, TrendingUp, Briefcase } from "lucide-react";

interface RoleSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onSelectUser: (user: UserProfile) => void;
}

export const RoleSwitcherModal: React.FC<RoleSwitcherModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSelectUser,
}) => {
  if (!isOpen) return null;

  const founderUsers = INITIAL_USER_PROFILES.filter((u) => u.category === "founder");
  const devUsers = INITIAL_USER_PROFILES.filter((u) => u.category === "developer");
  const marketingUsers = INITIAL_USER_PROFILES.filter((u) => u.category === "marketing");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Switch Persona & Role</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Experience the unified platform as a Founder, Developer, or Field Marketing Rep
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Founders & Executive Owners */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-zinc-700" />
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Co-Founders & Executive Command (4 Owners)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {founderUsers.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  isSelected={user.id === currentUser.id}
                  onSelect={() => {
                    onSelectUser(user);
                    onClose();
                  }}
                />
              ))}
            </div>
          </div>

          {/* Field Marketing & Sales */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-zinc-700" />
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Field Marketing & BD Reps (Kamil & Anusha)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {marketingUsers.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  isSelected={user.id === currentUser.id}
                  onSelect={() => {
                    onSelectUser(user);
                    onClose();
                  }}
                />
              ))}
            </div>
          </div>

          {/* Engineering Specialists */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Code2 className="w-4 h-4 text-zinc-700" />
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Engineering Team Specialists
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {devUsers.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  isSelected={user.id === currentUser.id}
                  onSelect={() => {
                    onSelectUser(user);
                    onClose();
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
          <span>
            Active Persona: <strong className="text-zinc-800">{currentUser.name}</strong> ({currentUser.roleTitle})
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-950 text-white rounded-xl font-medium hover:bg-zinc-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

const UserCard: React.FC<{
  user: UserProfile;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ user, isSelected, onSelect }) => {
  return (
    <button
      onClick={onSelect}
      className={`text-left p-3 rounded-2xl border transition-all flex items-center justify-between group ${
        isSelected
          ? "border-zinc-900 bg-zinc-900 text-white shadow-md ring-2 ring-zinc-900/10"
          : "border-zinc-200/80 bg-white hover:border-zinc-400 hover:bg-zinc-50/80 text-zinc-900"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <img
          src={user.avatar}
          alt={user.name}
          className="w-9 h-9 rounded-full object-cover border border-white/20 shrink-0"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-xs truncate">{user.name}</span>
            {user.category === "founder" && (
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${isSelected ? "bg-[#d4ff32] text-zinc-950" : "bg-amber-100 text-amber-800"}`}>
                FOUNDER
              </span>
            )}
            {user.category === "marketing" && (
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${isSelected ? "bg-purple-300 text-zinc-950" : "bg-purple-100 text-purple-800"}`}>
                SALES
              </span>
            )}
          </div>
          <p className={`text-[11px] truncate mt-0.5 ${isSelected ? "text-zinc-300" : "text-zinc-500"}`}>
            {user.roleTitle}
          </p>
        </div>
      </div>
      {isSelected && (
        <div className="w-5 h-5 rounded-full bg-[#d4ff32] text-zinc-950 flex items-center justify-center shrink-0 ml-1">
          <Check className="w-3 h-3 stroke-[3]" />
        </div>
      )}
    </button>
  );
};
