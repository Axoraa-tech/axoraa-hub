"use client";

// The frame around every view: the original sidebar card (a drawer below lg), the big title row
// with search, notifications and the page's one primary action, the administrator banner, and the
// floating ink pill bar on phones. Reads data, viewer and navigation from useHub().
import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Menu as MenuIcon, Plus, Search } from "lucide-react";
import { Sheet } from "@/components/ui/Dialog";
import { BrandMark } from "@/components/ui/BrandMark";
import type { HubAlert } from "@/lib/alerts";
import { useHub } from "@/lib/hub/context";
import { useDensity } from "@/lib/prefs";
import { mobileBarFor } from "@/lib/views";
import { MobileNav } from "./MobileNav";
import { NotificationsMenu } from "./NotificationsMenu";
import { Sidebar, type LimeCardContent, type NavCounts } from "./Sidebar";

export interface PrimaryAction {
  label: string;
  run: () => void;
}

export function AppShell({
  title,
  description,
  primary,
  alerts,
  onAlert,
  counts,
  lime,
  workspaceLabel,
  workspaceSub,
  roleLabel,
  onOpenPalette,
  onShortcuts,
  mac,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  primary: PrimaryAction | null;
  alerts: readonly HubAlert[];
  onAlert: (a: HubAlert) => void;
  counts: NavCounts;
  lime: LimeCardContent;
  workspaceLabel: string;
  workspaceSub: string;
  roleLabel: string;
  onOpenPalette: () => void;
  onShortcuts: () => void;
  mac: boolean;
  children: React.ReactNode;
}) {
  const { viewer, view, navigate } = useHub();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [density] = useDensity();

  const sidebarProps = { counts, lime, workspaceLabel, workspaceSub, roleLabel, onShortcuts };

  const searchButton = (
    <button type="button" className="icon-btn" aria-label={`Search and commands (${mac ? "⌘" : "Ctrl"} K)`} title={`Search (${mac ? "⌘" : "Ctrl"} K)`} onClick={onOpenPalette}>
      <Search aria-hidden />
    </button>
  );
  const bell = <NotificationsMenu alerts={alerts} accountId={viewer.accountId} onSelect={onAlert} />;

  return (
    <div data-density={density} className="flex min-h-dvh gap-3 p-2.5 sm:p-3 lg:gap-4 lg:p-4">
      {/* Desktop sidebar */}
      <aside data-shell-chrome className="no-print sticky top-4 hidden h-[calc(100dvh-2rem)] w-[280px] shrink-0 lg:block">
        <Sidebar {...sidebarProps} />
      </aside>

      {/* Phone and tablet drawer */}
      <Sheet open={drawerOpen} onClose={() => setDrawerOpen(false)} side="left" title="Axoraa" description="Operations Hub">
        <div data-shell-chrome className="h-full">
          <Sidebar {...sidebarProps} inDrawer onClose={() => setDrawerOpen(false)} />
        </div>
      </Sheet>

      <div className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-1 flex-col pb-28 md:pb-6">
        {/* Top bar below lg */}
        <div data-shell-chrome className="no-print flex items-center justify-between gap-2 px-1 pt-1 sm:px-2 lg:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              className="icon-btn"
              aria-label="Open navigation"
              aria-haspopup="dialog"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
            >
              <MenuIcon aria-hidden />
            </button>
            <BrandMark className="h-10 w-10" />
            <span className="hidden truncate text-[15px] font-medium tracking-[-0.02em] min-[420px]:inline">Axoraa</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {searchButton}
            {bell}
            {primary && (
              <button
                type="button"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent transition-[background-color,transform] hover:bg-accent-hover active:scale-[0.96]"
                aria-label={primary.label}
                title={primary.label}
                onClick={primary.run}
              >
                <Plus aria-hidden className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <header className="flex flex-col justify-between gap-4 px-1 pb-5 pt-4 sm:px-2 sm:pb-6 lg:pt-2 xl:flex-row xl:items-end">
          <div className="min-w-0">
            <h1 className="title-xl break-words">{title}</h1>
            {description && <p className="mt-2.5 text-[14px] text-ink-2">{description}</p>}
          </div>
          <div data-shell-chrome className="no-print hidden flex-wrap items-center gap-2 lg:flex">
            <button
              type="button"
              onClick={onOpenPalette}
              className="flex h-10 items-center gap-2 rounded-full bg-surface pl-3.5 pr-2 text-[13px] text-ink-3 shadow-[inset_0_0_0_1px_var(--color-line)] transition-[box-shadow,background-color] hover:bg-surface-2 hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]"
            >
              <Search aria-hidden className="h-4 w-4" />
              <span className="pr-4">Search or jump to…</span>
              <span aria-hidden className="flex items-center gap-1">
                <kbd className="kbd">{mac ? "⌘" : "Ctrl"}</kbd>
                <kbd className="kbd">K</kbd>
              </span>
              <span className="sr-only">Open the command bar</span>
            </button>
            {bell}
            {primary && (
              <button type="button" className="btn btn-ink" onClick={primary.run} aria-keyshortcuts="n">
                <Plus aria-hidden />
                {primary.label}
              </button>
            )}
          </div>
        </header>

        {viewer.viewerIsAdmin && viewer.kind === "member" && (
          <div data-shell-chrome className="card-ink no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[22px]! px-4 py-3 sm:rounded-full! sm:px-5">
            <span className="text-[13px] text-white/70">
              You are viewing <span className="font-medium text-white">{viewer.name}</span>&apos;s workspace as administrator.
            </span>
            <Link href="/admin" className="btn btn-lime btn-sm">
              <ArrowLeft aria-hidden />
              Back to admin
            </Link>
          </div>
        )}

        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>

      <MobileNav items={mobileBarFor(viewer.category)} active={view} onNavigate={(id) => navigate(id)} onMore={() => setDrawerOpen(true)} moreOpen={drawerOpen} />
    </div>
  );
}
