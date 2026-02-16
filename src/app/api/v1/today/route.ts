import { parseISO } from "date-fns";
import { ok, parseSearchParams, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { getTodayItems } from "@/lib/server/today";
import { todayQuerySchema } from "@/lib/validation";

export async function GET(request: Request) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const query = parseSearchParams(request, todayQuerySchema);
    const now = query.date ? parseISO(query.date) : new Date();

    const data = await getTodayItems({
      workspaceId: session.workspaceId,
      now,
      ownerId: query.ownerScope === "me" ? session.userId : null,
    });

    return ok(data);
  });
}
