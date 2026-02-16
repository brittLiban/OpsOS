import { HttpError, ok, parseBody, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { idSchema, pipelineUpdateSchema } from "@/lib/validation";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const pipelineId = idSchema.parse((await params).id);
    const body = await parseBody(request, pipelineUpdateSchema);

    const existing = await prisma.pipeline.findFirst({
      where: { id: pipelineId, workspaceId: session.workspaceId },
    });
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "Pipeline not found");
    }

    if (body.isDefault) {
      await prisma.pipeline.updateMany({
        where: { workspaceId: session.workspaceId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.pipeline.update({
      where: { id: pipelineId },
      data: {
        name: body.name,
        isDefault: body.isDefault,
        isActive: body.isActive,
        sortOrder: body.sortOrder,
      },
    });

    return ok(updated);
  });
}

export async function DELETE(_: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const pipelineId = idSchema.parse((await params).id);

    const existing = await prisma.pipeline.findFirst({
      where: { id: pipelineId, workspaceId: session.workspaceId },
      include: { leads: { take: 1 } },
    });
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "Pipeline not found");
    }
    if (existing.leads.length > 0) {
      throw new HttpError(409, "CONFLICT", "Cannot delete pipeline with active leads");
    }

    await prisma.pipeline.delete({ where: { id: pipelineId } });
    return ok({ deleted: true });
  });
}
