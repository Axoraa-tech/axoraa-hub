"use client";

import React, { useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";
import { Avatar } from "@/components/ui/primitives";
import { logout } from "@/app/login/actions";

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
  alert?: boolean;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export function AppShell({
  groups,
  active,
  onNavigate,
  viewerName,
  viewerRole,
  workspaceLabel,
  workspaceSub,
  statusCard,
  title,
  subtitle,
  headerRight,
  banner,
  children,
}: {
  groups: NavGroup[];
  active: string;
  onNavigate: (id: string) => void;
  viewerName: string;
  viewerRole: string;
  workspaceLabel: string;
  workspaceSub: string;
  statusCard?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  headerRight?: React.ReactNode;
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const sidebar = (
    <nav className="card h-full flex flex-col p-4 overflow-hidden">
      <div className="flex items-center justify-between px-1 pt-1">
        <div className="flex items-center gap-3">
          <BrandMark className="w-11 h-11" />
          <div>
            <div className="text-[17px] font-medium tracking-[-0.02em] leading-none">Axoraa</div>
            <div className="text-[11.5px] text-ink-3 mt-1">Operations Hub</div>
          </div>
        </div>
        <button className="icon-btn lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-5 rounded-[20px] bg-surface-2 px-3.5 py-3">
        <div className="text-[13.5px] font-medium truncate">{workspaceLabel}</div>
        <div className="text-[12px] text-ink-3 truncate">{workspaceSub}</div>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto no-scrollbar -mx-1 px-1 space-y-5">
        {groups.map((g, gi) => (
          <div key={gi}>
            {g.label && <div className="px-3 mb-1.5 text-[11.5px] text-ink-3">{g.label}</div>}
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const isActive = item.id === active;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        onNavigate(item.id);
                        setOpen(false);
                      }}
                      aria-current={isActive ? "page" : undefined}
                      className={`w-full h-11 flex items-center gap-3 px-3 rounded-full text-[14px] transition-colors ${
                        isActive ? "bg-ink text-white" : "text-ink hover:bg-surface-2"
                      }`}
                    >
                      <span className={`[&>svg]:w-[18px] [&>svg]:h-[18px] ${isActive ? "text-lime" : "text-ink-2"}`}>{item.icon}</span>
                      <span className="flex-1 text-left truncate">{item.label}</span>
                      {typeof item.count === "number" && (
                        <span
                          className={`text-[12px] tabular-nums ${
                            item.alert ? "min-w-5 h-5 px-1.5 rounded-full bg-coral text-white flex items-center justify-center" : isActive ? "text-white/60" : "text-ink-3"
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {statusCard && <div className="mt-4">{statusCard}</div>}

      <div className="mt-3 rounded-full bg-surface-2 p-1.5 pr-2 flex items-center gap-2.5">
        <Avatar name={viewerName} size={38} />
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-medium truncate leading-tight">{viewerName}</div>
          <div className="text-[11.5px] text-ink-3 truncate">{viewerRole}</div>
        </div>
        <form action={logout}>
          <button type="submit" title="Sign out" aria-label="Sign out" className="w-9 h-9 rounded-full flex items-center justify-center text-ink-2 hover:bg-surface hover:text-coral transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </form>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen p-2.5 sm:p-3 lg:p-4 flex gap-3 lg:gap-4">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-[280px] shrink-0 sticky top-4 h-[calc(100vh-2rem)] no-print">{sidebar}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <aside className="absolute left-2 top-2 bottom-2 w-[300px] max-w-[85vw] animate-rise">{sidebar}</aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 px-1 sm:px-2 pt-2 pb-5 sm:pb-6">
          <div className="flex items-start gap-3 min-w-0">
            <button className="icon-btn lg:hidden shrink-0 mt-1 no-print" aria-label="Open menu" onClick={() => setOpen(true)}>
              <Menu className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h1 className="title-xl break-words">{title}</h1>
              {subtitle && <p className="text-[14px] text-ink-2 mt-2.5">{subtitle}</p>}
            </div>
          </div>
          {headerRight && <div className="flex flex-wrap items-center gap-2 no-print">{headerRight}</div>}
        </header>
        {banner}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
