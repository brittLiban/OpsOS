import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionContext = vi.fn();
const billingRecordFindFirst = vi.fn();
const billingRecordUpdate = vi.fn();
const clientUpdate = vi.fn();

const hasStripeSecretKeyForWorkspace = vi.fn();
const getStripeClientForWorkspace = vi.fn();
const getAppBaseUrl = vi.fn();
const toStripeAmountCents = vi.fn();

const customerCreate = vi.fn();
const checkoutSessionCreate = vi.fn();

vi.mock("@/lib/server/auth", () => ({
  getSessionContext,
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    billingRecord: {
      findFirst: billingRecordFindFirst,
      update: billingRecordUpdate,
    },
    client: {
      update: clientUpdate,
    },
  },
}));

vi.mock("@/lib/server/stripe", () => ({
  hasStripeSecretKeyForWorkspace,
  getStripeClientForWorkspace,
  getAppBaseUrl,
  toStripeAmountCents,
}));

describe("billing stripe checkout route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getSessionContext.mockResolvedValue({
      workspaceId: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
    });

    hasStripeSecretKeyForWorkspace.mockResolvedValue(true);
    getAppBaseUrl.mockReturnValue("http://localhost:3000");
    toStripeAmountCents.mockImplementation((value) => Math.round(Number(value) * 100));

    getStripeClientForWorkspace.mockResolvedValue({
      customers: {
        create: customerCreate,
      },
      checkout: {
        sessions: {
          create: checkoutSessionCreate,
        },
      },
    });

    customerCreate.mockResolvedValue({ id: "cus_test_123" });
    checkoutSessionCreate.mockResolvedValue({
      id: "cs_test_123",
      payment_status: "unpaid",
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
    });
    clientUpdate.mockResolvedValue({});
    billingRecordUpdate.mockResolvedValue({});
  });

  it("creates a stripe checkout session for unpaid record", async () => {
    billingRecordFindFirst.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      workspaceId: "11111111-1111-4111-8111-111111111111",
      clientId: "44444444-4444-4444-8444-444444444444",
      billingTypeId: "55555555-5555-4555-8555-555555555555",
      amount: "120.50",
      currency: "usd",
      status: "DUE",
      notes: "Monthly retainer",
      client: {
        id: "44444444-4444-4444-8444-444444444444",
        name: "Acme Roofing",
        email: "owner@acme.com",
        phone: "15551112222",
        stripeCustomerId: null,
      },
      billingType: {
        id: "55555555-5555-4555-8555-555555555555",
        name: "MONTHLY",
      },
    });

    const { POST } = await import("@/app/api/v1/billing/[id]/checkout/route");
    const response = await POST(new Request("http://localhost/api/v1/billing/333/checkout"), {
      params: Promise.resolve({ id: "33333333-3333-4333-8333-333333333333" }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.checkoutSessionId).toBe("cs_test_123");
    expect(json.data.checkoutUrl).toContain("checkout.stripe.com");

    expect(customerCreate).toHaveBeenCalledTimes(1);
    expect(checkoutSessionCreate).toHaveBeenCalledTimes(1);
    expect(checkoutSessionCreate.mock.calls[0][0]).toMatchObject({
      mode: "payment",
      customer: "cus_test_123",
      metadata: {
        workspaceId: "11111111-1111-4111-8111-111111111111",
        billingRecordId: "33333333-3333-4333-8333-333333333333",
      },
    });
    expect(billingRecordUpdate).toHaveBeenCalledTimes(1);
  });

  it("returns conflict when record is already paid", async () => {
    billingRecordFindFirst.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      status: "PAID",
      amount: "120.50",
      currency: "usd",
      notes: null,
      client: {
        id: "44444444-4444-4444-8444-444444444444",
        name: "Acme Roofing",
        email: null,
        phone: null,
        stripeCustomerId: "cus_existing",
      },
      billingType: {
        id: "55555555-5555-4555-8555-555555555555",
        name: "MONTHLY",
      },
    });

    const { POST } = await import("@/app/api/v1/billing/[id]/checkout/route");
    const response = await POST(new Request("http://localhost/api/v1/billing/333/checkout"), {
      params: Promise.resolve({ id: "33333333-3333-4333-8333-333333333333" }),
    });
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error.code).toBe("CONFLICT");
    expect(checkoutSessionCreate).not.toHaveBeenCalled();
  });
});
