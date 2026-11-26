"use client";

// The original Axoraa sidebar card: brand, workspace card, grouped nav with the active item as an
// ink pill, the lime card (Super user / This week) with the sync line and support address, and the
// user pill. Reads everything from useHub(); the same component fills the phone drawer.
import React from "react";
import { ChevronRight, Plus, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";
import { COMPANY_EMAIL, supportMailto } from "@/lib/company";
import { useHub } from "@/lib/hub/context";
import { navGroupsFor, type ViewId } from "@/lib/views";
import { HelpMenu } from "./HelpMenu";
import { SyncLine } from "./SyncLine";
import { UserMenu } from "./UserMenu";

export type NavCounts = Partial<Record<ViewId, { count: number; alert?: boolean; label?: string }>>;

/** What the lime card says above the sync line. */
export type LimeCardContent =
  | { kind: "admin"; attention: number; onReview: () => void }
  | { kind: "member"; label: string; value: string | null; unit: string; action: { label: string; run: () => void } | null };

export function Sidebar({
  counts,
  lime,
  workspaceLabel,
  workspaceSub,
  roleLabel,
  onShortcuts,
  onClose,
  inDrawer = false,
}: {
  counts: NavCounts;
  lime: LimeCardContent;
  workspaceLabel: string;
  workspaceSub: string;
  roleLabel: string;
  onShortcuts: () => void;
  /** Drawer only: close after navigating. */
  onClose?: () => void;
  inDrawer?: boolean;
}) {
  const { viewer, view, navigate, data } = useHub();
  const groups = navGroupsFor(viewer.category);
  const go = (id: ViewId) => {
    navigate(id);
    onClose?.();
  };

  return (
    <nav aria-label="Main" className={`flex h-full flex-col ${inDrawer ? "" : "card overflow-hidden p-4"}`}>
      {!inDrawer && (
        <div className="flex items-center gap-3 px-1 pt-1">
          <BrandMark className="h-11 w-11" />
          <div>
            <div className="text-[17px] font-medium leading-none tracking-[-0.02em]">Axoraa</div>
            <div className="mt-1 text-[12px] text-ink-3">Operations Hub</div>
          </div>
        </div>
      )}

      <div className={`${inDrawer ? "" : "mt-5"} rounded-[20px] bg-surface-2 px-3.5 py-3`}>
        <div className="truncate text-[13.5px] font-medium">{workspaceLabel}</div>
        <div className="truncate text-[12px] text-ink-3">{workspaceSub}</div>
      </div>

      <div className={`no-scrollbar -mx-1 mt-4 min-h-[120px] flex-1 space-y-5 px-1 ${inDrawer ? "" : "overflow-y-auto"}`}>
        {groups.map((g) => (
          <div key={g.id}>
            {g.label && <div className="mb-1.5 px-3 text-[12px] text-ink-3">{g.label}</div>}
            <ul className="space-y-0.5">
              {g.views.map((v) => {
                const isActive = v.id === view;
                const c = counts[v.id];
                const Icon = v.icon;
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => go(v.id)}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex h-11 w-full items-center gap-3 rounded-full px-3 text-[14px] transition-colors duration-200 ${
                        isActive ? "bg-ink-panel text-on-ink-panel" : "text-ink hover:bg-surface-2"
                      }`}
                    >
                      <Icon aria-hidden className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-lime" : "text-ink-2"}`} />
                      <span className="min-w-0 flex-1 truncate text-left">{v.label}</span>
                      {c && c.count > 0 && (
                        <span
                          className={`text-[12px] tabular-nums ${
                            c.alert
                              ? "flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1.5 text-white"
                              : isActive
                              ? "text-white/60"
                              : "text-ink-3"
                          }`}
                        >
                          {c.count}
                          {c.label && <span className="sr-only"> {c.label}</span>}
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

      <div className="card-lime mt-4 shrink-0 rounded-[22px]! p-4">
        {lime.kind === "admin" ? (
          <>
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-lime">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium leading-tight">Super user</div>
                <div className="truncate text-[12px] text-ink/60">Full access to every workspace</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                lime.onReview();
                onClose?.();
              }}
              className="mt-3 flex h-10 w-full items-center justify-between rounded-full bg-white px-4 text-[13px] text-ink transition-colors hover:bg-white/80"
            >
              <span className="truncate">{lime.attention > 0 ? `${lime.attention} need your review` : "All caught up"}</span>
              <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0" />
            </button>
          </>
        ) : (
          <>
            <div className="text-[12px] text-ink/60">{lime.label}</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="num text-[34px]">{lime.value ?? "–"}</span>
              <span className="text-[13px] text-ink/60">{lime.unit}</span>
            </div>
            {lime.action && (
              <button
                type="button"
                onClick={() => {
                  lime.action?.run();
                  onClose?.();
                }}
                className="mt-3 flex h-10 w-full items-center justify-between rounded-full bg-white px-4 text-[13px] text-ink transition-colors hover:bg-white/80"
              >
                <span className="truncate">{lime.action.label}</span>
                <Plus aria-hidden className="h-3.5 w-3.5 shrink-0" />
              </button>
            )}
          </>
        )}

        <div className="mt-3 space-y-2 border-t border-ink/10 pt-3">
          <SyncLine
            data={data}
            onOpen={
              viewer.category === "admin"
                ? () => {
                    navigate("integrations");
                    onClose?.();
                  }
                : undefined
            }
          />
          <a
            href={supportMailto({ subject: `Hub help – ${viewer.name}` })}
            className="block rounded-lg text-[12px] text-ink/60 transition-colors hover:text-ink"
          >
            Help: {COMPANY_EMAIL}
          </a>
        </div>
      </div>

      <div className="mt-3 flex shrink-0 items-center gap-1 rounded-full bg-surface-2 p-0.5 pr-1.5">
        <UserMenu viewer={viewer} roleLabel={roleLabel} onShortcuts={onShortcuts} />
        <HelpMenu
          viewerName={viewer.name}
          viewLabel={groups.flatMap((g) => g.views).find((v) => v.id === view)?.label ?? view}
          onGuide={() => go("help")}
          onShortcuts={onShortcuts}
        />
      </div>
    </nav>
  );
}
