# Meta setup (Facebook Page, Lead Ads)

Everything Meta-related is off until it is configured, and the hub works fully without it. When it is set up:

- **Lead Ads**: a lead form submission on Facebook or Instagram becomes a deal in the Deal tracker, through a signed webhook.
- **Facebook Page publishing**: posts in the Content calendar can be published or scheduled on the Page, once `META_PUBLISH_ENABLED=true`.
- **Status**: Integrations shows the Page, Instagram, Lead Ads and Ads rows, the missing variables, the webhook URL and the token expiry.

**Not built yet**: Instagram publishing (copy the caption and post from the Instagram app) and ads reporting. Both are typed stubs that report "not built yet".

Tokens and secrets stay on the server. The browser never sees them.

## 1. Business app owned by the portfolio

1. In [Meta for Developers](https://developers.facebook.com/apps), **Create app**, type **Business**.
2. Connect it to the Axoraa **Business Portfolio** (the app must be owned by the portfolio, not by a personal account).
3. Add the products **Webhooks** and **Facebook Login for Business** (the latter only provides the permission set; nobody signs in with it).
4. Copy the **App ID** to `META_APP_ID` and the **App secret** (App settings > Basic) to `META_APP_SECRET`.
5. App settings > Advanced: turn on **Require App Secret**. Every Graph call from the hub sends `appsecret_proof` (HMAC-SHA256 of the access token, keyed by the app secret), so stolen tokens are useless without the secret.

## 2. System user and token

1. **Business Settings > Users > System users > Add**. Role: Admin (or Employee with the assets below).
2. **Assign assets** to the system user: the Axoraa Facebook Page (full control), the app, and the ad account if you have one.
3. **Generate new token** for the app with the permissions in the table below. Choose the **60-day** expiry.
4. Put the token in `META_SYSTEM_USER_TOKEN` and its expiry date in `META_SYSTEM_USER_TOKEN_EXPIRES_AT` (`YYYY-MM-DD`). The admin sees a warning on Integrations and the Command Center when 10 days or fewer are left; generate a new token and redeploy before then.
5. `META_PAGE_ID` is the Page's numeric ID (Page > About > Page transparency, or Business Settings > Pages).
6. Optional: `META_PAGE_ACCESS_TOKEN`. When empty, the server asks Graph for the Page token with the system-user token and keeps it in memory for an hour.

`META_BUSINESS_ID` (the portfolio ID) is stored for reference; a later token-refresh job will use it.

### Permissions

| Permission | Used for |
| --- | --- |
| `pages_show_list` | Finding the Page and showing it on Integrations |
| `pages_read_engagement` | Reading the Page name and its linked Instagram account |
| `pages_manage_metadata` | Subscribing the app to the Page's `leadgen` webhook |
| `pages_manage_ads` | Required by Meta alongside `leads_retrieval` to read leads |
| `leads_retrieval` | Reading lead form answers (webhook and "Fetch missed leads") |
| `pages_manage_posts` | Publishing and scheduling Page posts (only with `META_PUBLISH_ENABLED=true`) |
| `business_management` | Letting the system user act for the portfolio's assets |
| `instagram_basic`, `instagram_content_publish` | Not used yet (Instagram publishing is not built) |
| `ads_read` | Not used yet (ads reporting is not built) |

## 3. Live mode

Switch the app to **Live** (top bar of the app dashboard). Live mode needs a **Privacy policy URL** (App settings > Basic); use the Axoraa website's privacy page. In Development mode, webhooks only arrive for test leads from people with a role on the app.

## 4. Shared Google Sheets first

**Sheets version 2 must be live before you subscribe the webhook.** Leads are stored as deals in the shared sheet. Until Integrations reads "Connected with script version 2", the webhook answers 503 and Meta keeps retrying, so no lead is lost while you finish setup (see [SHEETS_SETUP.md](SHEETS_SETUP.md)).

## 5. Webhook

1. Generate a verify token of 32 or more random characters and set `META_WEBHOOK_VERIFY_TOKEN`:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

2. Add every Meta variable in Vercel (**Project > Settings > Environment Variables**), then **Redeploy**.
3. In the app: **Webhooks**, object **Page**, **Subscribe to this object**:
   - Callback URL: `https://<domain>/api/integrations/meta/webhook` (Integrations shows the exact URL with a Copy button)
   - Verify token: the `META_WEBHOOK_VERIFY_TOKEN` value
   - Then subscribe to the **`leadgen`** field.
4. Subscribe the app to the Page (once, with the Page token):

   ```bash
   curl -X POST "https://graph.facebook.com/v27.0/<page-id>/subscribed_apps?subscribed_fields=leadgen&access_token=<page-token>&appsecret_proof=<proof>"
   ```

   `<proof>` is `HMAC-SHA256(app secret, page token)` in hex:
   `node -e "console.log(require('crypto').createHmac('sha256', process.argv[1]).update(process.argv[2]).digest('hex'))" "<app-secret>" "<page-token>"`
5. Test with the [Lead Ads Testing Tool](https://developers.facebook.com/tools/lead-ads-testing). A deal named after the lead's company (or "Meta lead <date>") should appear in the Deal tracker within a minute, with source "Meta Lead Ad".

How the webhook behaves:

- It checks the `X-Hub-Signature-256` header over the raw body with the app secret, and rejects anything else with 403.
- It only accepts `page` events for `META_PAGE_ID`, and ignores leads older than 36 hours.
- Each lead becomes deal `deal_meta_<leadgen_id>`, written insert-only, so a retried or repeated event never creates a duplicate.
- It never logs lead answers.

## 6. Who gets new leads

**Settings > Pipeline > New Meta leads** sets the rule:

- **The administrator assigns each lead** (default): the deal has no owner and shows in the admin's Needs attention list.
- **Always assign to** one marketing person.
- **Alternate between the marketing team**.

## 7. Fetch missed leads

If the webhook was down or misconfigured, **Integrations > Meta > Fetch missed leads (last 7 days)** reads the forms listed in `META_LEADGEN_FORM_IDS` (comma-separated form IDs, found in Meta Business Suite > Instant forms) and adds any lead that is not already a deal. It goes through the same path as the webhook, so it never duplicates.

## 8. Publishing to the Page

Publishing stays off until `META_PUBLISH_ENABLED=true` is set (and Meta is configured). Then a Facebook post in the Content calendar shows **Publish to Facebook**, and **Schedule on Facebook** when the time is between 10 minutes and 30 days ahead. Images must be public `https` JPEG or PNG links; the server never downloads them. Instagram and LinkedIn posts offer **Copy caption** only.

## Variables

| Variable | Required |
| --- | --- |
| `META_APP_ID`, `META_APP_SECRET`, `META_PAGE_ID` | yes |
| `META_SYSTEM_USER_TOKEN` or `META_PAGE_ACCESS_TOKEN` | one of them |
| `META_SYSTEM_USER_TOKEN_EXPIRES_AT` | recommended |
| `META_WEBHOOK_VERIFY_TOKEN` | for Lead Ads |
| `META_LEADGEN_FORM_IDS` | for Fetch missed leads |
| `META_PUBLISH_ENABLED` | `true` to publish |
| `META_GRAPH_VERSION` | optional, default `v27.0` |
| `META_BUSINESS_ID`, `META_IG_USER_ID`, `META_AD_ACCOUNT_ID` | optional, reference and status only |

## Lead data and the DPDP Act

Lead form answers (names, phone numbers, email addresses) are personal data under India's Digital Personal Data Protection Act, 2023.

- Say on the lead form what the data is used for (being contacted by Axoraa about the service asked for) and link the privacy policy.
- Only the marketing team and the admin can read deals; the policy in `lib/data/policy.ts` applies to Meta leads like any other deal.
- Lead data lives in the shared Google Sheet. Keep the sheet's sharing limited to the Axoraa Google accounts that need it.
- The assistant never receives phone numbers or email addresses.
- Delete a lead's deal when the person asks you to, and remove it from the sheet's version history if needed.

## Version bumps

Meta retires Graph API versions about two years after release. When you change `META_GRAPH_VERSION`, re-test: Check connection on Integrations, a test lead through the Lead Ads Testing Tool, Fetch missed leads, and (if publishing is on) a scheduled post you then delete.

Contact: info@axoraa.com.
