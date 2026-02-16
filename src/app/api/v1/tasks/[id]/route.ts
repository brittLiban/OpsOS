import { HttpError, ok, parseBody, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { idSchema, taskUpdateSchema } from "@/lib/validation";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const taskId = idSchema.parse((await params).id);
    const body = await parseBody(request, taskUpdateSchema);

    const existing = await prisma.task.findFirst({
      where: { id: taskId, workspaceId: session.workspaceId },
    });
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "Task not found");
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        leadId: body.leadId,
        clientId: body.clientId,
        taskTypeId: body.taskTypeId,
        title: body.title,
        description: body.description,
        status: body.status,
        priority: body.priority,
        dueAt: body.dueAt,
        assigneeId: body.assigneeId,
        completedAt: body.status === "DONE" ? new Date() : existing.completedAt,
      },
    });

    return ok(updated);
  });
}

export async function DELETE(_: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const taskId = idSchema.parse((await params).id);
    const existing = await prisma.task.findFirst({
      where: { id: taskId, workspaceId: session.workspaceId },
    });
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "Task not found");
    }
    await prisma.task.delete({ where: { id: taskId } });
    return ok({ deleted: true });
  });
}
