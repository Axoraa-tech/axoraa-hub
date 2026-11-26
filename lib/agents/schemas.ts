// Input and output schemas for the assistant's agents. Isomorphic: the route validates requests with
// these, the Assistant form reuses them for field messages, and the server hands the output schemas to
// Claude as structured-output formats (helpers/zod works on 'zod/v4').
//
// Output schemas describe what the model writes. They keep every field required and avoid numeric or
// length limits, which structured outputs do not enforce; registry.toOutput turns them into the exact
// AgentOutput variants (dropping blanks, clamping numbers).
import * as z from "zod/v4";
import { REVISE_INSTRUCTION_MAX, type AgentKey } from "./types";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} can be at most ${max} characters.`)
    .optional()
    .transform((v) => (v ? v : undefined));

export const CHANNEL_IDS = ["facebook_page", "instagram", "linkedin"] as const;
export const AGENT_LANGUAGES = ["en", "kn", "hi"] as const;
export const AGENT_REF_TYPES = ["deal", "visit", "invoice", "campaign", "client"] as const;

/* ------------------------------------------------------------------ inputs */

export const followUpInput = z.object({
  channel: z.enum(["email", "whatsapp", "call", "all"]).default("all"),
  tone: z.enum(["warm", "formal"]).default("warm"),
  notes: optionalText(1000, "Notes"),
});

export const visitNotesInput = z.object({
  notes: z
    .string()
    .trim()
    .min(20, "Write at least a couple of lines about the visit (20 characters or more).")
    .max(6000, "Visit notes can be at most 6,000 characters."),
});

export const prospectBriefInput = z.object({
  company: z.string().trim().min(2, "Enter the company name.").max(200, "The company name is too long."),
  city: optionalText(100, "City"),
  website: optionalText(300, "Website"),
  focus: optionalText(1000, "What to look for"),
});

export const proposalOutlineInput = z.object({
  budgetNote: optionalText(500, "Budget note"),
  timelineWeeks: z
    .number()
    .int("Use whole weeks.")
    .min(1, "The timeline needs at least 1 week.")
    .max(104, "Keep the timeline under 2 years.")
    .optional(),
});

export const socialPostsInput = z.object({
  goal: z.string().trim().min(3, "Say what the posts should achieve.").max(500, "The goal can be at most 500 characters."),
  channels: z
    .array(z.enum(CHANNEL_IDS))
    .min(1, "Pick at least one channel.")
    .max(3, "Pick up to three channels."),
  startDate: z.string().regex(DAY, "Pick a start date."),
  weeks: z.number().int().min(1, "Plan at least 1 week.").max(4, "Plan up to 4 weeks at a time."),
  postsPerWeek: z.number().int().min(1, "At least 1 post a week.").max(5, "Up to 5 posts a week."),
  topics: optionalText(1000, "Topics"),
});

export const metaCampaignInput = z.object({
  service: z.string().trim().min(2, "Pick the service to promote.").max(200, "The service name is too long."),
  objective: z.enum(["leads", "traffic", "awareness"]).default("leads"),
  locations: z
    .array(z.string().trim().min(1).max(80, "A location can be at most 80 characters."))
    .min(1, "Add at least one location.")
    .max(10, "Add up to 10 locations.")
    .default(["Bengaluru"]),
  dailyBudgetInr: z
    .number({ error: "Enter a daily budget." })
    .min(200, "The daily budget must be at least ₹200.")
    .max(100000, "The daily budget can be at most ₹1,00,000."),
  durationDays: z.number().int("Use whole days.").min(3, "Run the campaign for at least 3 days.").max(90, "Plan up to 90 days at a time."),
  audienceNotes: optionalText(1000, "Audience notes"),
});

export const pipelineReviewInput = z.object({
  repName: optionalText(80, "Rep name"),
});

export const paymentReminderInput = z.object({
  tone: z.enum(["gentle", "firm"]).default("gentle"),
});

export const INPUT_SCHEMAS = {
  follow_up: followUpInput,
  visit_notes: visitNotesInput,
  prospect_brief: prospectBriefInput,
  proposal_outline: proposalOutlineInput,
  social_posts: socialPostsInput,
  meta_campaign: metaCampaignInput,
  pipeline_review: pipelineReviewInput,
  payment_reminder: paymentReminderInput,
} satisfies Record<AgentKey, z.ZodType>;

export type AgentInputOf<K extends AgentKey> = z.output<(typeof INPUT_SCHEMAS)[K]>;

/* ------------------------------------------------------------------ request envelope */

export const REQUEST_MAX_BYTES = 200 * 1024;

export const agentRefSchema = z.object({
  type: z.enum(AGENT_REF_TYPES),
  id: z.string().trim().min(1).max(200),
});

const looseRecord = z.record(z.string(), z.unknown());

export const agentRunRequestSchema = z.object({
  input: looseRecord.default({}),
  ref: agentRefSchema.optional(),
  language: z.enum(AGENT_LANGUAGES).default("en"),
  revise: z
    .object({
      previous: z.object({ kind: z.string() }).catchall(z.unknown()),
      instruction: z
        .string()
        .trim()
        .min(2, "Say what to change.")
        .max(REVISE_INSTRUCTION_MAX, `Keep the instruction under ${REVISE_INSTRUCTION_MAX} characters.`),
    })
    .optional(),
  context: z
    .object({
      deal: looseRecord.optional(),
      visits: z.array(looseRecord).max(20).optional(),
      deals: z.array(looseRecord).max(400).optional(),
      invoice: looseRecord.optional(),
      client: looseRecord.optional(),
      campaign: looseRecord.optional(),
    })
    .optional(),
  company: looseRecord.optional(),
});

/** Field messages for a 400 bad_input answer and for the form's error summary. */
export function issueMessages(error: z.ZodError): { field: string; message: string }[] {
  return error.issues.map((i) => ({ field: i.path.map(String).join(".") || "input", message: i.message }));
}

/* ------------------------------------------------------------------ outputs (what the model writes) */

const emailOut = z.object({
  subject: z.string().describe("Email subject line. Empty when no email was asked for."),
  body: z.string().describe("Plain-text email body ending with the signature block exactly as given. Empty when no email was asked for."),
});

export const messageOutput = z.object({
  email: emailOut,
  whatsapp: z.string().describe("WhatsApp message text, short. Empty when not asked for."),
  callPoints: z.array(z.string()).describe("Talking points for a phone call. Empty when not asked for."),
});

export const visitNotesOutput = z.object({
  fields: z.object({
    date: z.string().describe("Visit date as YYYY-MM-DD; today when not stated."),
    interactionType: z.enum(["Intro Meeting", "Product Demo", "Follow-up", "Commercial Negotiation", "Technical Scoping", "Check-in"]),
    meetingMode: z.enum(["Physical (On-site)", "Virtual (Video)", "Phone Call"]),
    personsMet: z.string(),
    designation: z.string(),
    agenda: z.string(),
    discussionFeedback: z.string(),
    demoRequired: z.enum(["Yes", "No", "Completed"]),
    interestLevel: z.enum(["Hot", "Warm", "Cold"]),
    probabilityPct: z.number().describe("0 to 100."),
    interactionOutcome: z.enum([
      "Positive - Advancing",
      "Needs Demo",
      "Proposal Requested",
      "Follow-up Required",
      "Cold / Unresponsive",
      "Closed - Lost",
    ]),
    actionItemsAgreed: z.string(),
    nextSteps: z.string(),
    nextFollowUpDate: z.string().describe("YYYY-MM-DD, or empty when none was agreed."),
    followUpPriority: z.enum(["High", "Medium", "Low"]),
  }),
  dealPatch: z.object({
    leadStatus: z
      .enum(["No change", "New Lead", "Contacted", "Meeting Scheduled", "Demo Completed", "Proposal Sent", "Negotiation", "Closed Won", "Closed Lost", "On Hold"])
      .describe("The deal stage after this visit, or 'No change'."),
    nextFollowUpDate: z.string().describe("YYYY-MM-DD or empty."),
    followUpAction: z.string(),
    followUpPriority: z.enum(["High", "Medium", "Low"]),
    notesNextSteps: z.string(),
  }),
  recapEmail: emailOut,
});

export const proposalOutput = z.object({
  summary: z.string(),
  scope: z.array(z.string()),
  outOfScope: z.array(z.string()),
  milestones: z.array(
    z.object({
      name: z.string(),
      deliverables: z.array(z.string()),
      weeks: z.number().describe("Duration in weeks."),
      percent: z.number().describe("Share of the price billed at this milestone; all milestones add up to 100."),
    })
  ),
  assumptions: z.array(z.string()),
  priceBand: z.object({
    lowInr: z.number().describe("Low end in rupees, 0 when there is not enough information."),
    highInr: z.number().describe("High end in rupees, 0 when there is not enough information."),
    note: z.string(),
  }),
});

export const socialPostsOutput = z.object({
  posts: z.array(
    z.object({
      channel: z.enum(CHANNEL_IDS),
      date: z.string().describe("YYYY-MM-DD."),
      caption: z.string(),
      hashtags: z.array(z.string()).describe("Without the # sign."),
      imageBrief: z.string().describe("What the image should show, for the designer."),
      cta: z.string().describe("Call to action, or empty."),
    })
  ),
});

export const campaignPlanOutput = z.object({
  plan: z.object({
    name: z.string(),
    objective: z.string(),
    budget: z.object({
      dailyInr: z.number(),
      totalInr: z.number(),
      split: z.array(z.object({ label: z.string(), percent: z.number() })),
    }),
    audiences: z.array(
      z.object({
        name: z.string(),
        locations: z.array(z.string()),
        ageMin: z.number(),
        ageMax: z.number(),
        interests: z.array(z.string()),
        notes: z.string(),
      })
    ),
    creatives: z.array(
      z.object({
        primaryText: z.string().describe("Recommended 125 characters or fewer."),
        headline: z.string().describe("40 characters or fewer."),
        description: z.string(),
        cta: z.string().describe("A Meta call-to-action button label such as 'Learn more' or 'Get quote'."),
        imageBrief: z.string(),
      })
    ),
    leadFormQuestions: z.array(z.string()),
    kpis: z.object({ targetCplInr: z.number(), expectedLeads: z.number() }),
    notes: z.string(),
  }),
});

export const pipelineReviewOutput = z.object({
  summary: z.string(),
  deals: z.array(
    z.object({
      dealId: z.string().describe("The id of the deal exactly as given."),
      company: z.string(),
      risk: z.enum(["high", "medium", "low"]),
      reason: z.string(),
      nextAction: z.string(),
      followUpDate: z.string().describe("Suggested YYYY-MM-DD, or empty."),
    })
  ),
});
