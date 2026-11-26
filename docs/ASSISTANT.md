# Assistant

The assistant drafts work for people to review. It runs on the hub's server with the Claude Messages API (`@anthropic-ai/sdk`), model **`claude-opus-5-5`**, inside the route handlers `/api/agents` and `/api/agents/[key]`. The API key never reaches the browser.

Without `ANTHROPIC_API_KEY`, `GET /api/agents` returns `configured: false`, runs return 503 `not_configured`, and the Assistant page shows a plain "not configured" message.

## Who can use it

| Role | Agents |
| --- | --- |
| admin | all eight |
| marketing | all except Draft payment reminder |
| founder | Research a prospect |
| developer | none (the Assistant page is not in their menu) |

The admin can switch any agent off for everyone in **Settings > Assistant**.

## The eight agents and what each one sends

Before anything is sent, records pass through `redactDeal`, `redactVisit` and `redactClient`, which remove **phone numbers, email addresses, office and billing addresses and Google Maps links** (`phoneNumber`, `emailAddress`, `officeAddress`, `googleMapsLink`, `contactEmail`, `contactPhone`, `billingAddress`, `email`). Only the records the run refers to are sent. The email "To" address and the WhatsApp number are filled in on the person's screen after the result comes back.

Every run also sends: today's date (IST), the sender's name, the company profile (name, services, the shared inbox for the signature and cc) and the chosen language.

| Agent | Key | Form fields | Records sent (redacted) | Output |
| --- | --- | --- | --- | --- |
| Draft follow-up | `follow_up` | channel (email, WhatsApp, call or all), tone (warm or formal), notes | the deal and up to 3 linked visits | email, WhatsApp text, call points |
| Structure visit notes | `visit_notes` | rough notes (20 to 6,000 characters) | the deal or the visit and its deal, if chosen | visit record fields, a deal update, recap email |
| Research a prospect | `prospect_brief` | company, city, website, focus | none (uses web search and web fetch) | one-page brief in Markdown with sources |
| Outline a proposal | `proposal_outline` | budget note, timeline in weeks | the deal | scope, out of scope, milestones, assumptions, price range |
| Plan social posts | `social_posts` | goal, channels, start date, weeks, posts per week, topics | none | dated posts per channel with captions and hashtags |
| Plan a Meta ad campaign | `meta_campaign` | service, objective, locations, daily budget, duration, audience notes | the campaign, if chosen | budget split, audiences, ad text, lead form questions, KPIs |
| Review stale deals | `pipeline_review` | rep (admin only) | up to 80 open deals that are overdue or not visited for 14 days | a summary and the next step for each deal |
| Draft payment reminder | `payment_reminder` | tone (gentle or firm) | the invoice and its client | email and WhatsApp text |

Effort per agent: follow-up, social posts and pipeline review medium; visit notes and payment reminder low; prospect brief, proposal outline and Meta campaign high.

## Shared mode loads records on the server

When the Google Sheets script is version 2, the browser sends only a reference (`deal:<id>`, `invoice:<id>` and so on). The server loads the record from the sheet through the same read policy as everything else (`lib/data/policy.ts`) and ignores any record data the browser sends. A record the person may not read returns 403; a missing one returns 404.

With script version 1 (or no sheet), records exist only in the person's browser, so the browser sends them with the request. The server still checks ownership: a marketing person can only send their own deals and visits, and only the admin can send invoices and clients.

## Drafts only

- Nothing is emailed, posted, or written to a deal or visit by the assistant. Every result is saved as a **draft** (Assistant > History, and on the record it was run for) with an Undo.
- Buttons on a draft (Open in email, Copy, Create visit from this, Apply to deal, Add to calendar, Save as campaign, Use in quotation) each need a click, and emails open in the person's own mail app for them to send.
- Every draft starts with "Drafted by the assistant. Review it before sending."

## Revise and versions

Under a result, the **Revise** box takes an instruction ("shorter", "more formal", "mention the demo"; up to 500 characters). The previous output and the instruction go to the model as a new message, the new result replaces the draft, and the old one is kept in **Previous versions**, where it can be restored.

## Languages

Draft follow-up, Draft payment reminder and Plan social posts can write in **English, Kannada or Hindi**. In Kannada and Hindi the message, WhatsApp text and captions are in that script; the signature, company names and amounts stay as given.

## Model, cost and limits

- Model `claude-opus-5-5`, no override. Adaptive thinking (summarised, shown under "Show reasoning"), an explicit effort level per agent, a cached system prompt, and the server-side fallbacks beta.
- **Cost line**: Settings > Assistant shows runs and an approximate rupee cost for the current month, from the token counts saved on each draft and the prices set there (USD per million input and output tokens, and the USD to INR rate). Web search charges are not included.
- **Rate limit**: `AGENTS_RATE_LIMIT_PER_HOUR` runs per person per hour (default 30), counted in memory on each server instance, so it resets on redeploy and is per instance.
- **Time limit**: a run stops after 285 seconds with "The assistant took too long. Try again with less input." The route allows 300 seconds.
- **Vercel Fluid compute must be on** (Project > Settings > Functions). Without it, functions stop well before 300 seconds and long runs (prospect briefs, proposals, campaigns) fail.

## How a run works

1. `POST /api/agents/<key>` checks, in order: session (401), known agent (404), role (403), API key (503), body size and fields (400), rate limit (429), record access (403 or 404). These come back as JSON.
2. The response is a Server-Sent Events stream: status lines, "Searching the web for …", reasoning in whole sentences, streamed text for briefs, then one `result` or `error` event. A `: ping` comment every 15 seconds keeps the connection open.
3. Closing the panel or pressing Stop aborts the upstream request.

## Adding an agent

Three edits, nothing else:

1. **`lib/agents/catalog.ts`**: one `AGENT_CATALOG` entry (key, name, description, roles, reference type, web search, languages). Add the key to `AgentKey` in `lib/agents/types.ts`.
2. **`lib/agents/registry.ts`**: one `AGENT_DEFS` entry (input and output schemas, effort, max tokens, output kind, status message, `toOutput`).
3. **`lib/agents/prompts.ts`**: one instruction block for the agent.

If the output is a new shape, add a variant to `AgentOutput` and a renderer in `components/studio/AgentOutputView.tsx`.

Contact: info@axoraa.com.
