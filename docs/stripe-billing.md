# Stripe Billing Setup

This guide enables real payment collection from the Billing module using Stripe Checkout.

## Required environment variables

Add to `.env`:

```env
NEXT_PUBLIC_APP_URL="http://localhost:3000"
OPSOS_SECRET_ENCRYPTION_KEY="change-this-to-a-long-random-secret"
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
```

`OPSOS_SECRET_ENCRYPTION_KEY` is required if you want to save Stripe keys inside Ops OS UI.
`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are optional fallback values from env.

## Install + schema update

If dependencies or schema changed:

```bash
npm install
npm run prisma:generate
npx prisma db push
```

`db push` adds Stripe linkage fields:
- `Client.stripeCustomerId`
- `BillingRecord.currency`
- `BillingRecord.stripeCheckoutSessionId`
- `BillingRecord.stripePaymentIntentId`
- `BillingRecord.stripePaymentStatus`
- `BillingRecord.stripeLastEventAt`

## Stripe dashboard setup

1. Create a Stripe account (test mode is fine for local).
2. In Ops OS, open `/settings/stripe`.
3. Paste both values in `/settings/stripe`:
   - Stripe API secret key (`sk_...`)
   - Stripe webhook secret (`whsec_...`)
4. Click `Save Stripe Keys`.
5. Copy the webhook URL shown on that page.

## Local webhook setup

Run your app:

```bash
npm run dev
```

In another terminal, forward Stripe events to Ops OS:

```bash
stripe listen --forward-to "http://localhost:3000/api/v1/stripe/webhook?workspaceId=<YOUR_WORKSPACE_ID>"
```

The CLI prints a webhook signing secret (`whsec_...`).
Paste it into `/settings/stripe` and save.

## Payment flow

1. Open `/billing`.
2. Create a billing record (`DUE`).
3. Click `Pay with Stripe`.
4. Complete checkout with a Stripe test card.
5. Webhook marks the billing record `PAID` and sets `paidAt`.

## Test card

- Number: `4242 4242 4242 4242`
- Any future expiry, any CVC, any ZIP.

## Notes

- If `STRIPE_SECRET_KEY` is missing, checkout endpoint returns a `409 CONFLICT`.
- If webhook URL is missing `workspaceId` and env fallback is not configured, webhook endpoint returns a `409 CONFLICT`.
- Manual `Mark Paid` still works and is not removed.
