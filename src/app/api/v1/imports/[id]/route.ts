import { HttpError, ok, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { idSchema } from "@/lib/validation";

type Params = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const importRunId = idSchema.parse((await params).id);

    const run = await prisma.importRun.findFirst({
      where: {
        id: importRunId,
        workspaceId: session.workspaceId,
      },
      select: { id: true },
    });
    if (!run) {
      throw new HttpError(404, "NOT_FOUND", "Import run not found");
    }

    await prisma.importRun.delete({
      where: { id: importRunId },
    });

    return ok({ deleted: true, id: importRunId });
  });
}
