import { HttpError, ok, parseBody, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { idSchema, stageReorderSchema } from "@/lib/validation";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const pipelineId = idSchema.parse((await params).id);
    const body = await parseBody(request, stageReorderSchema);

    const stageCount = await prisma.stage.count({
      where: {
        workspaceId: session.workspaceId,
        pipelineId,
      },
    });
    if (stageCount !== body.stageIds.length) {
      throw new HttpError(409, "CONFLICT", "Invalid stage list for reorder");
    }

    await prisma.$transaction(
      body.stageIds.map((stageId, index) =>
        prisma.stage.updateMany({
          where: {
            id: stageId,
            workspaceId: session.workspaceId,
            pipelineId,
          },
          data: {
            sortOrder: index,
          },
        }),
      ),
    );

    return ok({ updated: true });
  });
}
