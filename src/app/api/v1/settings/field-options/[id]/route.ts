import { HttpError, ok, parseBody, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { customFieldOptionUpdateSchema, idSchema } from "@/lib/validation";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const optionId = idSchema.parse((await params).id);
    const body = await parseBody(request, customFieldOptionUpdateSchema);

    const option = await prisma.customFieldOption.findFirst({
      where: {
        id: optionId,
        customField: {
          workspaceId: session.workspaceId,
        },
      },
    });
    if (!option) {
      throw new HttpError(404, "NOT_FOUND", "Option not found");
    }

    const updated = await prisma.customFieldOption.update({
      where: { id: optionId },
      data: {
        label: body.label,
        value: body.value,
        sortOrder: body.sortOrder,
        isActive: body.isActive,
      },
    });

    return ok(updated);
  });
}

export async function DELETE(_: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const optionId = idSchema.parse((await params).id);

    const option = await prisma.customFieldOption.findFirst({
      where: {
        id: optionId,
        customField: {
          workspaceId: session.workspaceId,
        },
      },
    });
    if (!option) {
      throw new HttpError(404, "NOT_FOUND", "Option not found");
    }

    await prisma.customFieldOption.delete({
      where: { id: optionId },
    });
    return ok({ deleted: true });
  });
}
