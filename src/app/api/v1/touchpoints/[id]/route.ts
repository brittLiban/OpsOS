import { HttpError, ok, parseBody, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { idSchema, touchpointUpdateSchema } from "@/lib/validation";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const touchpointId = idSchema.parse((await params).id);
    const body = await parseBody(request, touchpointUpdateSchema);

    const existing = await prisma.touchpoint.findFirst({
      where: { id: touchpointId, workspaceId: session.workspaceId },
    });
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "Touchpoint not found");
    }

    const updated = await prisma.touchpoint.update({
      where: { id: touchpointId },
      data: {
        type: body.type,
        outcome: body.outcome,
        summary: body.summary,
        notes: body.notes,
        happenedAt: body.happenedAt ?? undefined,
        nextFollowUpAt: body.nextFollowUpAt,
      },
    });

    return ok(updated);
  });
}

export async function DELETE(_: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const touchpointId = idSchema.parse((await params).id);

    const existing = await prisma.touchpoint.findFirst({
      where: { id: touchpointId, workspaceId: session.workspaceId },
    });
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "Touchpoint not found");
    }

    await prisma.touchpoint.delete({
      where: { id: touchpointId },
    });

    return ok({ deleted: true });
  });
}
