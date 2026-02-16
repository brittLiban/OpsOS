import Stripe from "stripe";
import { prisma } from "@/lib/server/prisma";
import { decryptSecretValue } from "@/lib/server/secrets";

const stripeClientBySecret = new Map<string, Stripe>();

type WorkspaceStripeSecrets = {
  secretKey: string | null;
  webhookSecret: string | null;
  source: "workspace" | "env" | "none";
};

function envFallbackSecrets(): WorkspaceStripeSecrets {
  return {
    secretKey: process.env.STRIPE_SECRET_KEY ?? null,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? null,
    source: process.env.STRIPE_SECRET_KEY || process.env.STRIPE_WEBHOOK_SECRET ? "env" : "none",
  };
}

function isStripeWorkspaceSchemaError(error: unknown) {
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

function getOrCreateStripeClient(secretKey: string) {
  const existing = stripeClientBySecret.get(secretKey);
  if (existing) {
    return existing;
  }
  const created = new Stripe(secretKey);
  stripeClientBySecret.set(secretKey, created);
  return created;
}

export function hasStripeSecretKey() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET ?? null;
}

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  return getOrCreateStripeClient(secretKey);
}

async function resolveWorkspaceStripeSecrets(workspaceId: string): Promise<WorkspaceStripeSecrets> {
  let workspace:
    | {
        stripeSecretKeyEncrypted: string | null;
        stripeWebhookSecretEncrypted: string | null;
      }
    | null = null;
  try {
    workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        stripeSecretKeyEncrypted: true,
        stripeWebhookSecretEncrypted: true,
      },
    });
  } catch (error) {
    if (isStripeWorkspaceSchemaError(error)) {
      return envFallbackSecrets();
    }
    throw error;
  }

  let workspaceSecretKey: string | null = null;
  let workspaceWebhookSecret: string | null = null;
  try {
    workspaceSecretKey = workspace?.stripeSecretKeyEncrypted
      ? decryptSecretValue(workspace.stripeSecretKeyEncrypted)
      : null;
    workspaceWebhookSecret = workspace?.stripeWebhookSecretEncrypted
      ? decryptSecretValue(workspace.stripeWebhookSecretEncrypted)
      : null;
  } catch {
    return envFallbackSecrets();
  }

  if (workspaceSecretKey || workspaceWebhookSecret) {
    return {
      secretKey: workspaceSecretKey,
      webhookSecret: workspaceWebhookSecret,
      source: "workspace",
    };
  }

  return envFallbackSecrets();
}

export async function getStripeClientForWorkspace(workspaceId: string) {
  const secrets = await resolveWorkspaceStripeSecrets(workspaceId);
  if (!secrets.secretKey) {
    throw new Error("Stripe secret key is not configured for this workspace");
  }
  return getOrCreateStripeClient(secrets.secretKey);
}

export async function getStripeWebhookSecretForWorkspace(workspaceId: string) {
  const secrets = await resolveWorkspaceStripeSecrets(workspaceId);
  return secrets.webhookSecret;
}

export async function hasStripeSecretKeyForWorkspace(workspaceId: string) {
  const secrets = await resolveWorkspaceStripeSecrets(workspaceId);
  return Boolean(secrets.secretKey);
}

export async function getStripeConfigSummaryForWorkspace(workspaceId: string) {
  let workspace:
    | {
        stripeSecretKeyEncrypted: string | null;
        stripeWebhookSecretEncrypted: string | null;
        stripeKeyHint: string | null;
        stripeWebhookHint: string | null;
        stripeConfiguredAt: Date | null;
      }
    | null = null;
  try {
    workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        stripeSecretKeyEncrypted: true,
        stripeWebhookSecretEncrypted: true,
        stripeKeyHint: true,
        stripeWebhookHint: true,
        stripeConfiguredAt: true,
      },
    });
  } catch (error) {
    if (isStripeWorkspaceSchemaError(error)) {
      return {
        hasWorkspaceKeys: false,
        keyHint: null,
        webhookHint: null,
        configuredAt: null,
        usingEnvFallback: Boolean(process.env.STRIPE_SECRET_KEY),
      };
    }
    throw error;
  }

  return {
    hasWorkspaceKeys: Boolean(
      workspace?.stripeSecretKeyEncrypted && workspace?.stripeWebhookSecretEncrypted,
    ),
    keyHint: workspace?.stripeKeyHint ?? null,
    webhookHint: workspace?.stripeWebhookHint ?? null,
    configuredAt: workspace?.stripeConfiguredAt ?? null,
    usingEnvFallback: !workspace?.stripeSecretKeyEncrypted && Boolean(process.env.STRIPE_SECRET_KEY),
  };
}

export function getWorkspaceStripeWebhookUrl(workspaceId: string) {
  return `${getAppBaseUrl()}/api/v1/stripe/webhook?workspaceId=${workspaceId}`;
}

export function getAppBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}

export function toStripeAmountCents(amount: unknown) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.round(numeric * 100);
}
