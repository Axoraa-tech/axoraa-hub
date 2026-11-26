# QA checklist

Static and API checks were run by integration-qa. Browser checks were not run (no signed-in session, dev server down).

| Check | Result |
|---|---|
| next typegen, tsc --noEmit | pass, 0 errors |
| eslint . | pass, 0 problems |
| next build | pass |
| No imports of deleted files (ExecutiveViews, WorkLogModal, ConfigSheet, UserGuideSheet, components/marketing, GoogleSheetSyncModal) | pass |
| Every view id in lib/views.ts is mapped in HubApp | pass |
| info@axoraa.com only in lib/company.ts | pass |
| No alert( / confirm( except the useConfirm hook | pass |
| No IBM Plex or cobalt left | pass |
| GET /login | 200 |
| /api/data, /api/agents, /api/integrations/status without session | 401 |
| Meta webhook GET without or with a wrong verify token | 403 |
| /dev/views | harness added; dev only (notFound in production, proxy redirects when logged out) |

## Files changed outside QA ownership
- lib/googleSheetsService.ts: CSV filename date uses todayKeyIST (IST) instead of toISOString.

## Check by hand in the browser (/dev/views, dev server)
- Each role x view at 375, 1024, 1440, light and dark; no horizontal page scroll (PeriodPicker is 376px wide: scroll wrapper only in overview views).
- Every overlay opens from its trigger; invoice and quotation print preview.
- Keyboard: Ctrl/Cmd+K, Menu, Sheet, Dialog, table sort, board "Move to stage".
- Today on member dashboards plus Engineering hero: two ink cards.
- Local-mode create, edit, delete and Undo per entity; v1 snapshot migration; emptying deals does not re-seed.

## Owner actions
- Redeploy Apps Script v2 (docs/SHEETS_SETUP.md).
- Set ANTHROPIC_API_KEY for the Assistant.
- Add /manifest.webmanifest to the proxy.ts public list (logged-out requests redirect to /login).
