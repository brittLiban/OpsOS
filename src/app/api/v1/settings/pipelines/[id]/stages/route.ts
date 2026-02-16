import { HttpError, ok, parseBody, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { idSchema, stageCreateSchema } from "@/lib/validation";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const pipelineId = idSchema.parse((await params).id);
    const body = await parseBody(request, stageCreateSchema);

    const pipeline = await prisma.pipeline.findFirst({
      where: { id: pipelineId, workspaceId: session.workspaceId },
    });
    if (!pipeline) {
      throw new HttpError(404, "NOT_FOUND", "Pipeline not found");
    }

    const stage = await prisma.stage.create({
      data: {
        workspaceId: session.workspaceId,
        pipelineId,
        name: body.name,
        sortOrder: body.sortOrder,
        color: body.color,
        stageType: body.stageType,
      },
    });

    return ok(stage);
  });
}
