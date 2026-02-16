import { ok, parseBody, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { mergeLeadRecords } from "@/lib/server/import-engine";
import { mergeLeadSchema } from "@/lib/validation";

export async function POST(request: Request) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const body = await parseBody(request, mergeLeadSchema);

    const result = await mergeLeadRecords({
      workspaceId: session.workspaceId,
      primaryLeadId: body.primaryLeadId,
      mergedLeadId: body.mergedLeadId,
      chosenFields: body.chosenFields as Record<string, "existing" | "incoming" | string>,
      reason: body.reason ?? undefined,
      mergedById: session.userId,
    });

    return ok({
      mergeLogId: result.mergeLogId,
      ...result.payload,
    });
  });
}
