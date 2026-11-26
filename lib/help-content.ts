// Copy for the SOP & Guide view (components/views/HelpView.tsx) and docs/USER_GUIDE.md.
// Isomorphic: plain typed data, no directive and no browser globals. Keep the Markdown guide in step
// when this file changes.
import { COMPANY_EMAIL } from "@/lib/company";
import { INITIAL_SOP_GUIDE } from "@/lib/mockData";
import type { ViewerCategory } from "@/lib/hub/types";
import type { EscalationLevel, GoldenRule } from "@/lib/types";

export type HelpSectionId =
  | "your-day"
  | "daily-routine"
  | "escalation"
  | "golden-rules"
  | "client-email"
  | "data"
  | "assistant"
  | "shortcuts"
  | "contact";

export interface HelpSection {
  id: HelpSectionId;
  /** Sub-nav label and card title. */
  title: string;
  /** One line under the card title. */
  summary: string;
}

export const HELP_SECTIONS: readonly HelpSection[] = [
  { id: "your-day", title: "Your day", summary: "What the hub expects from you each day." },
  { id: "daily-routine", title: "Daily routine", summary: "The engineering team's steps, in order." },
  { id: "escalation", title: "Escalation", summary: "How fast to raise a blocker, and to whom." },
  { id: "golden-rules", title: "Golden rules", summary: "What to do, and what to avoid." },
  { id: "client-email", title: "Client email rules", summary: "Every client email goes out the same way." },
  { id: "data", title: "Where your data lives", summary: "This browser, the Google Sheet, and what is shared." },
  { id: "assistant", title: "Assistant", summary: "What it drafts and what it never sees." },
  { id: "shortcuts", title: "Keyboard shortcuts", summary: "Move around without the mouse." },
  { id: "contact", title: "Contact", summary: "Questions, access and anything broken." },
];

export interface HelpPoint {
  title: string;
  body: string;
}

export interface RoleDay {
  /** 'a developer', 'the administrator' */
  roleLabel: string;
  items: HelpPoint[];
}

export const YOUR_DAY: Record<ViewerCategory, RoleDay> = {
  developer: {
    roleLabel: "a developer",
    items: [
      {
        title: "Log your work by 7 pm",
        body: "Open My work log and add what you did today with hours, project and PR link. It takes about two minutes.",
      },
      {
        title: "Flag blockers within the hour",
        body: "Stuck for more than an hour? Set the entry to Blocked so the tech lead can unblock you the same day.",
      },
      {
        title: "Clear reviews waiting on you",
        body: "My dashboard lists the logs where you are named as reviewer.",
      },
    ],
  },
  marketing: {
    roleLabel: "marketing",
    items: [
      {
        title: "Log visits the same day",
        body: "Add every visit and call in My visits before you finish for the day, linked to its deal.",
      },
      {
        title: "Keep every follow-up dated",
        body: "Each open lead needs a next follow-up date and action. Overdue ones show first on My dashboard.",
      },
      {
        title: "Move deals when they change",
        body: "Update the stage after a meeting, demo or proposal so the pipeline stays true.",
      },
    ],
  },
  founder: {
    roleLabel: "a founder",
    items: [
      {
        title: "Review blockers",
        body: "Open blockers show on My dashboard. Anything older than 24 hours needs a decision from you.",
      },
      {
        title: "Look after your clients",
        body: "My clients shows delivery status and what each client still owes.",
      },
      {
        title: "Log your own work",
        body: "Your hours count towards the team dashboard, so log them by 7 pm like everyone else.",
      },
    ],
  },
  admin: {
    roleLabel: "the administrator",
    items: [
      {
        title: "Start with Needs attention",
        body: "The Command Center lists overdue follow-ups, blockers, reviews, invoices due and missing work logs.",
      },
      {
        title: "Check the sync line",
        body: "The sidebar shows where data is saved and how many changes have not reached Google Sheets yet.",
      },
      {
        title: "Assign new leads",
        body: "Meta leads without an owner wait in the Deal tracker until you assign them.",
      },
    ],
  },
};

/** INITIAL_SOP_GUIDE.dailySteps without the 'Step n:' prefix (the list numbers them). */
export const DAILY_ROUTINE: readonly string[] = INITIAL_SOP_GUIDE.dailySteps.map((s) => s.replace(/^\s*Step\s*\d+\s*:\s*/i, ""));

export const ESCALATION_LEVELS: readonly EscalationLevel[] = INITIAL_SOP_GUIDE.escalationLevels;

/** The P1 rule shown under the escalation table. */
export const P1_RULE = `P1: email ${COMPANY_EMAIL} and call the tech lead.`;

/** 'P1 - Critical Blocker' → 'P1'. */
export function escalationCode(level: string): string {
  const m = /^\s*(P\d)/i.exec(level);
  return m ? m[1].toUpperCase() : level;
}

/** 'P1 - Critical Blocker' → 'Critical blocker'. */
export function escalationName(level: string): string {
  const rest = level.replace(/^\s*P\d\s*[-–]\s*/i, "").trim();
  return rest ? rest.charAt(0) + rest.slice(1).toLowerCase() : level;
}

export const GOLDEN_RULES: readonly GoldenRule[] = INITIAL_SOP_GUIDE.goldenRules;

export const CLIENT_EMAIL_RULES: readonly HelpPoint[] = [
  {
    title: `Always cc ${COMPANY_EMAIL}`,
    body: "The shared inbox keeps a copy of every client thread, so anyone can pick it up.",
  },
  {
    title: "Use the deal's Email action",
    body: "It fills in the client's address, the cc and your signature for you.",
  },
  {
    title: "Choose your email app in the user menu",
    body: "Default mail app, Gmail or Outlook. The hub opens a draft; you press send.",
  },
  {
    title: "Read and edit assistant drafts before sending",
    body: "A draft can get a name, date or amount wrong. Nothing goes out without you.",
  },
];

export const DATA_EXPLAINERS: readonly HelpPoint[] = [
  {
    title: "This browser",
    body: "Records are saved in this browser only. Your phone or another laptop will not see them, and clearing browser data removes them. Export center makes a full backup.",
  },
  {
    title: "Google Sheet",
    body: "Records are saved to the team's Google Sheet through the hub's server, and everyone sees the same data. The sheet's address and key never reach your browser.",
  },
  {
    title: "Script version 1",
    body: "Only work logs are shared. Deals, visits, clients, invoices, content, campaigns, drafts and settings stay in each person's browser.",
  },
  {
    title: "Script version 2",
    body: "Everything is shared. Each person uploads the records saved only in their browser once, from My dashboard. Demo rows are never uploaded.",
  },
];

export const ASSISTANT_POINTS: readonly HelpPoint[] = [
  {
    title: "What it does",
    body: "Drafts follow-ups, visit notes, prospect briefs, proposal outlines, social posts, Meta campaign plans, pipeline reviews and payment reminders, in English, Kannada or Hindi where it applies.",
  },
  {
    title: "Drafts only",
    body: "Every result is saved as a draft under Assistant, History. Nothing is emailed, posted or written to a deal until you click.",
  },
  {
    title: "What it never sees",
    body: "Phone numbers and email addresses are removed before anything is sent to the model, along with office addresses and map links. The hub fills them back in on your screen.",
  },
];

export interface ShortcutRow {
  /** Each inner array is one chord step; a step with several keys is pressed together. */
  keys: string[][];
  label: string;
}

export const GLOBAL_SHORTCUTS: readonly ShortcutRow[] = [
  { keys: [["Ctrl", "K"]], label: "Open the command bar (⌘ K on a Mac)" },
  { keys: [["/"]], label: "Search this page" },
  { keys: [["N"]], label: "Add a new item on this page" },
  { keys: [["?"]], label: "Show every shortcut" },
  { keys: [["Esc"]], label: "Close a panel, menu or dialog" },
];

/** Notes under the shortcut table. */
export const SHORTCUT_NOTE = "Shortcuts pause while you are typing in a field or a dialog is open.";

export const CONTACT = {
  email: COMPANY_EMAIL,
  body: "Questions about the hub, access, or something that looks wrong.",
  passwordNote: "Ask the administrator for password resets.",
  adminPasswordNote: "Passwords are set in the server environment (AUTH_HASH_<USERNAME>). The README explains how.",
} as const;
