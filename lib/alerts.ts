// Derived alerts for the notifications menu, Today and the Overview attention list.
// Pure: pass the IST day key in; nothing here reads the clock.
import type { FeatureFlags } from "@/lib/features";
import type { HubViewer } from "@/lib/hub/types";
import { PEOPLE } from "@/lib/people";
import type { HubData } from "@/lib/useHubData";
import { canAccessView, type Overlay, type ViewId } from "@/lib/views";

export type AlertTone = "positive" | "warning" | "negative" | "neutral" | "accent";

export type AlertKind =
  | "followup_overdue"
  | "followup_today"
  | "blocker"
  | "review"
  | "invoice_overdue"
  | "invoice_due"
  | "missing_log"
  | "meta_lead"
  | "deal_won"
  | "token_expiry";

export interface HubAlert {
  /** `${kind}:${recordId}` */
  id: string;
  tone: AlertTone;
  kind: AlertKind;
  /** A sentence: 'Follow-up with Apex Fintech is 3 days overdue'. */
  title: string;
  detail?: string;
  /** 'YYYY-MM-DD' the alert is about (due date, log date). */
  date?: string;
  view: ViewId;
  overlay?: Overlay;
}

// ---- day-key helpers (calendar dates, no time zone involved) ----

const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayKey(v: string | undefined | null): string | null {
  if (!v) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v.trim());
  return m ? m[1] : null;
}

function keyToMs(key: string): number {
  return Date.parse(`${key}T00:00:00Z`);
}

function addDays(key: string, n: number): string {
  return new Date(keyToMs(key) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from a to b (positive when b is later). */
function diffDays(a: string, b: string): number {
  return Math.round((keyToMs(b) - keyToMs(a)) / DAY_MS);
}

function weekday(key: string): number {
  return new Date(keyToMs(key)).getUTCDay();
}

/** '28 Nov', or 'Mon 24 Nov' with the weekday. */
function shortDate(key: string, withWeekday = false): string {
  const d = new Date(keyToMs(key));
  const base = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return withWeekday ? `${WEEKDAYS[d.getUTCDay()]} ${base}` : base;
}

function days(n: number): string {
  return n === 1 ? "1 day" : `${n} days`;
}

/** The previous working day (Mon–Sat). */
function previousWorkingDay(todayKey: string): string {
  let k = addDays(todayKey, -1);
  while (weekday(k) === 0) k = addDays(k, -1);
  return k;
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function sameText(a: string | undefined, b: string | undefined): boolean {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

const CLOSED_STAGES = new Set(["Closed Won", "Closed Lost"]);
const FOUNDER_NAMES = new Set(PEOPLE.filter((p) => p.category === "founder").map((p) => p.name));

function viewOr(category: HubViewer["category"], ...candidates: ViewId[]): ViewId {
  return candidates.find((v) => canAccessView(category, v)) ?? "today";
}

const TONE_RANK: Record<AlertTone, number> = { negative: 0, warning: 1, accent: 1, positive: 1, neutral: 1 };

/**
 * Alerts for this viewer from (scoped) data. Sorted negative first, then by date (oldest first).
 */
export function deriveAlerts(
  data: HubData,
  viewer: HubViewer,
  opts: { todayKey: string; features?: FeatureFlags }
): HubAlert[] {
  const { todayKey, features } = opts;
  const { category } = viewer;
  const isAdminWorkspace = category === "admin";
  const alerts: HubAlert[] = [];

  // ---- follow-ups (admin and marketing) ----
  if (canAccessView(category, "mkt_deals")) {
    for (const deal of data.deals ?? []) {
      if (CLOSED_STAGES.has(deal.leadStatus) || deal.followUpStatus === "Completed") continue;
      const due = dayKey(deal.nextFollowUpDate);
      if (!due) continue;
      const late = diffDays(due, todayKey);
      const company = deal.companyName || "this deal";
      const parts: string[] = [];
      const action = deal.followUpAction?.trim();
      if (action) parts.push(/[.?]$/.test(action) ? action : `${action}.`);
      if (isAdminWorkspace && deal.marketingPerson) parts.push(`Owned by ${deal.marketingPerson}.`);
      const detail = parts.length ? parts.join(" ") : undefined;
      if (late > 0) {
        alerts.push({
          id: `followup_overdue:${deal.id}`,
          kind: "followup_overdue",
          tone: "negative",
          title: `Follow-up with ${company} is ${days(late)} overdue`,
          detail,
          date: due,
          view: "mkt_deals",
          overlay: { kind: "deal", dealId: deal.id },
        });
      } else if (late === 0) {
        alerts.push({
          id: `followup_today:${deal.id}`,
          kind: "followup_today",
          tone: "warning",
          title: `Follow-up with ${company} is due today`,
          detail,
          date: due,
          view: "mkt_deals",
          overlay: { kind: "deal", dealId: deal.id },
        });
      }
    }
  }

  // ---- work logs: blockers and reviews ----
  const logView = viewOr(category, "eng_blockers", "eng_log");
  for (const log of data.workLogs ?? []) {
    const where = log.module || log.project || "a task";
    const logDay = dayKey(log.date);
    if (log.isBlocked === "Yes" && log.workStatus !== "Completed") {
      const age = logDay ? Math.max(0, diffDays(logDay, todayKey)) : 0;
      const who = log.developerName === viewer.name ? "Your" : `${log.developerName}'s`;
      alerts.push({
        id: `blocker:${log.id}`,
        kind: "blocker",
        tone: "negative",
        title:
          age === 0
            ? `${who} blocker on ${where} was raised today`
            : `${who} blocker on ${where} has been open ${days(age)}`,
        detail: log.blockerDetails || undefined,
        date: logDay ?? undefined,
        view: logView,
        overlay: { kind: "worklog", entry: log },
      });
    }
    if (log.reviewer && log.reviewer === viewer.name && log.workStatus !== "Completed") {
      alerts.push({
        id: `review:${log.id}`,
        kind: "review",
        tone: "accent",
        title: `${log.developerName} asked you to review ${where}`,
        detail: log.taskDescription || undefined,
        date: logDay ?? undefined,
        view: viewOr(category, "eng_log"),
        overlay: { kind: "worklog", entry: log },
      });
    }
  }

  // ---- missing work log (developers and founders) ----
  if (category === "developer" || category === "founder") {
    const prev = previousWorkingDay(todayKey);
    const logged = (data.workLogs ?? []).some(
      (l) => dayKey(l.date) === prev && (!l.developerName || l.developerName === viewer.name)
    );
    if (!logged) {
      alerts.push({
        id: `missing_log:${prev}`,
        kind: "missing_log",
        tone: "warning",
        title: `No work logged for ${shortDate(prev, true)}`,
        date: prev,
        view: "eng_log",
        overlay: { kind: "worklog", entry: null, prefill: { date: prev } },
      });
    }
  }

  // ---- invoices (admin) ----
  if (canAccessView(category, "billing")) {
    for (const inv of data.payments ?? []) {
      const pending = Number(inv.pendingAmount) || 0;
      if (pending <= 0.5 || inv.status === "Fully Paid") continue;
      const due = dayKey(inv.dueDate);
      if (!due) continue;
      const late = diffDays(due, todayKey);
      const label = inv.invoiceId ? `Invoice ${inv.invoiceId}` : "An invoice";
      const company = inv.companyName || "a client";
      const detail = `${inr.format(pending)} pending`;
      if (late > 0) {
        alerts.push({
          id: `invoice_overdue:${inv.id}`,
          kind: "invoice_overdue",
          tone: "negative",
          title: `${label} for ${company} is ${days(late)} overdue`,
          detail,
          date: due,
          view: "billing",
          overlay: { kind: "invoice", invoiceId: inv.id },
        });
      } else if (late >= -7) {
        alerts.push({
          id: `invoice_due:${inv.id}`,
          kind: "invoice_due",
          tone: "warning",
          title: late === 0 ? `${label} for ${company} is due today` : `${label} for ${company} is due ${shortDate(due)}`,
          detail,
          date: due,
          view: "billing",
          overlay: { kind: "invoice", invoiceId: inv.id },
        });
      }
    }
  }

  // ---- admin only: Meta leads, won deals, token expiry ----
  if (isAdminWorkspace) {
    for (const deal of data.deals ?? []) {
      if (deal.externalSource === "meta_lead_ads" && !deal.marketingPerson?.trim()) {
        const who = deal.companyName || deal.contactPerson || "a new contact";
        alerts.push({
          id: `meta_lead:${deal.id}`,
          kind: "meta_lead",
          tone: "accent",
          title: `New Meta lead from ${who} has no owner`,
          detail: deal.formId ? `From Lead Ad form ${deal.formId}.` : undefined,
          date: dayKey(deal.createdAt) ?? dayKey(deal.dateAdded) ?? undefined,
          view: "mkt_deals",
          overlay: { kind: "deal", dealId: deal.id },
        });
      }

      if (deal.leadStatus === "Closed Won") {
        const clients = data.clients ?? [];
        // A client created from this deal, or (for records made before sourceDealId existed) one with the same company.
        const hasClient = clients.some(
          (c) => c.sourceDealId === deal.id || (!c.sourceDealId && sameText(c.companyName, deal.companyName))
        );
        if (!hasClient) {
          const company = deal.companyName || "A deal";
          alerts.push({
            id: `deal_won:${deal.id}`,
            kind: "deal_won",
            tone: "positive",
            title: `${company} was won. Create the client record.`,
            date: dayKey(deal.conversionDate) ?? dayKey(deal.updatedAt) ?? undefined,
            view: "clients",
            overlay: {
              kind: "client",
              prefill: {
                companyName: deal.companyName,
                industry: deal.industry,
                salesOwner: FOUNDER_NAMES.has(deal.marketingPerson) ? deal.marketingPerson : "",
                dealValue: deal.estimatedDealValue,
                dealStatus: "Won",
                contractScope: deal.clientRequirements,
                contactPerson: deal.contactPerson,
                contactEmail: deal.emailAddress,
                contactPhone: deal.phoneNumber,
                sourceDealId: deal.id,
                signedDate: dayKey(deal.conversionDate) ?? todayKey,
              },
            },
          });
        }
      }
    }

    const expires = dayKey(features?.meta.tokenExpiresAt);
    if (expires) {
      const left = diffDays(todayKey, expires);
      if (left <= 10) {
        alerts.push({
          id: "token_expiry:meta",
          kind: "token_expiry",
          tone: left <= 3 ? "negative" : "warning",
          title:
            left < 0
              ? `The Meta access token expired on ${shortDate(expires)}`
              : left === 0
                ? "The Meta access token expires today"
                : `The Meta access token expires in ${days(left)}`,
          detail: "Create a new system-user token and update META_SYSTEM_USER_TOKEN.",
          date: expires,
          view: "integrations",
        });
      }
    }
  }

  return alerts
    .map((a, i) => ({ a, i }))
    .sort((x, y) => {
      const t = TONE_RANK[x.a.tone] - TONE_RANK[y.a.tone];
      if (t !== 0) return t;
      const dx = x.a.date ?? "9999-12-31";
      const dy = y.a.date ?? "9999-12-31";
      if (dx !== dy) return dx < dy ? -1 : 1;
      return x.i - y.i;
    })
    .map(({ a }) => a);
}
