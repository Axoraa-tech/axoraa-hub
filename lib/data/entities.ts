// Registry of every stored collection: local storage key, same-tab event, Google Sheets tab, id prefix,
// field kinds and owner field. Isomorphic; shared by the browser hook, the server and the backup format.

export type EntityKey =
  | "workLogs"
  | "deals"
  | "interactions"
  | "clients"
  | "projects"
  | "payments"
  | "roster"
  | "repositories"
  | "posts"
  | "campaigns"
  | "drafts"
  | "activity"
  | "settings";

/** Entities stored through the v2 protocol. Work logs keep the v1 'Daily Work Log' flow. */
export type RemoteEntity = Exclude<EntityKey, "workLogs">;

export type FieldKind = "string" | "number" | "boolean" | "json";

export interface EntityDef {
  key: EntityKey;
  storageKey: string;
  event: string;
  sheetTab: string;
  idPrefix: string;
  fields: Record<string, FieldKind>;
  ownerField?: string;
}

const AUDIT: Record<string, FieldKind> = { createdAt: "string", updatedAt: "string", createdBy: "string" };

const s = "string" as const;
const n = "number" as const;
const b = "boolean" as const;
const j = "json" as const;

export const ENTITIES: Record<EntityKey, EntityDef> = {
  workLogs: {
    key: "workLogs",
    storageKey: "axoraa_work_logs_v1",
    event: "axoraa_data_changed",
    sheetTab: "Daily Work Log",
    idPrefix: "log",
    fields: {
      id: s, date: s, developerName: s, project: s, repository: s, module: s, workType: s, taskDescription: s,
      githubPr: s, workStatus: s, priority: s, hours: n, isBlocked: s, blockerDetails: s, reviewRequired: s,
      reviewer: s, deployment: s, productionImpact: s, notes: s, lastUpdated: s, ...AUDIT,
    },
  },
  deals: {
    key: "deals",
    storageKey: "axoraa_marketing_deals_v1",
    event: "axoraa_deals_changed",
    sheetTab: "Deals",
    idPrefix: "deal",
    ownerField: "marketingPerson",
    fields: {
      id: s, leadId: s, dateAdded: s, marketingPerson: s, companyName: s, industry: s, contactPerson: s,
      designation: s, phoneNumber: s, emailAddress: s, officeAddress: s, city: s, stateRegion: s,
      googleMapsLink: s, leadSource: s, initialVisitDate: s, lastInteractionDate: s, visitType: s,
      isDecisionMaker: b, decisionMakerDetails: s, clientRequirements: s, solutionsPitched: s,
      budgetSpecified: n, estimatedDealValue: n, weightedValue: n, demoRequired: s, proposalSent: b,
      proposalValue: n, leadStatus: s, nextFollowUpDate: s, followUpAction: s, followUpPriority: s,
      followUpStatus: s, daysSinceLastVisit: n, dueStatus: s, conversionDate: s, notesNextSteps: s,
      campaignId: s, externalSource: s, externalId: s, formId: s, adId: s, assignedAt: s, quoteNumber: s,
      quote: j, ...AUDIT,
    },
  },
  interactions: {
    key: "interactions",
    storageKey: "axoraa_marketing_interactions_v1",
    event: "axoraa_interactions_changed",
    sheetTab: "Visits",
    idPrefix: "visit",
    ownerField: "marketingPerson",
    fields: {
      id: s, date: s, marketingPerson: s, companyName: s, leadId: s, dealId: s, googleMapsLink: s, leadSource: s,
      interactionType: s, meetingMode: s, personsMet: s, designation: s, phoneNumber: s, email: s, agenda: s,
      discussionFeedback: s, demoRequired: s, interestLevel: s, probabilityPct: n, interactionOutcome: s,
      actionItemsAgreed: s, nextSteps: s, nextFollowUpDate: s, followUpPriority: s, loggedBy: s, ...AUDIT,
    },
  },
  clients: {
    key: "clients",
    storageKey: "axoraa_client_master_v1",
    event: "axoraa_clients_changed",
    sheetTab: "Clients",
    idPrefix: "client",
    ownerField: "salesOwner",
    fields: {
      id: s, clientId: s, projectId: s, companyName: s, industry: s, salesOwner: s, dealValue: n, dealStatus: s,
      contractScope: s, signedDate: s, deliveryStatus: s, contactPerson: s, contactEmail: s, contactPhone: s,
      gstin: s, billingAddress: s, state: s, sourceDealId: s, ...AUDIT,
    },
  },
  projects: {
    key: "projects",
    storageKey: "axoraa_project_progress_v1",
    event: "axoraa_projects_changed",
    sheetTab: "Projects",
    idPrefix: "project",
    ownerField: "projectManager",
    fields: {
      id: s, projectId: s, clientId: s, projectName: s, projectManager: s, status: s, completionPercentage: n,
      blockerDetails: s, blockerOwner: s, targetReleaseDate: s, ...AUDIT,
    },
  },
  payments: {
    key: "payments",
    storageKey: "axoraa_payments_v1",
    event: "axoraa_payments_changed",
    sheetTab: "Invoices",
    idPrefix: "inv",
    fields: {
      id: s, invoiceId: s, clientId: s, projectId: s, projectName: s, companyName: s, invoicedAmount: n,
      receivedAmount: n, pendingAmount: n, overdueAmount: n, status: s, issueDate: s, dueDate: s,
      milestoneDescription: s, gstRate: n, taxableAmount: n, placeOfSupply: s, sac: s, payments: j, notes: s,
      ...AUDIT,
    },
  },
  roster: {
    key: "roster",
    storageKey: "axoraa_dev_roster_v1",
    event: "axoraa_roster_changed",
    sheetTab: "Roster",
    idPrefix: "dev",
    fields: {
      id: s, developerName: s, role: s, primaryArea: s, active: s, joiningDate: s, notes: s, avatar: s, ...AUDIT,
    },
  },
  repositories: {
    key: "repositories",
    storageKey: "axoraa_repos_v1",
    event: "axoraa_repos_changed",
    sheetTab: "Repositories",
    idPrefix: "repo",
    fields: { id: s, projectName: s, repository: s, type: s, status: s, description: s, ...AUDIT },
  },
  posts: {
    key: "posts",
    storageKey: "axoraa_content_posts_v1",
    event: "axoraa_posts_changed",
    sheetTab: "Content",
    idPrefix: "post",
    fields: {
      id: s, channel: s, status: s, title: s, caption: s, hashtags: j, assetUrl: s, imageBrief: s, scheduledAt: s,
      ownerName: s, campaignId: s, draftId: s, externalId: s, permalink: s, publishedAt: s, metrics: j, ...AUDIT,
    },
  },
  campaigns: {
    key: "campaigns",
    storageKey: "axoraa_campaigns_v1",
    event: "axoraa_campaigns_changed",
    sheetTab: "Campaigns",
    idPrefix: "cmp",
    fields: {
      id: s, name: s, platform: s, objective: s, status: s, startDate: s, endDate: s, dailyBudget: n,
      totalBudget: n, spend: n, leads: n, ownerName: s, audience: s, notes: s, source: s,
      externalCampaignId: s, adAccountId: s, plan: j, draftId: s, ...AUDIT,
    },
  },
  drafts: {
    key: "drafts",
    storageKey: "axoraa_agent_drafts_v1",
    event: "axoraa_drafts_changed",
    sheetTab: "Drafts",
    idPrefix: "draft",
    ownerField: "createdBy",
    fields: {
      id: s, agentKey: s, title: s, status: s, input: j, output: j, language: s, versions: j, ref: j, model: s,
      usage: j, createdByName: s, ...AUDIT,
    },
  },
  activity: {
    key: "activity",
    storageKey: "axoraa_activity_v1",
    event: "axoraa_activity_changed",
    sheetTab: "Activity",
    idPrefix: "act",
    ownerField: "actorId",
    fields: { id: s, at: s, actorId: s, actorName: s, action: s, entity: s, entityId: s, summary: s },
  },
  settings: {
    key: "settings",
    storageKey: "axoraa_settings_v1",
    event: "axoraa_settings_changed",
    sheetTab: "Settings",
    idPrefix: "settings",
    fields: {
      id: s, company: j, stageProbabilities: j, leadSources: j, projects: j, workTypes: j, weeklyHoursTarget: n,
      followUpDefaultDays: n, disabledAgents: j, metaLeadAssignment: j, assistantPricing: j, updatedAt: s,
      updatedBy: s,
    },
  },
};

export const ENTITY_KEYS = Object.keys(ENTITIES) as EntityKey[];
export const REMOTE_ENTITIES = ENTITY_KEYS.filter((k): k is RemoteEntity => k !== "workLogs");

export function isEntityKey(v: unknown): v is EntityKey {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(ENTITIES, v);
}
export function isRemoteEntity(v: unknown): v is RemoteEntity {
  return isEntityKey(v) && v !== "workLogs";
}

/** Entity whose sheet tab has this name, or null. */
export function entityForTab(tab: string): RemoteEntity | null {
  return REMOTE_ENTITIES.find((k) => ENTITIES[k].sheetTab === tab) ?? null;
}

/** Largest cell Google Sheets accepts is 50,000 characters; stay under it. */
export const MAX_CELL_CHARS = 45_000;

export class EncodeTooLargeError extends Error {
  readonly field: string;
  constructor(entity: EntityKey, field: string, length: number) {
    super(`${ENTITIES[entity].sheetTab} field ${field} is ${length} characters, over the ${MAX_CELL_CHARS} limit`);
    this.name = "EncodeTooLargeError";
    this.field = field;
  }
}

// Same rule as csvSafe in lib/format.ts; decodeRow strips the apostrophe again.
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Sheet row for a record: every declared field (undefined becomes ''), JSON fields stringified,
 * strings protected from formula evaluation. `demo` and undeclared keys are never encoded.
 */
export function encodeRow(entity: EntityKey, record: object): Record<string, string | number | boolean> {
  const def = ENTITIES[entity];
  const src = record as Record<string, unknown>;
  const out: Record<string, string | number | boolean> = {};
  for (const [field, kind] of Object.entries(def.fields)) {
    const v = src[field];
    let cell: string | number | boolean;
    if (v === undefined || v === null) cell = "";
    else if (kind === "json") cell = JSON.stringify(v);
    else if (kind === "number") cell = typeof v === "number" ? (Number.isFinite(v) ? v : "") : Number.isFinite(Number(v)) && String(v).trim() !== "" ? Number(v) : "";
    else if (kind === "boolean") cell = v === true || v === "true" || v === "TRUE" || v === "Yes";
    else {
      const str = typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v);
      cell = FORMULA_START.test(str) ? `'${str}` : str;
    }
    if (typeof cell === "string" && cell.length > MAX_CELL_CHARS) throw new EncodeTooLargeError(entity, field, cell.length);
    out[field] = cell;
  }
  return out;
}

/**
 * Record for a sheet row: coerces by FieldKind, strips one leading apostrophe from strings and
 * tolerates missing columns. Blank number, boolean and JSON cells are left out.
 */
export function decodeRow<T = Record<string, unknown>>(entity: EntityKey, row: Record<string, unknown>): T {
  const def = ENTITIES[entity];
  const out: Record<string, unknown> = {};
  for (const [field, kind] of Object.entries(def.fields)) {
    if (!Object.prototype.hasOwnProperty.call(row, field)) continue;
    const v = row[field];
    if (v === undefined || v === null) continue;
    if (kind === "string") {
      const str = typeof v === "string" ? v : String(v);
      out[field] = str.startsWith("'") ? str.slice(1) : str;
      continue;
    }
    if (typeof v === "string" && v.trim() === "") continue;
    if (kind === "number") {
      const num = typeof v === "number" ? v : Number(String(v).replace(/^'/, "").replace(/,/g, ""));
      if (Number.isFinite(num)) out[field] = num;
    } else if (kind === "boolean") {
      out[field] = v === true || v === 1 || /^(true|yes|1)$/i.test(String(v).trim());
    } else {
      if (typeof v !== "string") {
        out[field] = v;
        continue;
      }
      try {
        out[field] = JSON.parse(v.startsWith("'") ? v.slice(1) : v);
      } catch {
        // Unreadable JSON is left out rather than passed on as text.
      }
    }
  }
  return out as T;
}
