# Axoraa Hub

Daily work, pipeline, delivery and collections tracking for the Axoraa team. Google Sheets is the database.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill it in (see below)
npm run dev
```

## Accounts & access

| Route | Who can open it |
| --- | --- |
| `/login` | everyone |
| `/admin` | the `admin` account only (super user — sees and edits everything) |
| `/u/<username>` | that person, or the admin (e.g. only Akshar can open `/u/akshar`) |
| `/api/sheets` | signed-in users; members only receive and write their **own** rows |

Usernames live in `lib/people.ts`. An account can sign in only when its password hash is set in the environment:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"   # AUTH_SECRET
node scripts/hash-password.mjs "their-password"                                    # AUTH_HASH_<USERNAME>
```

Sessions are HMAC-signed, HTTP-only cookies (12h). `proxy.ts` redirects early; every page re-checks the session on the server (`lib/auth/dal.ts`). Failed logins are throttled (5 per 15 min per username + IP).

To make someone else a super user, change their `role` to `"admin"` in `lib/people.ts`.

## Google Sheets

1. Open the admin → **Google Sheets** panel → **Setup**, copy the Apps Script into the workbook.
2. In Apps Script → Script properties, add `AXORAA_TOKEN` (long random string). Deploy as a Web app.
3. Set `SHEETS_WEBAPP_URL` and `SHEETS_API_TOKEN` in `.env.local` and restart.

The URL and token stay on the server; browsers only talk to `/api/sheets`. Without them the hub runs on the browser's local storage (shown as "Local data" in the header).

## Exports

Every table has a CSV button, and **Export Center** downloads work logs, team summary, deals, visits, clients, projects and invoices for any week, month or year (UTF-8 CSV, opens cleanly in Excel / Sheets). "Print / save as PDF" prints the current view.
