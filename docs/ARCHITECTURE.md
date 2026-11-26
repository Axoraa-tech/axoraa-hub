# Architecture

Next.js 16 App Router, React 19, Tailwind CSS 4, TypeScript (strict). Three pages (`/login`, `/admin`, `/u/<username>`) and a set of route handlers under `/api`. Inside a page, everything is one client app (`components/HubApp.tsx`) that switches views through the URL.

## Folder map

```
app/
  layout.tsx              Root layout: Geist fonts, theme script, toasts and confirm dialogs, Vercel Analytics
  globals.css             Design tokens (light and dark), card, pill, chip, table and chart classes
  login/                  Sign-in page, form and server action (actions.ts)
  admin/page.tsx          Admin workspace (requireAdmin)
  u/[userId]/page.tsx     Member workspace (the member, or the admin)
  error.tsx, global-error.tsx, not-found.tsx
  dev/reference, dev/views   Design system and every view on mock data (404 in production)
  api/
    sheets/               Work logs, Apps Script version 1 contract
    data/                 Shared records, Apps Script version 2
    agents/, agents/[key]/   Assistant catalog and runs (SSE)
    integrations/status/  Sheets, assistant and Meta status
    integrations/meta/webhook, publish, leads/backfill
proxy.ts                  Early redirect to /login (pages only; /api checks sessions itself)
components/
  HubApp.tsx              Data, viewer, URL view state, overlay host
  layout/                 AppShell, Sidebar, SyncLine, MobileNav, CommandPalette, menus, shortcuts
  views/                  One component per view (no props; read useHub())
  crm/, finance/, engineering/, studio/, overview/, settings/   Editors, sheets and parts per area
  ui/                     Primitives: cards, Dialog and Sheet, Menu, DataTable, form controls, toasts
  charts/Charts.tsx       Pill columns, gauges, hatched funnel, heatmap, sparklines
  print/                  PrintArea and the A4 TaxDocument (invoice and quotation)
lib/
  auth/                   Accounts, PBKDF2, signed session cookie, server-side checks (dal.ts)
  people.ts               Team directory: usernames, names, roles
  company.ts              COMPANY_EMAIL, company profile, mailto and compose links, signature
  settings.ts, gst.ts, format.ts, analytics.ts, export.ts
  data/                   ENTITIES registry, policy, sequences, remote client, migrations
  useHubData.ts           The HubData hook (local and shared modes)
  hub/                    Viewer type, HubContext, permissions (can), member scoping
  views.ts                VIEWS registry, navigation, URL helpers
  alerts.ts               Derived "needs attention" items
  server/                 Sheets client, records loader, feature flags (server-only)
  agents/                 Catalog, types, cost; registry, prompts, server runner (studio)
  integrations/           Channel, lead and ads types; Meta adapters (server-only)
  googleAppsScriptCode.ts The Apps Script template (version 2)
docs/                     Setup and reference
scripts/hash-password.mjs Password hashes for AUTH_HASH_*
```

## HubData and the ENTITIES registry

`lib/data/entities.ts` describes every collection once: its `localStorage` key, change event, sheet tab, ID prefix, field kinds (`string`, `number`, `boolean`, `json`) and owner field.

| Entity | Sheet tab | Owner field |
| --- | --- | --- |
| workLogs | Daily Work Log (version 1 actions) | developerName |
| deals | Deals | marketingPerson |
| interactions | Visits | marketingPerson |
| clients | Clients | salesOwner |
| projects | Projects | projectManager |
| payments | Invoices | (via client) |
| roster, repositories | Roster, Repositories | – |
| posts, campaigns | Content, Campaigns | – |
| drafts | Drafts | createdBy |
| activity | Activity | actorId |
| settings | Settings | – |

`encodeRow` and `decodeRow` turn records into sheet rows and back (JSON fields stringified, formula characters escaped, demo flags never written).

`useHubData()` (`lib/useHubData.ts`) returns `HubData`: every collection, `save<X>` and `delete<X>` for each, status (`ready`, `source`, `sharedMode`, `remoteVersion`, `syncState`, `unsynced`, `hasDemoData`), sync actions (`retrySync`, `pullFromSheet`, `pushLocalToShared`) and backup and reset. On mount it runs migrations, loads local data, asks the server for the script version, and then either seeds demo data (new browser, no shared sheet) or loads everything from the sheet. In shared mode saves are optimistic; a failure keeps the row and adds it to `unsynced`.

Members get a scoped copy (`lib/hub/scope.ts`): their own work logs, deals, visits, clients and so on. The admin gets everything.

## Policy

`lib/data/policy.ts` is the single source of truth, used by `/api/data` on the server and by `can()` (`lib/hub/permissions.ts`) for buttons in the browser.

| Records | admin | founder | marketing | developer |
| --- | --- | --- | --- | --- |
| deals, interactions | rw all | none | rw own | none |
| clients | rw | rw own (salesOwner) | none | none |
| projects | rw | rw own (projectManager) | none | none |
| payments | rw | read, own clients | none | none |
| roster, repositories | rw | read | read | read |
| posts, campaigns | rw | none | rw | none |
| drafts | rw all | rw own | rw own | none |
| activity | read all | read own | read own | read own |
| settings | rw | read | read | read |

Deletes follow writes, except clients, projects and payments (admin only). `enforceOwner` forces the owner field to the member on create and keeps it on update, so a member cannot reassign or take over a row.

## Apps Script version 2 protocol

Every request carries the token; the script compares it with the Script Property `AXORAA_TOKEN`.

| Request | Response |
| --- | --- |
| `GET` (no action) | Work-log rows, unchanged from version 1 |
| `POST {action:'ADD_LOG'}`, `POST {action:'SYNC_ALL'}` | Unchanged from version 1 |
| `GET action=VERSION` | `{ success, version: 2 }` (a version 1 script returns rows instead, which counts as version 1) |
| `GET action=LIST_ALL&tabs=Deals,Visits,...` | `{ success, tabs: { [tab]: { headers, rows } } }`; Activity returns its last 500 rows; dates as `yyyy-MM-dd` in IST |
| `GET action=LIST&tab=X` | `{ success, headers, rows }` |
| `POST {action:'UPSERT', tab, row, mode?, sequences?, activity?}` | `{ success, row, created, skipped }` |
| `POST {action:'BULK_UPSERT', tab, rows (≤200), mode?}` | `{ success, upserted, skipped }` |
| `POST {action:'DELETE', tab, id, activity?}` | `{ success, deleted }` |

Writes take the script lock (wait up to 20 seconds). Missing tabs and headers are created as plain text. Sequences (`LD-1001`, `CL-001`, `PR-001`, `AX/FY27/001`, `AXQ/FY27/001`) are filled inside the lock, only for blank or `auto` fields. The activity row is written in the same call as the change. Errors return `{ success: false, error }`.

## The /api/data contract

All requests need a session (401 `{ error: 'unauthorized' }`). Every error body is JSON `{ error }`.

| Request | Response |
| --- | --- |
| `GET ?status` | `{ configured, version: 1 \| 2 \| null }` |
| `GET ?entities=all` | `{ configured: true, version: 2, data, fetchedAt }`, only rows the viewer may read; not configured → `{ configured: false, version: null, data: {} }`; version 1 → 409 `script_outdated`; upstream → 502 |
| `GET ?entity=<name>` | `{ configured: true, rows }` |
| `POST { action:'upsert', entity, row }` | `{ success, row, created }`; policy, owner, sequences and activity applied on the server; 400, 403, 409, 413 `too_large`, 502 |
| `POST { action:'bulk_upsert', entity, rows (≤200) }` | `{ success, upserted, skipped }`; members insert-only, disallowed rows skipped |
| `POST { action:'delete', entity, id }` | `{ success }`, 403, 404, 502 |
| `POST { action:'append', entity:'activity', row }` | `{ success }`; the server sets who and when |

Bodies are limited to 512 KB (413). The server caches the full `LIST_ALL` for 30 seconds and clears it on every write. `/api/sheets` keeps its version 1 contract for work logs and adds `GET ?status`.

## Adding a view

1. Add the id to `ViewId` and a `VIEWS` entry in `lib/views.ts`: label, title, description, icon, group, roles, primary action and optional chord. Add it to the admin order or the member navigation lists.
2. Create `components/views/<Name>View.tsx`. It takes no props, reads `useHub()`, renders its own toolbar but not the page title.
3. Map the id to the component in `components/HubApp.tsx`. The shell wraps each view in `catchError`, so a crash shows "This view failed to load." with Retry and the rest of the app keeps working.

URLs: `?view=<id>` is the active view, `open=<kind>:<id>` opens a record panel, and `agent`, `ref`, `tab`, `q` and `filter` are read by the views that need them. Old ids (`eng_sop`, `my_log`, `sheets` and others) resolve through `LEGACY_VIEW_ALIASES`. Unknown or forbidden views fall back to the role's home.

## Overlays

Record panels and dialogs are opened with `openOverlay({ kind, ... })` from any view and mounted by the shell (`key = kind + ':' + id`). Each editor takes `{ overlay, onClose }`.

| Overlay | Component |
| --- | --- |
| worklog | engineering/WorkLogEditor |
| deal | crm/DealSheet |
| visit | crm/VisitEditor |
| quote_print | crm/QuotePrint |
| client, project | finance/ClientEditor, finance/ProjectEditor |
| invoice, invoice_print | finance/InvoiceEditor, finance/InvoicePrint |
| post, campaign | studio/PostEditor, studio/CampaignEditor |
| agent, draft | studio/AgentSheet, studio/DraftSheet |

## Integrations seam

`lib/integrations/types.ts` defines the adapter interfaces: `SocialChannel` (status, capabilities, publish, schedule, insights), `LeadSource` (status, fetchById, fetchSince) and `AdsReporter`. `lib/integrations/meta/registry.ts` returns the real Meta adapters when `readMetaConfig()` finds the required variables, and "not configured" null objects otherwise, so views and routes never branch on environment variables. Instagram publishing, LinkedIn and ads reporting are typed stubs; a real adapter can replace a stub without touching the UI. Meta modules import `server-only`.

## Feature flags

`lib/server/features.ts` computes `FeatureFlags` on the server (Sheets configured and version, assistant configured, Meta configured, publishing and leads enabled, missing variable names for the admin, token expiry) and passes them to the client. No secret is ever sent.

## The email rule

- `COMPANY_EMAIL` in `lib/company.ts` is the only place `info@axoraa.com` is written in code. Support and help links use it through `supportMailto()`.
- Anything a client sees (email cc, invoices, quotations, assistant signatures) uses `clientFacingEmail(settings.company)`, which is the company email from Settings, or `COMPANY_EMAIL` when blank.
- Client emails always cc the shared inbox and open in the person's chosen mail app (`composeHref`: default mail app, Gmail or Outlook). The hub never sends email itself.

Contact: info@axoraa.com.
