import { HttpError, ok, parseBody, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { syncEntityFieldValues, validateCustomFields } from "@/lib/server/custom-fields";
import { prisma } from "@/lib/server/prisma";
import { logTaskActivity } from "@/lib/server/task-activity";
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
      include: {
        taskType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "Task not found");
    }

    const nextLeadId = body.leadId !== undefined ? body.leadId : existing.leadId;
    const nextClientId = body.clientId !== undefined ? body.clientId : existing.clientId;
    if (nextLeadId && nextClientId) {
      throw new HttpError(400, "VALIDATION_ERROR", "Task cannot have both leadId and clientId");
    }

    const customFieldErrors = await validateCustomFields(
      session.workspaceId,
      "TASK",
      (body.customData ??
        (existing.customData as Record<string, unknown>) ??
        {}) as Record<string, unknown>,
    );
    if (customFieldErrors.length > 0) {
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid custom fields", customFieldErrors);
    }

    const nextStatus = body.status ?? existing.status;
    const completedAt =
      nextStatus === "DONE" ? existing.completedAt ?? new Date() : null;

    const action =
      nextStatus === "DONE" && existing.status !== "DONE"
        ? "COMPLETED"
        : existing.status === "DONE" && nextStatus !== "DONE"
          ? "REOPENED"
          : "UPDATED";

    const updated = await prisma.$transaction(async (tx) => {
      const task = await tx.task.update({
        where: { id: taskId },
        data: {
          leadId: body.leadId,
          clientId: body.clientId,
          taskTypeId: body.taskTypeId,
          title: body.title,
          description: body.description,
          customData: body.customData as never,
          status: body.status,
          priority: body.priority,
          dueAt: body.dueAt,
          assigneeId: body.assigneeId,
          completedAt,
        },
        include: {
          lead: {
            select: {
              id: true,
              businessName: true,
            },
          },
          client: {
            select: {
              id: true,
              name: true,
            },
          },
          taskType: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (body.customData) {
        await syncEntityFieldValues({
          tx,
          workspaceId: session.workspaceId,
          entityType: "TASK",
          entityId: task.id,
          values: body.customData,
        });
      }

      await logTaskActivity({
        tx,
        workspaceId: session.workspaceId,
        userId: session.userId,
        action,
        task,
      });

      return task;
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
      include: {
        taskType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "Task not found");
    }
    await prisma.$transaction(async (tx) => {
      await tx.entityFieldValue.deleteMany({
        where: {
          workspaceId: session.workspaceId,
          entityType: "TASK",
          entityId: existing.id,
        },
      });

      await logTaskActivity({
        tx,
        workspaceId: session.workspaceId,
        userId: session.userId,
        action: "DELETED",
        task: existing,
      });

      await tx.task.delete({ where: { id: taskId } });
    });
    return ok({ deleted: true });
  });
}
