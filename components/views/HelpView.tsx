"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  CircleAlert,
  Database,
  Keyboard,
  LifeBuoy,
  ListOrdered,
  Mail,
  PenLine,
  Plug,
  RefreshCw,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import { Kbd } from "@/components/ui/primitives";
import { Select } from "@/components/ui/form";
import { useHub } from "@/lib/hub/context";
import { canAccessView, viewsFor } from "@/lib/views";
import { agentRoleOf, agentsFor } from "@/lib/agents/catalog";
import { COMPANY_EMAIL, supportMailto } from "@/lib/company";
import { relativeTime } from "@/lib/format";
import { useNow } from "@/lib/prefs";
import {
  ASSISTANT_POINTS,
  CLIENT_EMAIL_RULES,
  CONTACT,
  DAILY_ROUTINE,
  DATA_EXPLAINERS,
  ESCALATION_LEVELS,
  GLOBAL_SHORTCUTS,
  GOLDEN_RULES,
  HELP_SECTIONS,
  P1_RULE,
  SHORTCUT_NOTE,
  YOUR_DAY,
  escalationCode,
  escalationName,
  type HelpSection,
  type HelpSectionId,
  type ShortcutRow,
} from "@/lib/help-content";

const SECTION: Record<HelpSectionId, HelpSection> = Object.fromEntries(HELP_SECTIONS.map((s) => [s.id, s])) as Record<
  HelpSectionId,
  HelpSection
>;

const anchorId = (id: HelpSectionId) => `help-${id}`;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Scrolls to a section and moves focus to its heading, without touching the ?view= URL. */
function jumpTo(id: HelpSectionId) {
  const el = document.getElementById(anchorId(id));
  if (!el) return;
  el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  const heading = document.getElementById(`${anchorId(id)}-title`);
  heading?.focus({ preventScroll: true });
}

/* ------------------------------------------------------------------ card shell */

type Tone = "plain" | "ink" | "lime";

function HelpCard({
  id,
  icon,
  tone = "plain",
  action,
  className = "",
  children,
}: {
  id: HelpSectionId;
  icon: React.ReactNode;
  tone?: Tone;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const s = SECTION[id];
  const surface = tone === "ink" ? "card-ink" : tone === "lime" ? "card-lime" : "card";
  const iconCls =
    tone === "ink" ? "bg-white/10 text-lime" : tone === "lime" ? "bg-ink text-lime" : "bg-surface-2 text-ink";
  const subCls = tone === "ink" ? "text-white/55" : tone === "lime" ? "text-ink-2" : "text-ink-3";
  return (
    <section
      id={anchorId(id)}
      aria-labelledby={`${anchorId(id)}-title`}
      className={`${surface} min-w-0 scroll-mt-24 p-5 animate-rise sm:p-6 lg:scroll-mt-6 ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full [&>svg]:h-[18px] [&>svg]:w-[18px] ${iconCls}`}>
            {icon}
          </span>
          <div className="min-w-0">
            <h2
              id={`${anchorId(id)}-title`}
              tabIndex={-1}
              className="text-[17px] font-medium leading-tight tracking-[-0.02em] focus:outline-none"
            >
              {s.title}
            </h2>
            <p className={`mt-1 text-[12.5px] ${subCls}`}>{s.summary}</p>
          </div>
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ navigation */

function useActiveSection(): [HelpSectionId, (id: HelpSectionId) => void] {
  const [active, setActive] = useState<HelpSectionId>(HELP_SECTIONS[0].id);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const visible = new Map<HelpSectionId, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = e.target.id.replace(/^help-/, "") as HelpSectionId;
          if (e.isIntersecting) visible.set(id, e.boundingClientRect.top);
          else visible.delete(id);
        }
        // The first section (in page order) that is in the reading band wins.
        const first = HELP_SECTIONS.find((s) => visible.has(s.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "-15% 0px -55% 0px", threshold: 0 }
    );
    for (const s of HELP_SECTIONS) {
      const el = document.getElementById(anchorId(s.id));
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return [active, setActive];
}

function SectionNav({ active, onJump }: { active: HelpSectionId; onJump: (id: HelpSectionId) => void }) {
  return (
    <nav aria-label="Help sections" className="card sticky top-4 p-2">
      <ul className="space-y-0.5">
        {HELP_SECTIONS.map((s) => {
          const on = s.id === active;
          return (
            <li key={s.id}>
              <a
                href={`#${anchorId(s.id)}`}
                aria-current={on ? "location" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  onJump(s.id);
                }}
                className={`flex h-10 items-center rounded-full px-4 text-[13.5px] transition-colors ${
                  on ? "bg-ink font-medium text-white" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {s.title}
              </a>
            </li>
          );
        })}
      </ul>
      <a
        href={supportMailto({ subject: "Hub help" })}
        className="mt-2 flex items-center gap-2 rounded-full px-4 py-2.5 text-[12.5px] text-ink-3 hover:text-ink"
      >
        <Mail aria-hidden className="h-3.5 w-3.5" />
        <span className="truncate">{COMPANY_EMAIL}</span>
      </a>
    </nav>
  );
}

/* ------------------------------------------------------------------ helpers */

function Keys({ row }: { row: ShortcutRow }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {row.keys.map((step, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <span className="px-0.5 text-[12px] text-ink-3">then</span>}
          {step.map((k) => (
            <Kbd key={k}>{k}</Kbd>
          ))}
        </span>
      ))}
    </span>
  );
}

function escalationChip(level: string): string {
  switch (escalationCode(level)) {
    case "P1":
      return "chip chip-coral";
    case "P2":
      return "chip chip-amber";
    case "P3":
      return "chip chip-outline";
    default:
      return "chip";
  }
}

function StatusTile({
  label,
  value,
  tone,
  children,
}: {
  label: string;
  value: React.ReactNode;
  tone: "good" | "amber" | "coral" | "neutral";
  children?: React.ReactNode;
}) {
  const dot = tone === "good" ? "bg-good" : tone === "amber" ? "bg-amber" : tone === "coral" ? "bg-coral" : "bg-ink-3";
  return (
    <div className="card-inset flex min-w-0 flex-col justify-between gap-3 p-4">
      <div className="text-[12px] text-ink-3">{label}</div>
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
        <span className="min-w-0 truncate text-[14px] font-medium text-ink">{value}</span>
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ view */

export function HelpView() {
  const { data, viewer, features, navigate } = useHub();
  const [active, setActive] = useActiveSection();
  const now = useNow();

  const category = viewer.category;
  const day = YOUR_DAY[category];
  const isAdminCategory = category === "admin";
  const canOpenIntegrations = canAccessView(category, "integrations");
  const canOpenAssistant = canAccessView(category, "assistant");

  const agents = useMemo(
    () => agentsFor(agentRoleOf(category), data.settings.disabledAgents),
    [category, data.settings]
  );

  const shortcuts = useMemo<ShortcutRow[]>(() => {
    const chords = viewsFor(category)
      .filter((v) => v.chord)
      .map((v) => ({ keys: (v.chord ?? "").split(" ").map((k) => [k.toUpperCase()]), label: `Go to ${v.label}` }));
    return [...GLOBAL_SHORTCUTS, ...chords];
  }, [category]);

  const jump = (id: HelpSectionId) => {
    setActive(id);
    jumpTo(id);
  };

  const unsyncedCount = data.unsynced.length;
  const sheetsVersion = data.remoteVersion ?? features.sheets.version;
  const lastSynced = data.syncState.lastSyncedAt;
  const helpSubject = `Hub help – ${viewer.name}`;

  return (
    <div className="xl:grid xl:grid-cols-[212px_minmax(0,1fr)] xl:items-start xl:gap-5">
      <div className="hidden xl:block xl:self-stretch">
        <SectionNav active={active} onJump={jump} />
      </div>

      <div className="min-w-0 space-y-3 sm:space-y-4">
        {/* Phones and tablets: a jump list instead of the side navigation. */}
        <div className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between xl:hidden">
          <label htmlFor="help-jump" className="text-[12px] font-medium text-ink-2">
            Jump to a section
          </label>
          <Select
            id="help-jump"
            value={active}
            onChange={(e) => jump(e.target.value as HelpSectionId)}
            className="w-full sm:max-w-[280px]"
          >
            {HELP_SECTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:gap-4 min-[1360px]:grid-cols-12">
          {/* Your day: the one ink card */}
          <HelpCard id="your-day" icon={<Sun />} tone="ink" className="min-[1360px]:col-span-7">
            <p className="text-[26px] font-medium leading-tight tracking-[-0.035em] sm:text-[30px]">
              Your day as <span className="text-lime">{day.roleLabel}</span>
            </p>
            <ul className="mt-5 space-y-4">
              {day.items.map((item) => (
                <li key={item.title} className="flex gap-3">
                  <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lime text-on-lime">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[14.5px] font-medium">{item.title}</div>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-white/60">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            {isAdminCategory && (
              <div className="mt-6 border-t border-white/10 pt-4">
                <div className="text-[12px] text-white/50">What the team is asked to do</div>
                <ul className="mt-2 space-y-1.5 text-[13px] text-white/75">
                  {(["developer", "marketing", "founder"] as const).map((r) => (
                    <li key={r} className="flex flex-wrap gap-x-1.5">
                      <span className="font-medium capitalize text-white">{r === "marketing" ? "Marketing" : `${r}s`}:</span>
                      <span>{YOUR_DAY[r].items.map((i) => i.title.toLowerCase()).join("; ")}.</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </HelpCard>

          {/* Daily routine */}
          <HelpCard id="daily-routine" icon={<ListOrdered />} className="min-[1360px]:col-span-5">
            <div className="relative">
              <span aria-hidden className="absolute bottom-3 left-[13px] top-3 w-px bg-line" />
              <ol className="relative space-y-4">
              {DAILY_ROUTINE.map((step, i) => (
                <li key={step} className="relative flex gap-3">
                  <span
                    aria-hidden
                    className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-medium tabular-nums ${
                      i === 0 ? "bg-lime text-on-lime" : "bg-surface-2 text-ink-2 ring-4 ring-surface"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <p className="min-w-0 pt-1 text-[13.5px] leading-relaxed text-ink">{step}</p>
                </li>
              ))}
              </ol>
            </div>
          </HelpCard>

          {/* Escalation */}
          <HelpCard id="escalation" icon={<CircleAlert />} className="min-[1360px]:col-span-12">
            <div className="-mx-2 hidden md:block">
              <table className="table-clean">
                <caption className="sr-only">Blocker escalation levels</caption>
                <thead>
                  <tr>
                    <th className="w-[22%]">Level</th>
                    <th className="w-[36%]">When</th>
                    <th>What to do</th>
                  </tr>
                </thead>
                <tbody>
                  {ESCALATION_LEVELS.map((e) => (
                    <tr key={e.level}>
                      <td>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={escalationChip(e.level)}>{escalationCode(e.level)}</span>
                          <span className="font-medium">{escalationName(e.level)}</span>
                        </div>
                      </td>
                      <td className="text-ink-2">{e.trigger}</td>
                      <td>{e.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="space-y-2 md:hidden">
              {ESCALATION_LEVELS.map((e) => (
                <li key={e.level} className="card-inset p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={escalationChip(e.level)}>{escalationCode(e.level)}</span>
                    <span className="text-[14px] font-medium">{escalationName(e.level)}</span>
                  </div>
                  <p className="mt-3 text-[12px] text-ink-3">When</p>
                  <p className="mt-0.5 text-[13px] text-ink-2">{e.trigger}</p>
                  <p className="mt-3 text-[12px] text-ink-3">What to do</p>
                  <p className="mt-0.5 text-[13px] text-ink">{e.action}</p>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-3 rounded-inset bg-coral-soft p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-coral text-white">
                  <CircleAlert className="h-4 w-4" />
                </span>
                <p className="min-w-0 pt-1.5 text-[13.5px] font-medium text-ink">{P1_RULE}</p>
              </div>
              <a
                href={supportMailto({ subject: `P1 blocker – ${viewer.name}`, body: "What is down:\n\nSince when:\n\nWho is affected:\n" })}
                className="btn btn-ink btn-sm self-start sm:self-auto"
              >
                <Mail aria-hidden className="h-3.5 w-3.5" />
                Email {COMPANY_EMAIL}
              </a>
            </div>
          </HelpCard>

          {/* Golden rules */}
          <HelpCard id="golden-rules" icon={<BookOpenCheck />} className="min-[1360px]:col-span-7">
            <ul className="divide-hair">
              {GOLDEN_RULES.map((r) => (
                <li key={r.category} className="grid gap-2 py-3.5 first:pt-0 last:pb-0 md:grid-cols-[150px_minmax(0,1fr)] md:gap-4">
                  <div className="text-[13.5px] font-medium">{r.category}</div>
                  <div className="space-y-1.5">
                    <p className="flex items-start gap-2 text-[13px] text-ink">
                      <span aria-hidden className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-good-soft text-positive">
                        <Check className="h-3 w-3" />
                      </span>
                      <span>
                        <span className="sr-only">Do: </span>
                        {r.do}
                      </span>
                    </p>
                    <p className="flex items-start gap-2 text-[13px] text-ink-2">
                      <span aria-hidden className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-coral-soft text-negative">
                        <X className="h-3 w-3" />
                      </span>
                      <span>
                        <span className="sr-only">Avoid: </span>
                        {r.dont}
                      </span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </HelpCard>

          {/* Client email rules */}
          <HelpCard id="client-email" icon={<Mail />} className="min-[1360px]:col-span-5">
            <ul className="space-y-2">
              {CLIENT_EMAIL_RULES.map((r) => (
                <li key={r.title} className="card-inset p-4">
                  <div className="text-[13.5px] font-medium">{r.title}</div>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{r.body}</p>
                </li>
              ))}
            </ul>
          </HelpCard>

          {/* Where your data lives */}
          <HelpCard
            id="data"
            icon={<Database />}
            className="min-[1360px]:col-span-7"
            action={
              data.syncState.busy ? (
                <span className="chip">
                  <RefreshCw aria-hidden className="h-3 w-3 animate-spin motion-reduce:animate-none" />
                  Syncing
                </span>
              ) : undefined
            }
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <StatusTile
                label="Work logs"
                value={data.source === "sheet" ? "Google Sheet" : "This browser"}
                tone={data.source === "sheet" ? "good" : "amber"}
              />
              <StatusTile
                label="Deals, clients and everything else"
                value={data.sharedMode ? "Google Sheet" : "This browser only"}
                tone={data.sharedMode ? "good" : "amber"}
              />
              <StatusTile
                label="Changes not saved to Google Sheets"
                value={unsyncedCount === 0 ? "None" : `${unsyncedCount} ${unsyncedCount === 1 ? "change" : "changes"}`}
                tone={unsyncedCount ? "coral" : "good"}
              >
                {unsyncedCount > 0 && (
                  <button
                    type="button"
                    className="btn btn-ink btn-sm self-start"
                    disabled={data.syncState.busy}
                    onClick={() => void data.retrySync()}
                  >
                    <RefreshCw aria-hidden className="h-3.5 w-3.5" />
                    Retry
                  </button>
                )}
              </StatusTile>
              <StatusTile
                label="Demo data"
                value={data.hasDemoData ? "Demo rows are showing" : "None"}
                tone={data.hasDemoData ? "amber" : "good"}
              />
            </div>

            <p className="mt-3 px-1 text-[12px] text-ink-3">
              {features.sheets.configured
                ? sheetsVersion
                  ? `Google Sheets script version ${sheetsVersion}.`
                  : "Google Sheets is set up on the server but did not answer."
                : "Google Sheets is not set up on the server."}
              {lastSynced ? ` Last synced ${relativeTime(lastSynced, now)}.` : ""}
              {data.hasDemoData ? " Demo rows are examples and are never uploaded." : ""}
            </p>

            {data.syncState.error && data.syncState.message && (
              <div className="mt-4 rounded-inset bg-coral-soft p-4">
                <div className="flex items-start gap-3">
                  <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-coral text-white">
                    <RefreshCw className="h-4 w-4" />
                  </span>
                  <p className="min-w-0 pt-1.5 text-[13.5px] text-ink">{data.syncState.message}</p>
                </div>
                <button type="button" className="btn btn-ink btn-sm mt-4" disabled={data.syncState.busy} onClick={() => void data.retrySync()}>
                  Try again
                </button>
              </div>
            )}

            {(!features.sheets.configured || sheetsVersion === 1) && (
              <div className="mt-4 rounded-inset bg-amber-soft p-4">
                <div className="flex items-start gap-3">
                  <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber text-ink">
                    <Plug className="h-4 w-4" />
                  </span>
                  <p className="min-w-0 pt-1 text-[13.5px] text-ink">
                    {!features.sheets.configured
                      ? "Google Sheets is not connected, so everything you add is saved in this browser only."
                      : "The sheet runs script version 1, so only work logs are shared. The other records stay in each browser until the script is updated."}{" "}
                    {!canOpenIntegrations && (
                      <>
                        Ask the administrator, or{" "}
                        <a href={supportMailto({ subject: "Google Sheets setup" })} className="font-medium underline underline-offset-2">
                          email {COMPANY_EMAIL}
                        </a>
                        .
                      </>
                    )}
                  </p>
                </div>
                {canOpenIntegrations && (
                  <button type="button" className="btn btn-ghost btn-sm mt-4" onClick={() => navigate("integrations")}>
                    Open integrations
                    <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            <dl className="mt-5 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              {DATA_EXPLAINERS.map((d) => (
                <div key={d.title} className="border-t border-line py-3.5">
                  <dt className="text-[13.5px] font-medium">{d.title}</dt>
                  <dd className="mt-1 text-[13px] leading-relaxed text-ink-2">{d.body}</dd>
                </div>
              ))}
            </dl>
          </HelpCard>

          {/* Assistant */}
          <HelpCard
            id="assistant"
            icon={<PenLine />}
            className="min-[1360px]:col-span-5"
            action={
              agentRoleOf(category) ? (
                features.assistant.configured ? (
                  <span className="chip chip-good">
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-good" />
                    On
                  </span>
                ) : (
                  <span className="chip chip-amber">
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber" />
                    Not configured
                  </span>
                )
              ) : undefined
            }
          >
            <ul className="space-y-3.5">
              {ASSISTANT_POINTS.map((p) => (
                <li key={p.title} className="flex gap-3">
                  <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2">
                    {p.title === "What it never sees" ? <ShieldCheck className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium">{p.title}</div>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{p.body}</p>
                  </div>
                </li>
              ))}
            </ul>

            {!agentRoleOf(category) ? (
              <p className="mt-5 card-inset p-4 text-[13px] text-ink-2">
                The assistant is not part of the developer workspace. Ask a founder or the marketing team if you need a draft.
              </p>
            ) : (
              <>
                {agents.length > 0 ? (
                  <div className="mt-5">
                    <div className="text-[12px] text-ink-3">Available to you</div>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {agents.map((a) => (
                        <li key={a.key} className="chip">
                          {a.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-5 text-[13px] text-ink-3">Every assistant agent for your role is switched off in Settings.</p>
                )}
                {!features.assistant.configured && (
                  <div className="mt-4 rounded-inset bg-amber-soft p-4 text-[13px] text-ink">
                    The assistant needs an API key on the server.{" "}
                    {canOpenIntegrations ? (
                      <button type="button" className="font-medium underline underline-offset-2" onClick={() => navigate("integrations")}>
                        Open integrations
                      </button>
                    ) : (
                      "Ask the administrator."
                    )}
                  </div>
                )}
                {canOpenAssistant && features.assistant.configured && agents.length > 0 && (
                  <button type="button" className="btn btn-ghost btn-sm mt-4" onClick={() => navigate("assistant")}>
                    Open Assistant
                    <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                  </button>
                )}
              </>
            )}
          </HelpCard>

          {/* Keyboard shortcuts */}
          <HelpCard id="shortcuts" icon={<Keyboard />} className="min-[1360px]:col-span-7">
            <div className="-mx-2">
              <table className="table-clean">
                <caption className="sr-only">Keyboard shortcuts</caption>
                <thead>
                  <tr>
                    <th className="w-[42%]">Keys</th>
                    <th>Does</th>
                  </tr>
                </thead>
                <tbody>
                  {shortcuts.map((row) => (
                    <tr key={row.label}>
                      <td>
                        <Keys row={row} />
                      </td>
                      <td className="text-ink-2">{row.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 px-1 text-[12px] text-ink-3">{SHORTCUT_NOTE}</p>
          </HelpCard>

          {/* Contact: the one lime card */}
          <HelpCard id="contact" icon={<LifeBuoy />} tone="lime" className="min-[1360px]:col-span-5">
            <p className="text-[22px] font-medium leading-tight tracking-[-0.03em]">{CONTACT.email}</p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{CONTACT.body}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <a href={supportMailto({ subject: helpSubject })} className="btn btn-ink">
                <Mail aria-hidden className="h-4 w-4" />
                Email {COMPANY_EMAIL}
              </a>
              <a
                href={supportMailto({
                  subject: `Hub problem – ${viewer.name}`,
                  body: "What happened:\n\nSteps:\n\nPage: SOP & Guide\n",
                })}
                className="btn bg-white/50 text-ink hover:bg-white/70"
              >
                Report a problem
              </a>
            </div>
            <p className="mt-5 border-t border-line pt-4 text-[13px] text-ink-2">
              {isAdminCategory ? CONTACT.adminPasswordNote : CONTACT.passwordNote}
            </p>
          </HelpCard>
        </div>
      </div>
    </div>
  );
}
