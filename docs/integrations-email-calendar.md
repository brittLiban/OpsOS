# Email + Calendar Integrations

Ops OS supports workspace-level OAuth integrations for:
- Google (Gmail + Google Calendar)
- Microsoft 365 (Outlook + Calendar)

## Route

- `Settings -> Integrations`
- URL: `/settings/integrations`
- Visual synced calendar: `/calendar`

## No Source-Code Setup Path

You can configure provider OAuth credentials directly in the app:
1. Open `/settings/integrations`
2. In the provider card, paste:
   - OAuth Client ID
   - OAuth Client Secret
   - optional Redirect URI override
3. Click `Save Provider Keys`
4. Click `Connect`

These provider keys are stored encrypted in the database.

## Required Environment Variables

At minimum, configure encryption:

```env
OPSOS_SECRET_ENCRYPTION_KEY="a-long-random-secret"
```

Provider env variables are optional fallback (if you do not save provider keys in UI):

```env
GOOGLE_OAUTH_CLIENT_ID=""
GOOGLE_OAUTH_CLIENT_SECRET=""
# optional override:
# GOOGLE_OAUTH_REDIRECT_URI="http://localhost:3000/api/v1/settings/integrations/google/callback"

MICROSOFT_OAUTH_CLIENT_ID=""
MICROSOFT_OAUTH_CLIENT_SECRET=""
# optional override:
# MICROSOFT_OAUTH_REDIRECT_URI="http://localhost:3000/api/v1/settings/integrations/microsoft/callback"
```

## Redirect URIs

Configure these in your OAuth app settings:

- Google callback:
  - `http://localhost:3000/api/v1/settings/integrations/google/callback`
- Microsoft callback:
  - `http://localhost:3000/api/v1/settings/integrations/microsoft/callback`

Use your production domain equivalents in production.

## What Gets Stored

Ops OS stores OAuth tokens encrypted using `OPSOS_SECRET_ENCRYPTION_KEY`.

## Validate Integration

1. Open `/settings/integrations`
2. Click `Connect` for a provider
3. Complete provider consent
4. Back in Ops OS, click `Preview Sync`
5. Confirm recent emails and upcoming events appear
6. Open `/calendar` and confirm month events are visible and grouped by provider

## Troubleshooting

- If you see a schema error:
  - `npm run prisma:generate`
  - `npx prisma db push`
- If connection fails:
  - verify callback URL exactly matches provider app settings
  - verify client ID/secret in `.env`
  - restart dev server after env changes
