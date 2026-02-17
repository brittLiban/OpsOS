import { z } from "zod";
import {
  HttpError,
  ok,
  parseBody,
  withErrorHandling,
} from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import {
  clearWorkspaceProviderConfig,
  getIntegrationSettingsSummary,
  parseIntegrationProviderSlug,
  saveWorkspaceProviderConfig,
} from "@/lib/server/integrations";

type Params = {
  params: Promise<{
    provider: string;
  }>;
};

const providerConfigSchema = z.object({
  clientId: z.string().trim().min(1, "Client ID is required"),
  clientSecret: z.string().trim().min(1, "Client Secret is required"),
  redirectUri: z.string().trim().optional(),
});

function assertOwner(role: string) {
  if (role !== "OWNER") {
    throw new HttpError(403, "FORBIDDEN", "Only workspace owners can manage integrations");
  }
}

function toProviderOrThrow(provider: string) {
  try {
    return parseIntegrationProviderSlug(provider);
  } catch {
    throw new HttpError(400, "VALIDATION_ERROR", "Unsupported integration provider");
  }
}

export async function GET(_: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const provider = toProviderOrThrow((await params).provider);
    const summary = await getIntegrationSettingsSummary(session.workspaceId);
    const item = summary.providers.find((entry) => entry.provider === provider);
    if (!item) {
      throw new HttpError(404, "NOT_FOUND", "Integration provider not found");
    }
    return ok(item);
  });
}

export async function PUT(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    assertOwner(session.role);
    const provider = toProviderOrThrow((await params).provider);
    const body = await parseBody(request, providerConfigSchema);

    try {
      await saveWorkspaceProviderConfig({
        workspaceId: session.workspaceId,
        provider,
        clientId: body.clientId,
        clientSecret: body.clientSecret,
        redirectUri: body.redirectUri,
      });
    } catch (error) {
      throw new HttpError(
        400,
        "VALIDATION_ERROR",
        error instanceof Error ? error.message : "Failed to save provider config",
      );
    }

    const summary = await getIntegrationSettingsSummary(session.workspaceId);
    const item = summary.providers.find((entry) => entry.provider === provider);
    if (!item) {
      throw new HttpError(404, "NOT_FOUND", "Integration provider not found");
    }
    return ok(item);
  });
}

export async function DELETE(_: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    assertOwner(session.role);
    const provider = toProviderOrThrow((await params).provider);

    try {
      await clearWorkspaceProviderConfig(session.workspaceId, provider);
    } catch (error) {
      throw new HttpError(
        400,
        "VALIDATION_ERROR",
        error instanceof Error ? error.message : "Failed to clear provider config",
      );
    }

    return ok({ deleted: true });
  });
}
