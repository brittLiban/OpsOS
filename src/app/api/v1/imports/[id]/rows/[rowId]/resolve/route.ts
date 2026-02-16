import { ok, parseBody, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { resolveSoftDuplicate } from "@/lib/server/import-engine";
import { idSchema, resolveSoftDuplicateSchema } from "@/lib/validation";

type Params = {
  params: Promise<{
    id: string;
    rowId: string;
  }>;
};

export async function POST(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const routeParams = await params;
    const importRunId = idSchema.parse(routeParams.id);
    const rowId = idSchema.parse(routeParams.rowId);
    const body = await parseBody(request, resolveSoftDuplicateSchema);

    const result = await resolveSoftDuplicate({
      workspaceId: session.workspaceId,
      importRunId,
      rowId,
      action: body.action,
      matchedLeadId: body.matchedLeadId,
      chosenFields: body.chosenFields as Record<string, "existing" | "incoming" | string> | undefined,
      reason: body.reason,
      userId: session.userId,
    });

    return ok(result);
  });
}
