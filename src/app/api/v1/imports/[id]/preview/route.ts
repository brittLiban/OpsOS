import { z } from "zod";
import { ok, parseSearchParams, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { getImportPreview } from "@/lib/server/import-engine";
import { idSchema } from "@/lib/validation";

type Params = {
  params: Promise<{ id: string }>;
};

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export async function GET(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const importRunId = idSchema.parse((await params).id);
    const query = parseSearchParams(request, querySchema);

    const preview = await getImportPreview({
      workspaceId: session.workspaceId,
      importRunId,
      limit: query.limit,
    });

    return ok({
      rows: preview,
      count: preview.length,
    });
  });
}
