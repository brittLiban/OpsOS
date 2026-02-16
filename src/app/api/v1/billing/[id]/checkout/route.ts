import { HttpError, ok, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import {
  getAppBaseUrl,
  getStripeClientForWorkspace,
  hasStripeSecretKeyForWorkspace,
  toStripeAmountCents,
} from "@/lib/server/stripe";
import { idSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    if (!(await hasStripeSecretKeyForWorkspace(session.workspaceId))) {
      throw new HttpError(
        409,
        "CONFLICT",
        "Stripe is not configured for this workspace. Add keys in Settings > Stripe.",
      );
    }

    const id = idSchema.parse((await params).id);

    const record = await prisma.billingRecord.findFirst({
      where: { id, workspaceId: session.workspaceId },
      include: {
        client: true,
        billingType: true,
      },
    });

    if (!record) {
      throw new HttpError(404, "NOT_FOUND", "Billing record not found");
    }

    if (record.status === "PAID") {
      throw new HttpError(409, "CONFLICT", "Billing record is already paid");
    }

    const unitAmount = toStripeAmountCents(record.amount);
    if (unitAmount <= 0) {
      throw new HttpError(409, "CONFLICT", "Billing amount must be greater than zero");
    }

    const stripe = await getStripeClientForWorkspace(session.workspaceId);

    let stripeCustomerId = record.client.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: record.client.name,
        email: record.client.email ?? undefined,
        phone: record.client.phone ?? undefined,
        metadata: {
          workspaceId: session.workspaceId,
          clientId: record.client.id,
        },
      });
      stripeCustomerId = customer.id;
      await prisma.client.update({
        where: { id: record.client.id },
        data: { stripeCustomerId },
      });
    }

    const appBaseUrl = getAppBaseUrl();

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: stripeCustomerId,
      success_url: `${appBaseUrl}/billing?checkout=success&record=${record.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl}/billing?checkout=cancel&record=${record.id}`,
      client_reference_id: record.id,
      metadata: {
        workspaceId: session.workspaceId,
        billingRecordId: record.id,
        clientId: record.client.id,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: (record.currency || "usd").toLowerCase(),
            unit_amount: unitAmount,
            product_data: {
              name: `${record.billingType.name} - ${record.client.name}`,
              description: record.notes ?? undefined,
            },
          },
        },
      ],
    });

    await prisma.billingRecord.update({
      where: { id: record.id },
      data: {
        stripeCheckoutSessionId: checkoutSession.id,
        stripePaymentStatus: checkoutSession.payment_status ?? null,
      },
    });

    return ok({
      billingRecordId: record.id,
      checkoutSessionId: checkoutSession.id,
      checkoutUrl: checkoutSession.url,
    });
  });
}
