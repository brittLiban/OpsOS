import { HttpError, ok, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import {
  disconnectIntegration,
  getIntegrationSettingsSummary,
  parseIntegrationProviderSlug,
} from "@/lib/server/integrations";

type Params = {
  params: Promise<{
    provider: string;
  }>;
};

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

export async function DELETE(_: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    assertOwner(session.role);
    const provider = toProviderOrThrow((await params).provider);
    await disconnectIntegration(session.workspaceId, provider);
    return ok({ deleted: true });
  });
}
