import { z } from "zod";
import { HttpError, ok, parseBody, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { isSecretEncryptionConfigured, encryptSecretValue, toSecretHint } from "@/lib/server/secrets";
import { getStripeConfigSummaryForWorkspace, getWorkspaceStripeWebhookUrl } from "@/lib/server/stripe";

const stripeSettingsSchema = z.object({
  secretKey: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || value.startsWith("sk_"), "Secret key must start with sk_"),
  webhookSecret: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => !value || value.startsWith("whsec_"),
      "Webhook secret must start with whsec_",
    ),
});

function assertOwner(role: string) {
  if (role !== "OWNER") {
    throw new HttpError(403, "FORBIDDEN", "Only workspace owners can manage Stripe keys");
  }
}

function isStripeSchemaMismatchError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.message.includes("stripeSecretKeyEncrypted") ||
    error.message.includes("stripeWebhookSecretEncrypted") ||
    error.message.includes("stripeKeyHint") ||
    error.message.includes("stripeWebhookHint") ||
    error.message.includes("stripeConfiguredAt")
  );
}

function throwSchemaSyncError() {
  throw new HttpError(
    409,
    "CONFLICT",
    "Stripe settings schema is not synced. Run `npm run prisma:generate`, `npx prisma db push --accept-data-loss`, then restart dev server.",
  );
}

export async function GET() {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const summary = await getStripeConfigSummaryForWorkspace(session.workspaceId);

    return ok({
      ...summary,
      encryptionReady: isSecretEncryptionConfigured(),
      webhookUrl: getWorkspaceStripeWebhookUrl(session.workspaceId),
    });
  });
}

export async function PUT(request: Request) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    assertOwner(session.role);

    if (!isSecretEncryptionConfigured()) {
      throw new HttpError(
        409,
        "CONFLICT",
        "Online key storage is not available until OPSOS_SECRET_ENCRYPTION_KEY is configured",
      );
    }

    const body = await parseBody(request, stripeSettingsSchema);
    if (!body.secretKey && !body.webhookSecret) {
      throw new HttpError(
        400,
        "VALIDATION_ERROR",
        "Provide at least one value: secretKey or webhookSecret",
      );
    }

    let existing: {
      stripeSecretKeyEncrypted: string | null;
      stripeWebhookSecretEncrypted: string | null;
    } | null = null;
    try {
      existing = await prisma.workspace.findUnique({
        where: { id: session.workspaceId },
        select: {
          stripeSecretKeyEncrypted: true,
          stripeWebhookSecretEncrypted: true,
        },
      });
    } catch (error) {
      if (isStripeSchemaMismatchError(error)) {
        throwSchemaSyncError();
      }
      throw error;
    }
    const hasFinalSecret = Boolean(body.secretKey || existing?.stripeSecretKeyEncrypted);
    const hasFinalWebhook = Boolean(body.webhookSecret || existing?.stripeWebhookSecretEncrypted);
    if (!hasFinalSecret || !hasFinalWebhook) {
      throw new HttpError(
        400,
        "VALIDATION_ERROR",
        "Both Stripe secret key and webhook secret are required",
      );
    }

    const data: {
      stripeSecretKeyEncrypted?: string;
      stripeWebhookSecretEncrypted?: string;
      stripeKeyHint?: string;
      stripeWebhookHint?: string;
      stripeConfiguredAt: Date;
    } = {
      stripeConfiguredAt: new Date(),
    };

    if (body.secretKey) {
      data.stripeSecretKeyEncrypted = encryptSecretValue(body.secretKey);
      data.stripeKeyHint = toSecretHint(body.secretKey);
    }
    if (body.webhookSecret) {
      data.stripeWebhookSecretEncrypted = encryptSecretValue(body.webhookSecret);
      data.stripeWebhookHint = toSecretHint(body.webhookSecret);
    }

    try {
      await prisma.workspace.update({
        where: { id: session.workspaceId },
        data,
      });
    } catch (error) {
      if (isStripeSchemaMismatchError(error)) {
        throwSchemaSyncError();
      }
      throw error;
    }

    const summary = await getStripeConfigSummaryForWorkspace(session.workspaceId);
    return ok({
      ...summary,
      encryptionReady: true,
      webhookUrl: getWorkspaceStripeWebhookUrl(session.workspaceId),
    });
  });
}

export async function DELETE() {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    assertOwner(session.role);

    try {
      await prisma.workspace.update({
        where: { id: session.workspaceId },
        data: {
          stripeSecretKeyEncrypted: null,
          stripeWebhookSecretEncrypted: null,
          stripeKeyHint: null,
          stripeWebhookHint: null,
          stripeConfiguredAt: null,
        },
      });
    } catch (error) {
      if (isStripeSchemaMismatchError(error)) {
        throwSchemaSyncError();
      }
      throw error;
    }

    return ok({ deleted: true });
  });
}
