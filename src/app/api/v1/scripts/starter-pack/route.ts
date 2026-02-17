import { ok, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { installStarterScriptPack } from "@/lib/server/script-starter-pack";

export async function POST() {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const result = await installStarterScriptPack({
      workspaceId: session.workspaceId,
      userId: session.userId,
    });

    return ok(result);
  });
}
