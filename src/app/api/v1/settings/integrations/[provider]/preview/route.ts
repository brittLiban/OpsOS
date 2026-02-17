import { HttpError, ok, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import {
  getIntegrationPreview,
  parseIntegrationProviderSlug,
} from "@/lib/server/integrations";

type Params = {
  params: Promise<{
    provider: string;
  }>;
};

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
    const preview = await getIntegrationPreview(session.workspaceId, provider);
    return ok(preview);
  });
}
