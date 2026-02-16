import { ok, parseBody, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { pipelineCreateSchema } from "@/lib/validation";

export async function GET() {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const pipelines = await prisma.pipeline.findMany({
      where: { workspaceId: session.workspaceId },
      include: {
        stages: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { sortOrder: "asc" },
    });
    return ok(pipelines);
  });
}

export async function POST(request: Request) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const body = await parseBody(request, pipelineCreateSchema);

    if (body.isDefault) {
      await prisma.pipeline.updateMany({
        where: { workspaceId: session.workspaceId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const pipeline = await prisma.pipeline.create({
      data: {
        workspaceId: session.workspaceId,
        name: body.name,
        isDefault: body.isDefault ?? false,
        sortOrder: body.sortOrder ?? 0,
      },
    });

    return ok(pipeline);
  });
}
