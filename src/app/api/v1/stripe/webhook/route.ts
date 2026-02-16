import type Stripe from "stripe";
import { apiError, ok } from "@/lib/server/api";
import { prisma } from "@/lib/server/prisma";
import {
  getStripeClient,
  getStripeClientForWorkspace,
  getStripeWebhookSecret,
  getStripeWebhookSecretForWorkspace,
  hasStripeSecretKey,
} from "@/lib/server/stripe";
import { idSchema } from "@/lib/validation";

export const runtime = "nodejs";

function readMetadataString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const workspaceIdParam = requestUrl.searchParams.get("workspaceId");

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return apiError(400, "VALIDATION_ERROR", "Missing stripe-signature header");
  }

  let stripe: Stripe;
  let webhookSecret: string | null = null;
  let workspaceId: string | null = null;

  if (workspaceIdParam) {
    const parsedWorkspaceId = idSchema.safeParse(workspaceIdParam);
    if (!parsedWorkspaceId.success) {
      return apiError(400, "VALIDATION_ERROR", "Invalid workspaceId");
    }
    workspaceId = parsedWorkspaceId.data;
    try {
      stripe = await getStripeClientForWorkspace(workspaceId);
      webhookSecret = await getStripeWebhookSecretForWorkspace(workspaceId);
    } catch {
      return apiError(409, "CONFLICT", "Workspace Stripe keys are not configured correctly");
    }
    if (!webhookSecret) {
      return apiError(409, "CONFLICT", "Workspace Stripe webhook secret is not configured");
    }
  } else {
    if (!hasStripeSecretKey()) {
      return apiError(
        409,
        "CONFLICT",
        "Stripe is not configured. Add ?workspaceId=<id> to the webhook URL or set env fallback keys.",
      );
    }
    webhookSecret = getStripeWebhookSecret();
    if (!webhookSecret) {
      return apiError(
        409,
        "CONFLICT",
        "STRIPE_WEBHOOK_SECRET is not configured for env fallback",
      );
    }
    stripe = getStripeClient();
  }

  const payload = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Invalid Stripe webhook signature");
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const checkoutSession = event.data.object;
      const billingRecordId =
        readMetadataString(checkoutSession.metadata?.billingRecordId) ??
        readMetadataString(checkoutSession.client_reference_id);
      const metadataWorkspaceId =
        readMetadataString(checkoutSession.metadata?.workspaceId) ?? workspaceId;

      if (billingRecordId) {
        await prisma.billingRecord.updateMany({
          where: {
            id: billingRecordId,
            ...(metadataWorkspaceId ? { workspaceId: metadataWorkspaceId } : {}),
          },
          data: {
            status: "PAID",
            paidAt: new Date(),
            stripeCheckoutSessionId: checkoutSession.id,
            stripePaymentIntentId:
              typeof checkoutSession.payment_intent === "string"
                ? checkoutSession.payment_intent
                : null,
            stripePaymentStatus: checkoutSession.payment_status ?? "paid",
            stripeLastEventAt: new Date(),
          },
        });
      }
    }

    if (event.type === "checkout.session.expired") {
      const checkoutSession = event.data.object;
      await prisma.billingRecord.updateMany({
        where: { stripeCheckoutSessionId: checkoutSession.id },
        data: {
          stripePaymentStatus: checkoutSession.payment_status ?? "expired",
          stripeLastEventAt: new Date(),
        },
      });
    }

    if (event.type === "checkout.session.async_payment_failed") {
      const checkoutSession = event.data.object;
      await prisma.billingRecord.updateMany({
        where: { stripeCheckoutSessionId: checkoutSession.id },
        data: {
          status: "DUE",
          stripePaymentStatus: checkoutSession.payment_status ?? "failed",
          stripeLastEventAt: new Date(),
        },
      });
    }
  } catch {
    return apiError(500, "INTERNAL_ERROR", "Failed to process Stripe webhook");
  }

  return ok({ received: true });
}
