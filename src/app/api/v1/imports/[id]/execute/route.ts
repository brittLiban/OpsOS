import { ok, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { executeImportRun } from "@/lib/server/import-engine";
import { idSchema } from "@/lib/validation";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const importRunId = idSchema.parse((await params).id);
    const result = await executeImportRun({
      workspaceId: session.workspaceId,
      importRunId,
    });
    return ok(result);
  });
}
