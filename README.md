# Axoraa Hub

The internal workspace for the Axoraa team. Developers log their daily work, marketing tracks deals, visits, content and campaigns, founders follow their clients and delivery, and the administrator sees everything on the Command Center. Invoices and quotations print as Indian tax documents (CGST/SGST or IGST). A Google Sheet is the shared database, and a Claude-powered assistant drafts follow-ups, briefs and plans for people to review.

Built with Next.js 16 (App Router, `proxy.ts`), React 19, Tailwind CSS 4 and TypeScript. Contact: info@axoraa.com.

More detail:

- [docs/USER_GUIDE.md](docs/USER_GUIDE.md): the SOP & Guide page, formatted for printing
- [docs/SHEETS_SETUP.md](docs/SHEETS_SETUP.md): Google Sheets and the version 2 Apps Script
- [docs/META_SETUP.md](docs/META_SETUP.md): Facebook Page, Lead Ads and the webhook
- [docs/ASSISTANT.md](docs/ASSISTANT.md): the eight assistant agents, privacy and cost
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): folders, data layer, views and contracts

## Accounts and roles

| Route | Who can open it |
| --- | --- |
| `/login` | everyone |
| `/admin` | the `admin` account only (super user, sees and edits everything) |
| `/u/<username>` | that person, or the admin (only Akshar can open `/u/akshar`) |
| `/api/*` | signed-in users; every handler checks the session itself (the Meta webhook checks Meta's signature instead) |

Usernames and roles live in `lib/people.ts`:

| Role | Accounts | Home |
| --- | --- | --- |
| admin | admin | Command Center |
| founder | akshar, abhinav, adnaan, bhuvan | My dashboard |
| marketing | kamil, anusha | My dashboard |
| developer | manish, vinod, chakravarthi | My dashboard |

To make someone else a super user, change their `role` to `"admin"` in `lib/people.ts`.

### What each role can read and write

This table is enforced in one place, `lib/data/policy.ts`, on the server for shared data and in the browser for buttons.

| Records | admin | founder | marketing | developer |
| --- | --- | --- | --- | --- |
| Deals | read and write all | none | read and write own (`marketingPerson`) | none |
| Visits | read and write all | none | read and write own | none |
| Clients | read and write | read and write own (`salesOwner`) | none | none |
| Projects | read and write | read and write own (`projectManager`) | none | none |
| Invoices | read and write | read, for their own clients | none | none |
| Roster, repositories | read and write | read | read | read |
| Content, campaigns | read and write | none | read and write (team-wide) | none |
| Assistant drafts | read and write all | read and write own | read and write own | none |
| Activity | read all | read own | read own | read own |
| Settings | read and write | read | read | read |

- Anyone signed in can add activity rows; the server sets who and when.
- Deleting follows writing, except clients, projects and invoices, which only the admin can delete.
- Work logs keep their original rules: members see and add their own; only the admin pushes the whole log to the sheet.

Sessions are HMAC-signed, HTTP-only cookies (12 hours). `proxy.ts` redirects early, and every page checks the session again on the server (`lib/auth/dal.ts`). Failed sign-ins are throttled: 5 per 15 minutes per username and IP.

## Run locally

```bash
npm i
cp .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"   # paste as AUTH_SECRET
node scripts/hash-password.mjs "their-password"                                    # paste as AUTH_HASH_<USERNAME>
npm run dev
```

Open http://localhost:3000/login. Only `AUTH_SECRET` and at least one `AUTH_HASH_*` are needed to sign in. Without the Sheets variables the hub saves to the browser and shows demo data on first run.

## Deploy on Vercel

1. Import the repository in Vercel (framework: Next.js; no build settings to change).
2. Add the environment variables: **Project > Settings > Environment Variables**. Add each name from the table below for Production (and Preview if you use it). Paste values without quotes.
3. **Redeploy** after any change: Deployments > the latest deployment > ... > Redeploy. Vercel only reads new values on a new deployment.
4. Turn on **Fluid compute** (Project > Settings > Functions). The assistant streams for up to 300 seconds per run and needs it.

Never put a secret in a `NEXT_PUBLIC_` variable. `.env.local` and `.env.vercel` are git-ignored; keep it that way.

## Environment variables

Every variable is server-only. `.env.example` lists them all with a one-line comment.

| Variable | Needed | What it does |
| --- | --- | --- |
| `AUTH_SECRET` | yes | HMAC key for the `axoraa_session` cookie. 32 or more random characters. |
| `AUTH_HASH_<USERNAME>` | yes, per account | PBKDF2 password hash, one per account: ADMIN, AKSHAR, ABHINAV, ADNAAN, BHUVAN, KAMIL, ANUSHA, MANISH, VINOD, CHAKRAVARTHI. An account without a hash cannot sign in. Make one with `node scripts/hash-password.mjs "password"`. |
| `SHEETS_WEBAPP_URL` | for sharing | The Apps Script `/exec` URL. Work logs use the version 1 actions. Shared deals, visits, clients, invoices, content, campaigns, drafts, settings and Meta leads need the version 2 script. Without it, data stays in each browser. |
| `SHEETS_API_TOKEN` | with the URL | Shared secret; must match the Script Property `AXORAA_TOKEN`. |
| `ANTHROPIC_API_KEY` | for the assistant | Turns on the marketing assistant (`claude-opus-5-5`) behind `/api/agents`. Without it the assistant shows a plain "not configured" state. Needs Vercel Fluid compute for 300-second runs. |
| `AGENTS_RATE_LIMIT_PER_HOUR` | no | Assistant runs per person per hour (default 30). Counted in memory on each server instance. |
| `META_GRAPH_VERSION` | no | Graph API version in every Meta URL (default `v27.0`). Re-test Meta features whenever you change it. |
| `META_APP_ID` | for Meta | ID of the Business-type Meta app. |
| `META_APP_SECRET` | for Meta | Signs `appsecret_proof` (HMAC over the access token) and checks the webhook `X-Hub-Signature-256` header. |
| `META_BUSINESS_ID` | no | Business Portfolio ID. Reference only; a later token-refresh job will use it. |
| `META_SYSTEM_USER_TOKEN` | for Meta, or the Page token | System-user access token. |
| `META_SYSTEM_USER_TOKEN_EXPIRES_AT` | no | Expiry (`YYYY-MM-DD`) of the 60-day token. The admin is warned when 10 days or fewer are left. |
| `META_PAGE_ID` | for Meta | The Axoraa Facebook Page. Incoming webhook entries must match it. |
| `META_PAGE_ACCESS_TOKEN` | no | Page token. When empty, the server derives one from the system-user token and keeps it in memory for an hour. |
| `META_IG_USER_ID` | no | Instagram professional account ID. Only the status display uses it; Instagram publishing is not built yet. |
| `META_AD_ACCOUNT_ID` | no | `act_` ID kept for future ads reporting, which is not built yet. |
| `META_WEBHOOK_VERIFY_TOKEN` | for Lead Ads | Random string of 32 or more characters, used only for the webhook GET handshake. Lead Ads also need Sheets version 2. |
| `META_LEADGEN_FORM_IDS` | no | Comma-separated Lead Ad form IDs that "Fetch missed leads" checks for the last 7 days. |
| `META_PUBLISH_ENABLED` | no | Must be `true`, with Meta configured, before the hub publishes or schedules Facebook Page posts. Off by default. |

## Data and migrations

- Every collection has a `localStorage` key. The original keys (`axoraa_work_logs_v1`, `axoraa_marketing_deals_v1`, `axoraa_client_master_v1` and the rest) are kept exactly; new collections get their own `_v1` keys.
- Schema version 2 (`axoraa_schema_version = "2"`) runs once per browser on load. It gives every row a unique id and created/updated dates, marks the original sample rows as demo, and links visits to deals only when the lead ID and company name both match. It never deletes or renames a key, and running it again changes nothing.
- Demo data is seeded only into a brand-new browser that is not using shared Google Sheets. Deleting the last row of a list does not bring the demo back. Demo rows are never uploaded to the sheet.
- A save that fails to reach Google Sheets is kept on the device and listed as "not saved" with Retry. Failed deletes put the row back.
- Export center downloads CSVs and a full JSON backup; a backup can be merged back in.

## Google Sheets: version 1 and version 2

| | Script version 1 | Script version 2 |
| --- | --- | --- |
| Work logs | shared | shared (same actions as version 1) |
| Deals, visits, clients, projects, invoices, roster, repositories, content, campaigns, drafts, activity, settings | in each browser | shared, one tab each |
| Meta Lead Ads | held (Meta retries) | saved as deals |
| IDs and invoice numbers | per browser | issued by the script under a lock |

Upgrading is a redeploy of the same Apps Script deployment, so the `/exec` URL does not change. See [docs/SHEETS_SETUP.md](docs/SHEETS_SETUP.md). After the upgrade, each person clicks **Upload** on My dashboard once to send the records that were only in their browser.

## Assistant

Eight agents draft work for people to review: follow-ups, visit notes, prospect research, proposal outlines, social posts, Meta campaign plans, stale-deal reviews and payment reminders. They run on the server with `claude-opus-5-5`, stream their progress, and save every result as a draft with version history. Nothing is sent or posted without a click, and phone numbers and email addresses never go to the model. See [docs/ASSISTANT.md](docs/ASSISTANT.md).

## Meta

Facebook Page publishing, Lead Ads (via a signed webhook) and status checks are built and switched off until configured. Instagram publishing and ads reporting are not built yet. See [docs/META_SETUP.md](docs/META_SETUP.md).

## Keyboard shortcuts

| Keys | Does |
| --- | --- |
| Ctrl K (⌘ K on a Mac) | Command bar: search deals, visits, work logs, clients, invoices and people |
| / | Search this page |
| N | The page's main action (Log work, Add deal, Log visit…) |
| ? | List every shortcut |
| G then T / O / D / V / A / I / L / S | Go to My dashboard, Command Center, Deal tracker, Visit log, Assistant, Invoices, Daily work log, Settings (where your role has them) |
| Esc | Close a panel, menu or dialog |

Shortcuts pause while you type in a field or a dialog is open.

## Development pages

- `/dev/reference`: every component, chart and state of the design system on mock data.
- `/dev/views`: every role, view and overlay rendered from demo data.

Both need a signed-in session (`proxy.ts` sends you to `/login` first) and return 404 in production.

Checks before a pull request:

```bash
npx next typegen
npx tsc --noEmit
npx eslint
```

## Contact

Questions, access and password resets: info@axoraa.com.
