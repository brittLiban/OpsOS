import { ok, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { getIntegrationSettingsSummary } from "@/lib/server/integrations";

export async function GET() {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const summary = await getIntegrationSettingsSummary(session.workspaceId);
    return ok(summary);
  });
}
