import { HttpError, ok, parseBody, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { idSchema, scriptUpdateSchema } from "@/lib/validation";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const scriptId = idSchema.parse((await params).id);
    const body = await parseBody(request, scriptUpdateSchema);

    const existing = await prisma.scriptTemplate.findFirst({
      where: {
        id: scriptId,
        workspaceId: session.workspaceId,
      },
    });
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "Script not found");
    }

    const updated = await prisma.scriptTemplate.update({
      where: { id: scriptId },
      data: {
        categoryId: body.categoryId,
        title: body.title,
        content: body.content,
        tags: body.tags,
        isActive: body.isActive,
        updatedById: session.userId,
      },
    });

    return ok(updated);
  });
}

export async function DELETE(_: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const scriptId = idSchema.parse((await params).id);
    const existing = await prisma.scriptTemplate.findFirst({
      where: { id: scriptId, workspaceId: session.workspaceId },
    });
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "Script not found");
    }
    await prisma.scriptTemplate.delete({
      where: { id: scriptId },
    });
    return ok({ deleted: true });
  });
}
