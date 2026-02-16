import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionContext = vi.fn();
const workspaceUpdate = vi.fn();
const workspaceFindUnique = vi.fn();

const isSecretEncryptionConfigured = vi.fn();
const encryptSecretValue = vi.fn();
const toSecretHint = vi.fn();

const getStripeConfigSummaryForWorkspace = vi.fn();
const getWorkspaceStripeWebhookUrl = vi.fn();

vi.mock("@/lib/server/auth", () => ({
  getSessionContext,
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    workspace: {
      findUnique: workspaceFindUnique,
      update: workspaceUpdate,
    },
  },
}));

vi.mock("@/lib/server/secrets", () => ({
  isSecretEncryptionConfigured,
  encryptSecretValue,
  toSecretHint,
}));

vi.mock("@/lib/server/stripe", () => ({
  getStripeConfigSummaryForWorkspace,
  getWorkspaceStripeWebhookUrl,
}));

describe("stripe settings route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionContext.mockResolvedValue({
      workspaceId: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
      role: "OWNER",
    });
    workspaceFindUnique.mockResolvedValue({
      stripeSecretKeyEncrypted: null,
      stripeWebhookSecretEncrypted: null,
    });
    isSecretEncryptionConfigured.mockReturnValue(true);
    encryptSecretValue.mockImplementation((value: string) => `enc:${value}`);
    toSecretHint.mockImplementation((value: string) => `****${value.slice(-4)}`);
    getWorkspaceStripeWebhookUrl.mockReturnValue(
      "http://localhost:3000/api/v1/stripe/webhook?workspaceId=11111111-1111-4111-8111-111111111111",
    );
    getStripeConfigSummaryForWorkspace.mockResolvedValue({
      hasWorkspaceKeys: true,
      keyHint: "****1234",
      webhookHint: "****9876",
      configuredAt: new Date("2026-02-16T00:00:00.000Z"),
      usingEnvFallback: false,
    });
  });

  it("returns settings summary on GET", async () => {
    const { GET } = await import("@/app/api/v1/settings/stripe/route");
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.hasWorkspaceKeys).toBe(true);
    expect(json.data.webhookUrl).toContain("/api/v1/stripe/webhook?workspaceId=");
  });

  it("stores encrypted keys on PUT", async () => {
    workspaceUpdate.mockResolvedValue({});

    const { PUT } = await import("@/app/api/v1/settings/stripe/route");
    const response = await PUT(
      new Request("http://localhost/api/v1/settings/stripe", {
        method: "PUT",
        body: JSON.stringify({
          secretKey: "sk_test_abc1234",
          webhookSecret: "whsec_9876",
        }),
        headers: { "content-type": "application/json" },
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.hasWorkspaceKeys).toBe(true);
    expect(workspaceUpdate).toHaveBeenCalledTimes(1);
    expect(workspaceUpdate.mock.calls[0][0]).toMatchObject({
      where: { id: "11111111-1111-4111-8111-111111111111" },
      data: {
        stripeSecretKeyEncrypted: "enc:sk_test_abc1234",
        stripeWebhookSecretEncrypted: "enc:whsec_9876",
      },
    });
  });

  it("blocks non-owner users from PUT", async () => {
    getSessionContext.mockResolvedValue({
      workspaceId: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
      role: "MEMBER",
    });

    const { PUT } = await import("@/app/api/v1/settings/stripe/route");
    const response = await PUT(
      new Request("http://localhost/api/v1/settings/stripe", {
        method: "PUT",
        body: JSON.stringify({ secretKey: "sk_test_x" }),
        headers: { "content-type": "application/json" },
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error.code).toBe("FORBIDDEN");
    expect(workspaceUpdate).not.toHaveBeenCalled();
  });
});
