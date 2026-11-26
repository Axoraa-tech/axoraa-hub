// Client-side permission checks for buttons and overlays. The server enforces the same rules
// through lib/data/policy.ts; this only decides what the UI offers. Pure, no directive.
import { agentRoleOf, AGENT_BY_KEY } from "@/lib/agents/catalog";
import type { AgentKey } from "@/lib/agents/types";
import type { FeatureFlags } from "@/lib/features";
import type { HubViewer } from "@/lib/hub/types";
import type { HubData } from "@/lib/useHubData";

export type HubAction =
  | "worklog.edit"
  | "worklog.delete"
  | "deal.edit"
  | "deal.delete"
  | "deal.assign"
  | "visit.edit"
  | "visit.delete"
  | "client.edit"
  | "client.delete"
  | "project.edit"
  | "project.delete"
  | "invoice.edit"
  | "roster.edit"
  | "settings.edit"
  | "agent.run"
  | "content.edit"
  | "campaign.edit"
  | "meta.publish"
  | "data.reset"
  | "data.import"
  | "data.export"
  | "data.upload";

export interface CanContext {
  data?: HubData;
  features?: FeatureFlags;
  /**
   * The existing record. Without one, the edit actions mean "may create".
   * Typed as object (not Record<string, unknown>) so interface types such as MarketingDeal can be passed.
   */
  record?: object;
  agentKey?: AgentKey;
}

function field(record: object | undefined, key: string): unknown {
  return record ? (record as Record<string, unknown>)[key] : undefined;
}

function agentAllowed(viewer: HubViewer, ctx: CanContext | undefined): boolean {
  const role = agentRoleOf(viewer.category);
  if (!role && !viewer.privileged) return false;
  const key = ctx?.agentKey;
  if (!key) return true;
  const entry = AGENT_BY_KEY[key];
  if (!entry) return false;
  // Switched off in Settings means off for everyone, the administrator included (the server refuses it too).
  if (ctx?.data?.settings?.disabledAgents?.includes(key)) return false;
  if (viewer.privileged) return true;
  return !!role && entry.roles.includes(role);
}

export function can(viewer: HubViewer, action: HubAction, ctx?: CanContext): boolean {
  const { category, name } = viewer;
  const record = ctx?.record;

  if (viewer.privileged) {
    switch (action) {
      case "meta.publish":
        return !!ctx?.features?.meta.publishEnabled;
      case "data.reset":
        return !!ctx?.data && !ctx.data.sharedMode;
      case "agent.run":
        return agentAllowed(viewer, ctx);
      default:
        return true;
    }
  }

  switch (action) {
    case "worklog.edit":
    case "worklog.delete": {
      if (category === "marketing") return false;
      if (!record) return true;
      const owner = field(record, "developerName");
      return ctx?.data?.source === "local" && (owner === undefined || owner === name);
    }

    case "deal.edit":
    case "deal.delete":
    case "visit.edit":
    case "visit.delete":
      if (category !== "marketing") return false;
      return !record || field(record, "marketingPerson") === name;

    case "client.edit":
      if (category !== "founder") return false;
      return !record || field(record, "salesOwner") === name;

    case "project.edit":
      if (category !== "founder") return false;
      return !record || field(record, "projectManager") === name;

    case "agent.run":
      return agentAllowed(viewer, ctx);

    case "content.edit":
    case "campaign.edit":
      return category === "marketing";

    case "meta.publish":
      return category === "marketing" && !!ctx?.features?.meta.publishEnabled;

    case "data.upload":
      return true;

    case "deal.assign":
    case "client.delete":
    case "project.delete":
    case "invoice.edit":
    case "roster.edit":
    case "settings.edit":
    case "data.reset":
    case "data.import":
    case "data.export":
      return false;
  }
}
