import { beforeEach, describe, expect, it, vi } from "vitest";

const hasStripeSecretKey = vi.fn();
const getStripeWebhookSecret = vi.fn();
const getStripeClient = vi.fn();
const getStripeClientForWorkspace = vi.fn();
const getStripeWebhookSecretForWorkspace = vi.fn();
const billingRecordUpdateMany = vi.fn();

const constructEvent = vi.fn();

vi.mock("@/lib/server/stripe", () => ({
  hasStripeSecretKey,
  getStripeWebhookSecret,
  getStripeClient,
  getStripeClientForWorkspace,
  getStripeWebhookSecretForWorkspace,
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    billingRecord: {
      updateMany: billingRecordUpdateMany,
    },
  },
}));

describe("stripe webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasStripeSecretKey.mockReturnValue(true);
    getStripeWebhookSecret.mockReturnValue("whsec_test");
    getStripeClient.mockReturnValue({
      webhooks: {
        constructEvent,
      },
    });
    getStripeClientForWorkspace.mockResolvedValue({
      webhooks: {
        constructEvent,
      },
    });
    getStripeWebhookSecretForWorkspace.mockResolvedValue("whsec_workspace");
    billingRecordUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("marks billing record paid on checkout.session.completed", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_123",
          payment_intent: "pi_test_123",
          payment_status: "paid",
          client_reference_id: "33333333-3333-4333-8333-333333333333",
          metadata: {
            billingRecordId: "33333333-3333-4333-8333-333333333333",
            workspaceId: "11111111-1111-4111-8111-111111111111",
          },
        },
      },
    });

    const { POST } = await import("@/app/api/v1/stripe/webhook/route");
    const response = await POST(
      new Request("http://localhost/api/v1/stripe/webhook", {
        method: "POST",
        body: JSON.stringify({ test: true }),
        headers: {
          "stripe-signature": "t=123,v1=abc",
        },
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.received).toBe(true);
    expect(billingRecordUpdateMany).toHaveBeenCalledTimes(1);
    expect(billingRecordUpdateMany.mock.calls[0][0]).toMatchObject({
      where: {
        id: "33333333-3333-4333-8333-333333333333",
        workspaceId: "11111111-1111-4111-8111-111111111111",
      },
      data: {
        status: "PAID",
        stripeCheckoutSessionId: "cs_test_123",
        stripePaymentIntentId: "pi_test_123",
        stripePaymentStatus: "paid",
      },
    });
  });

  it("returns 400 when stripe signature header is missing", async () => {
    const { POST } = await import("@/app/api/v1/stripe/webhook/route");
    const response = await POST(
      new Request("http://localhost/api/v1/stripe/webhook", {
        method: "POST",
        body: "{}",
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(constructEvent).not.toHaveBeenCalled();
  });
});
