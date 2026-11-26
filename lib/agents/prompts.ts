// Prompts for the assistant's agents.
//
// Order matters for prompt caching: STABLE_SYSTEM(company) is the cached system block and changes only
// when the company profile does. Each agent then has one fixed instruction block, which opens the user
// message; every volatile value (today's date, the records, the input, a revision) comes after it.
// Records are redacted before they get here: no phone numbers, email addresses, street addresses or map
// links reach the model. The browser fills in the email 'to' and the WhatsApp number afterwards.
import { clientFacingEmail, type CompanyProfile } from "@/lib/company";
import type { HubSettings } from "@/lib/settings";
import type { Campaign, ClientMasterRecord, MarketingDeal, MarketingInteraction, PaymentBillingRecord } from "@/lib/types";
import type { AgentKey, AgentLanguage, AgentOutput } from "./types";

/** Records loaded (shared mode) or accepted (local mode) for one run. */
export interface AgentContext {
  deal?: MarketingDeal;
  visits?: MarketingInteraction[];
  deals?: MarketingDeal[];
  invoice?: PaymentBillingRecord;
  client?: ClientMasterRecord;
  campaign?: Campaign;
  company: CompanyProfile;
  settings: HubSettings;
}

/* ------------------------------------------------------------------ system block */

export function STABLE_SYSTEM(company: CompanyProfile): string {
  const services = company.services.length ? company.services.map((s) => `- ${s}`).join("\n") : "- Custom software";
  const where = [company.city, company.state].filter(Boolean).join(", ") || "Karnataka";
  return `You are the drafting assistant inside Axoraa Hub, the internal workspace of ${company.name}, a software agency based in ${where}, India. ${company.name} builds software for small and mid-sized Indian businesses and for enterprise clients.

Services ${company.name} offers:
${services}

Website: ${company.website || "axoraa.com"}. Shared inbox for client-facing mail: ${clientFacingEmail(company)}.

Who reads your work
- A member of the ${company.name} team reads every draft you write, edits it and decides whether to send it. Nothing you write is sent or posted automatically. Write the draft itself, not commentary about it.

How to write
- Plain, specific Indian English, the way a capable account manager writes to a client they respect. Short sentences. One idea per paragraph.
- No hype words (for example: revolutionary, cutting-edge, game-changing, seamless, synergy, leverage, unlock, world-class, delighted). No exclamation marks. No emoji.
- Money in rupees with the ₹ sign and Indian digit grouping: ₹1,25,000, ₹12.5 lakh, ₹1.2 crore. Never use dollars unless the input does.
- Dates like 25 Nov 2026 in prose, in Indian Standard Time. Fields that ask for a date use YYYY-MM-DD.
- Address people by the name given, with "Mr" or "Ms" only when the input uses it.

Facts
- Use only the facts in the records and input you are given, or, when you have web search, facts you found and can cite.
- Never invent a prospect's or client's revenue, headcount, customers, technology, quotes, prior conversations, prices or commitments. When something you need is unknown, say so plainly in the draft (for example "[confirm budget]") or leave the field empty.
- Do not promise discounts, dates or features that the input does not already state.
- Contact details are deliberately removed from the records. Never write a phone number, email address or street address unless it appears in the input.

Email rules
- Every email ends with the signature block you are given, exactly as given, line for line. Do not add a second sign-off.
- Emails are sent from or copied to ${clientFacingEmail(company)}; do not mention other addresses.
- Subject lines are specific and under 70 characters.

Language
- Write in English unless the user message asks for Kannada or Hindi. When it does, write the email body, WhatsApp text and post captions in that language's own script (Kannada script for Kannada, Devanagari for Hindi), in a natural, polite register. Keep the signature block, company names, product names, amounts and dates exactly as given. Subject lines, call points and hashtags may stay in English.

Output
- When a response format is set, fill every field. Use an empty string or an empty list for anything that does not apply. Do not wrap JSON in code fences.`;
}

/* ------------------------------------------------------------------ one block per agent */

const AGENT_BLOCKS: Record<AgentKey, string> = {
  follow_up: `TASK: Draft the next follow-up on a deal.
- Read the deal and its recent visits. Work out the single most useful next step (book a demo, send the proposal, confirm a decision, re-open a quiet lead) and write toward it.
- channel "email": write the email only. "whatsapp": the WhatsApp text only. "call": call points only. "all": all three.
- Email: 90 to 180 words, refers to what was actually discussed, one clear ask with a proposed date, then the signature block.
- WhatsApp: 2 to 4 short lines, first name, no signature block, sign off with the sender's first name and the company name.
- Call points: 3 to 6 short bullets the rep can glance at, ending with the ask.
- Tone "warm" is friendly and direct; "formal" is courteous and more reserved.`,

  visit_notes: `TASK: Turn a rep's rough visit notes into a clean visit record, a deal update and a short recap email to the client.
- Fill the visit fields from the notes only. When the notes do not say, pick the most neutral option (for example interactionType "Check-in", meetingMode "Physical (On-site)") and keep text fields empty rather than guessing.
- probabilityPct is the rep's likelihood of winning, 0 to 100, from the tone of the notes.
- dealPatch.leadStatus moves the stage only when the notes clearly show it ("No change" otherwise).
- The recap email thanks the client, lists what was agreed and the next step with its date, 80 to 150 words, then the signature block.`,

  prospect_brief: `TASK: Research a company on the web and write a one-page brief for a rep meeting them for the first time.
- Search the web; fetch the company's own site when you have its address. Prefer the company's site, filings, reputable Indian business press and LinkedIn company pages. Ignore listicles and directories that repeat each other.
- Write Markdown with these sections, in this order: "## Snapshot" (what they do, where, size if known), "## What they likely need" (where the agency's services could help, tied to evidence), "## Talking points" (4 to 6 bullets), "## Questions to ask" (4 to 6 bullets), "## Unknowns" (what you could not confirm).
- Under 450 words. Every fact must come from a source you found; write "not found" rather than guessing. Do not include a sources list; the citations are collected separately.`,

  proposal_outline: `TASK: Outline a proposal for a deal from its requirements.
- summary: 2 to 3 sentences in the client's terms.
- scope: concrete deliverables. outOfScope: what is not included, to avoid surprises later.
- milestones: 3 to 6, each with deliverables, a duration in weeks and the share of the price billed at that milestone; the shares add up to 100. Respect the requested timeline when one is given.
- assumptions: what the estimate depends on (client inputs, integrations, hosting, content).
- priceBand: a realistic range in rupees for an Indian software agency, using the deal's budget and estimated value as anchors. When there is not enough information, set both numbers to 0 and explain in the note.`,

  social_posts: `TASK: Plan a dated set of social posts.
- Spread the posts evenly over the requested weeks, starting on the start date, on weekdays, using only the requested channels.
- Facebook Page: 40 to 120 words, conversational. Instagram: a strong first line, under 150 words, 5 to 10 hashtags. LinkedIn: 80 to 200 words, professional, a practical insight before any mention of the company, 3 to 5 hashtags.
- Each post has one idea, a specific example from Indian SMB or enterprise work, and an image brief a designer can act on. No stock-photo clichés, no invented client names or results.
- Hashtags without the # sign.`,

  meta_campaign: `TASK: Plan a Meta (Facebook and Instagram) ad campaign.
- Keep the total budget equal to the daily budget times the number of days. Split it across audiences or placements, with percentages that add up to 100.
- 2 to 3 audiences in the requested locations with realistic age ranges (18 to 65) and interests Meta actually offers.
- 3 creatives. headline 40 characters or fewer; primaryText ideally 125 characters or fewer; cta is a Meta button label.
- For a leads objective, 3 to 5 lead form questions (no questions that ask for sensitive personal data). For other objectives, leave the list empty.
- KPIs: a target cost per lead in rupees and the expected number of leads, realistic for Indian B2B software (often ₹300 to ₹1,500 per lead). Note any assumption in notes.`,

  pipeline_review: `TASK: Review open deals that have gone quiet and say what to do next on each.
- You are given open deals whose follow-up date has passed or with no visit for 14 days or more.
- Rank them by risk: "high" when the deal is valuable and overdue by a week or more or has had no contact for 21 days or more; "medium" for other overdue deals; "low" when it can wait.
- For each deal: the reason in one sentence, the next action in one sentence, and a suggested follow-up date within the next 7 working days (Monday to Saturday).
- dealId must be copied exactly from the input. Include each deal at most once. summary is 2 to 3 sentences on the overall picture.`,

  payment_reminder: `TASK: Draft a payment reminder for an unpaid invoice.
- Include the invoice number, the amount still due, and the due date, exactly as given. Mention TDS only when the input shows TDS.
- Tone "gentle": assume it was missed, offer help, ask for a payment date. "firm": state that it is overdue, ask for payment by a specific date within 7 days, stay courteous. Never threaten.
- Email 80 to 150 words, then the signature block. WhatsApp 2 to 3 short lines. Call points: leave the list empty.`,
};

export function agentInstructions(key: AgentKey): string {
  return AGENT_BLOCKS[key];
}

/* ------------------------------------------------------------------ redaction */

const STRIP = new Set([
  "phoneNumber",
  "emailAddress",
  "officeAddress",
  "googleMapsLink",
  "contactEmail",
  "contactPhone",
  "billingAddress",
  "email",
  "phone",
  "mobile",
  "mobileNumber",
  "whatsapp",
  "whatsappNumber",
  "alternatePhone",
  "alternateContact",
  "alternateEmail",
  "contactNumber",
  "address",
  "mapLink",
  // Bookkeeping fields the model has no use for.
  "demo",
  "createdBy",
  "createdAt",
  "updatedAt",
  "quote",
]);

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+/gi;
const MAP_LINK_RE = /https?:\/\/(?:www\.)?(?:maps\.app\.goo\.gl|goo\.gl\/maps|google\.[a-z.]+\/maps|maps\.google\.[a-z.]+)\S*/gi;
// Indian mobile (optionally +91 / 0 prefix, with spaces or dashes) and landline (STD code + number).
const MOBILE_RE = /(?<!\d)(?:(?:\+|00)?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/g;
const LANDLINE_RE = /(?<!\d)0\d{2,4}[\s-]?\d{6,8}(?!\d)/g;
// Masked numbers such as 98450xxxxx or 98450 XXXXX.
const MASKED_PHONE_RE = /(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{3,4}[\s-]?[xX*]{4,6}(?![\w])/g;

/** Removes phone numbers, email addresses and map links from free text. */
export function scrubText(text: string): string {
  return text
    .replace(EMAIL_RE, "[email removed]")
    .replace(MAP_LINK_RE, "[map link removed]")
    .replace(MASKED_PHONE_RE, "[phone removed]")
    .replace(MOBILE_RE, "[phone removed]")
    .replace(LANDLINE_RE, "[phone removed]");
}

/** Applies scrubText to every string inside a value, at any depth. */
export function scrubValue<T>(value: T): T {
  if (typeof value === "string") return scrubText(value) as unknown as T;
  if (Array.isArray(value)) return value.map(scrubValue) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = scrubValue(v);
    return out as T;
  }
  return value;
}

function strip<T extends object>(row: T | undefined | null): Record<string, unknown> | undefined {
  if (!row || typeof row !== "object") return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (STRIP.has(k) || v === undefined || v === null || v === "") continue;
    out[k] = scrubValue(v);
  }
  return out;
}

export function redactDeal(d: MarketingDeal | undefined | null) {
  return strip(d);
}
export function redactVisit(v: MarketingInteraction | undefined | null) {
  return strip(v);
}
export function redactClient(c: ClientMasterRecord | undefined | null) {
  return strip(c);
}
function redactInvoice(p: PaymentBillingRecord | undefined | null) {
  const r = strip(p);
  if (r && Array.isArray(r.payments)) {
    r.payments = (r.payments as Record<string, unknown>[]).map(({ date, amount, tdsAmount, tdsSection, mode }) => ({ date, amount, tdsAmount, tdsSection, mode }));
  }
  return r;
}

/* ------------------------------------------------------------------ the user message */

const LANGUAGE_NAME: Record<AgentLanguage, string> = { en: "English", kn: "Kannada", hi: "Hindi" };

export interface UserMessageOptions {
  todayIST: string;
  senderName: string;
  signature: string;
  language: AgentLanguage;
  revise?: { previous: AgentOutput; instruction: string };
}

function block(title: string, value: unknown): string {
  return `<${title}>\n${typeof value === "string" ? value : JSON.stringify(value, null, 2)}\n</${title}>`;
}

/** The agent's fixed instructions first, then every volatile value. */
export function buildUserMessage(key: AgentKey, input: Record<string, unknown>, context: AgentContext, o: UserMessageOptions): string {
  const parts: string[] = [agentInstructions(key), ""];

  parts.push(block("today", `${o.todayIST} (IST)`));
  parts.push(block("sender", o.senderName));
  parts.push(block("signature_block", o.signature));
  if (o.language !== "en") {
    parts.push(block("language", `Write the message text in ${LANGUAGE_NAME[o.language]}, in its own script.`));
  }

  if (context.deal) parts.push(block("deal", redactDeal(context.deal)));
  if (context.visits?.length) parts.push(block("recent_visits", context.visits.map(redactVisit)));
  if (context.deals?.length) parts.push(block("open_deals", context.deals.map(redactDeal)));
  if (context.invoice) parts.push(block("invoice", redactInvoice(context.invoice)));
  if (context.client) parts.push(block("client", redactClient(context.client)));
  if (context.campaign) {
    const { plan: _plan, ...rest } = context.campaign;
    void _plan;
    parts.push(block("campaign", strip(rest)));
  }

  parts.push(block("input", scrubValue(input)));

  if (o.revise) {
    parts.push(block("previous_draft", o.revise.previous));
    parts.push(
      block(
        "revision_request",
        `Revise the previous draft: ${scrubText(o.revise.instruction)}\nKeep everything the request does not ask you to change. Return the complete revised draft in the same format.`
      )
    );
  }

  return parts.join("\n\n");
}
