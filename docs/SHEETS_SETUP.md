# Google Sheets setup

The hub uses one Google Sheet (the "AXORAA DEV TEAM Workbook") as its shared database. The browser never talks to Google directly: it calls the hub's server (`/api/sheets` for work logs, `/api/data` for everything else), and the server calls an Apps Script web app with a shared token.

| | Version 1 script | Version 2 script |
| --- | --- | --- |
| Shared | Work logs ("Daily Work Log" tab) | Work logs, plus deals, visits, clients, projects, invoices, roster, repositories, content, campaigns, assistant drafts, activity and settings |
| Without it | Everything except work logs stays in each person's browser | – |
| Needed for | – | Meta Lead Ads, server-issued IDs and invoice numbers, the assistant reading records by reference |

The Integrations page (admin) shows which version is live: "Connected with script version 2", "Connected with script version 1. Only work logs are shared." or "Not connected".

## First-time setup

1. Open the workbook in Google Sheets, then **Extensions > Apps Script**.
2. In the hub, open **Integrations > Google Sheets** and click **Copy Apps Script**. Paste it over everything in `Code.gs` and save.
3. **Project Settings (gear) > Script Properties > Add script property**: name `AXORAA_TOKEN`, value a long random string. Generate one with:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

4. **Deploy > New deployment**. Type: **Web app**. Execute as: **Me**. Who has access: **Anyone**. Requests without the token are rejected by the script, so "Anyone" does not open the data.
5. Authorise the script when Google asks, then copy the **Web app URL** (it ends in `/exec`).
6. Set the two server variables:
   - `SHEETS_WEBAPP_URL` = the `/exec` URL
   - `SHEETS_API_TOKEN` = the same value as `AXORAA_TOKEN`

   Locally, put them in `.env.local` and restart `npm run dev`. On Vercel: **Project > Settings > Environment Variables**, add both, then **Deployments > latest > Redeploy**.
7. Open Integrations again. It should read "Connected with script version 2".

## Upgrading from version 1 (keep the same URL)

If the hub already works with the old script, update the code in place so the `/exec` URL and the token stay the same:

1. In the hub: **Integrations > Google Sheets > Copy Apps Script**.
2. In Apps Script, paste it over the old code in `Code.gs` and save.
3. **Deploy > Manage deployments**, select the existing web app deployment, click the **pencil (Edit)**, set **Version: New version**, and click **Deploy**.
4. Do not create a new deployment: a new deployment gets a new URL, and the hub would keep calling the old one.
5. Nothing changes in Vercel or `.env.local`. The hub checks the script version about once a minute; reload after that.

Version 2 keeps the version 1 behaviour byte for byte: a GET with no action still returns the work-log rows, and `ADD_LOG` / `SYNC_ALL` are unchanged.

## Tabs

The version 2 script creates each tab the first time it is used, with an `id` header and the plain-text (`@`) format, so phone numbers, GSTINs and IDs are not turned into numbers or dates. Missing columns are appended when a record has a new field.

| Tab | Holds |
| --- | --- |
| Daily Work Log | Work logs (version 1 format, unchanged) |
| Deals | Leads and deals |
| Visits | Visits and calls |
| Clients | Signed clients |
| Projects | Projects per client |
| Invoices | Invoices and payments received |
| Roster | Engineering team members |
| Repositories | Repository list |
| Content | Planned and published posts |
| Campaigns | Campaigns |
| Drafts | Assistant drafts and their versions |
| Activity | Who changed what (the hub reads the last 500 rows) |
| Settings | Company profile, pipeline and assistant settings |

Do not rename tabs or the `id` column. Adding your own columns to the right is fine; the hub ignores them. Text that starts with `=`, `+`, `-` or `@` is stored with a leading apostrophe so the sheet never runs it as a formula.

## After switching to version 2: upload once

Records added before the upgrade live only in each person's browser. Each person opens **My dashboard** once and clicks **Upload** on the notice listing their local records. The upload:

- sends records in batches of 200, through the same permission checks as a normal save;
- never sends demo rows;
- skips records the person may not write, and never overwrites a row that already exists (members upload insert-only).

The admin can also upload from **Integrations > Google Sheets > Upload this device's records**.

## Limits

- **Last writer wins per row.** Two people editing the same deal at the same time: the later save replaces the earlier one. Different rows never collide.
- **Apps Script quotas.** Google limits script run time (6 minutes per call), simultaneous executions (about 30) and daily URL fetches and triggers. A busy day of normal use is far below these; a very large one-time upload is the most likely thing to hit them. If it fails part-way, run it again: rows already uploaded are skipped.
- **Cell size.** Google caps a cell at 50,000 characters. The hub refuses to save a record with a single field over 45,000 characters (very long assistant drafts are the usual cause).
- **Speed.** The hub loads every tab in one call and caches it on the server for 30 seconds. Each save takes the script lock (up to 20 seconds of waiting), so saves are one at a time.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Integrations says "Not connected" | One of the two variables is missing, or the URL is not `https://.../exec`. Check them in Vercel and redeploy. |
| "Connected with script version 1" after upgrading | The deployment was not edited to a new version, or a new deployment was made instead. Repeat "Upgrading", step 3. |
| Saves show "not saved to Google Sheets" | The script returned an error or timed out. Use Retry. If it keeps failing, open Apps Script > Executions to see the error. |
| Every request fails with "Unauthorized" | `AXORAA_TOKEN` and `SHEETS_API_TOKEN` differ. Set them to the same value. |

Contact: info@axoraa.com.
