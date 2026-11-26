// The assistant's agents, named by what they do. Isomorphic.
// Adding an agent: one AGENT_CATALOG entry here, one AGENT_DEFS entry on the server, and one prompt block.
import type { ViewerCategory } from "@/lib/hub/types";
import type { AgentKey, AgentRefType, AgentRole } from "./types";

export interface AgentCatalogEntry {
  key: AgentKey;
  name: string;
  description: string;
  roles: AgentRole[];
  /** The record type the agent runs over, when it runs over one. */
  refType?: AgentRefType;
  /** Every record type the agent accepts (visit_notes takes a deal or a visit). Empty when none. */
  refTypes: AgentRefType[];
  refRequired: boolean;
  usesWebSearch: boolean;
  supportsLanguage: boolean;
}

export const AGENT_CATALOG: readonly AgentCatalogEntry[] = [
  {
    key: "follow_up",
    name: "Draft follow-up",
    description: "Email, WhatsApp message and call points for the next step on a deal.",
    roles: ["admin", "marketing"],
    refType: "deal",
    refTypes: ["deal"],
    refRequired: true,
    usesWebSearch: false,
    supportsLanguage: true,
  },
  {
    key: "visit_notes",
    name: "Structure visit notes",
    description: "Turns rough visit notes into a visit record, a deal update and a recap email.",
    roles: ["admin", "marketing"],
    refType: "deal",
    refTypes: ["deal", "visit"],
    refRequired: false,
    usesWebSearch: false,
    supportsLanguage: false,
  },
  {
    key: "prospect_brief",
    name: "Research a prospect",
    description: "Searches the web and writes a one-page brief on a company before you meet them.",
    roles: ["admin", "founder", "marketing"],
    refTypes: [],
    refRequired: false,
    usesWebSearch: true,
    supportsLanguage: false,
  },
  {
    key: "proposal_outline",
    name: "Outline a proposal",
    description: "Scope, milestones and a price range from a deal's requirements.",
    roles: ["admin", "marketing"],
    refType: "deal",
    refTypes: ["deal"],
    refRequired: true,
    usesWebSearch: false,
    supportsLanguage: false,
  },
  {
    key: "social_posts",
    name: "Plan social posts",
    description: "A dated set of posts for Facebook, Instagram and LinkedIn.",
    roles: ["admin", "marketing"],
    refTypes: [],
    refRequired: false,
    usesWebSearch: false,
    supportsLanguage: true,
  },
  {
    key: "meta_campaign",
    name: "Plan a Meta ad campaign",
    description: "Audience, budget split, ad text and lead form questions for a Meta campaign.",
    roles: ["admin", "marketing"],
    refType: "campaign",
    refTypes: ["campaign"],
    refRequired: false,
    usesWebSearch: false,
    supportsLanguage: false,
  },
  {
    key: "pipeline_review",
    name: "Review stale deals",
    description: "Lists deals that have gone quiet and the next step for each.",
    roles: ["admin", "marketing"],
    refTypes: [],
    refRequired: false,
    usesWebSearch: false,
    supportsLanguage: false,
  },
  {
    key: "payment_reminder",
    name: "Draft payment reminder",
    description: "A reminder email and WhatsApp message for an unpaid invoice.",
    roles: ["admin"],
    refType: "invoice",
    refTypes: ["invoice"],
    refRequired: true,
    usesWebSearch: false,
    supportsLanguage: true,
  },
];

export const AGENT_KEYS: readonly AgentKey[] = AGENT_CATALOG.map((a) => a.key);

export const AGENT_BY_KEY = Object.fromEntries(AGENT_CATALOG.map((a) => [a.key, a])) as Record<
  AgentKey,
  AgentCatalogEntry
>;

export function isAgentKey(v: unknown): v is AgentKey {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(AGENT_BY_KEY, v);
}

/** The catalog entry for a key, or undefined for an unknown key. */
export function agentEntry(key: string): AgentCatalogEntry | undefined {
  return isAgentKey(key) ? AGENT_BY_KEY[key] : undefined;
}

/** Agents this role may run, minus the ones switched off in Settings. A null role (developers) gets none. */
export function agentsFor(
  role: AgentRole | null,
  disabled: readonly AgentKey[] = []
): AgentCatalogEntry[] {
  if (!role) return [];
  return AGENT_CATALOG.filter((a) => a.roles.includes(role) && !disabled.includes(a.key));
}

/** Developers have no assistant. */
export function agentRoleOf(category: ViewerCategory): AgentRole | null {
  switch (category) {
    case "admin":
      return "admin";
    case "founder":
      return "founder";
    case "marketing":
      return "marketing";
    default:
      return null;
  }
}
