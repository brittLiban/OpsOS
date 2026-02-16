import { HttpError, ok, parseBody, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { idSchema, stageUpdateSchema } from "@/lib/validation";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const stageId = idSchema.parse((await params).id);
    const body = await parseBody(request, stageUpdateSchema);

    const existing = await prisma.stage.findFirst({
      where: {
        id: stageId,
        workspaceId: session.workspaceId,
      },
    });
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "Stage not found");
    }

    const updated = await prisma.stage.update({
      where: { id: stageId },
      data: {
        name: body.name,
        sortOrder: body.sortOrder,
        color: body.color,
        stageType: body.stageType,
      },
    });

    return ok(updated);
  });
}

export async function DELETE(_: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const stageId = idSchema.parse((await params).id);

    const existing = await prisma.stage.findFirst({
      where: {
        id: stageId,
        workspaceId: session.workspaceId,
      },
      include: {
        leads: { take: 1 },
      },
    });
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "Stage not found");
    }
    if (existing.leads.length > 0) {
      throw new HttpError(409, "CONFLICT", "Cannot delete stage with leads");
    }

    await prisma.stage.delete({
      where: { id: stageId },
    });
    return ok({ deleted: true });
  });
}
