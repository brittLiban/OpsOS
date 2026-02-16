import { ok, parseBody, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { setImportColumnMapping } from "@/lib/server/import-engine";
import { idSchema, importMappingSchema } from "@/lib/validation";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const importRunId = idSchema.parse((await params).id);
    const body = await parseBody(request, importMappingSchema);

    await setImportColumnMapping({
      workspaceId: session.workspaceId,
      importRunId,
      mapping: body.mapping,
    });

    return ok({ mapped: true });
  });
}
