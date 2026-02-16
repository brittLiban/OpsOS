import { HttpError, ok, parseBody, parseSearchParams, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { syncEntityFieldValues, validateCustomFields } from "@/lib/server/custom-fields";
import { toPageParams } from "@/lib/server/pagination";
import { prisma } from "@/lib/server/prisma";
import { logTaskActivity } from "@/lib/server/task-activity";
import { paginationQuerySchema, taskCreateSchema } from "@/lib/validation";

export async function GET(request: Request) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const query = parseSearchParams(
      request,
      paginationQuerySchema.extend({
        status: taskCreateSchema.shape.status.optional(),
        dueFrom: taskCreateSchema.shape.dueAt.optional(),
        dueTo: taskCreateSchema.shape.dueAt.optional(),
        leadId: taskCreateSchema.shape.leadId.optional(),
        clientId: taskCreateSchema.shape.clientId.optional(),
      }),
    );
    const page = toPageParams(query);

    const where = {
      workspaceId: session.workspaceId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.leadId ? { leadId: query.leadId } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.dueFrom || query.dueTo
        ? {
            dueAt: {
              ...(query.dueFrom ? { gte: query.dueFrom } : {}),
              ...(query.dueTo ? { lte: query.dueTo } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip: page.skip,
        take: page.take,
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
        orderBy: { dueAt: "asc" },
      }),
      prisma.task.count({ where }),
    ]);

    return ok(
      {
        rows,
        page: page.page,
        pageSize: page.pageSize,
        total,
      },
      { page: page.page, pageSize: page.pageSize, total },
    );
  });
}

export async function POST(request: Request) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const body = await parseBody(request, taskCreateSchema);

    if (body.leadId && body.clientId) {
      throw new HttpError(400, "VALIDATION_ERROR", "Task cannot have both leadId and clientId");
    }

    const customFieldErrors = await validateCustomFields(
      session.workspaceId,
      "TASK",
      body.customData ?? {},
    );
    if (customFieldErrors.length > 0) {
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid custom fields", customFieldErrors);
    }

    const created = await prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          workspaceId: session.workspaceId,
          leadId: body.leadId,
          clientId: body.clientId,
          taskTypeId: body.taskTypeId,
          title: body.title,
          description: body.description,
          customData: (body.customData ?? {}) as never,
          status: body.status,
          priority: body.priority,
          dueAt: body.dueAt,
          assigneeId: body.assigneeId ?? session.userId,
          createdById: session.userId,
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

      await syncEntityFieldValues({
        tx,
        workspaceId: session.workspaceId,
        entityType: "TASK",
        entityId: task.id,
        values: body.customData ?? {},
      });

      await logTaskActivity({
        tx,
        workspaceId: session.workspaceId,
        userId: session.userId,
        action: "CREATED",
        task,
      });

      return task;
    });

    return ok(created);
  });
}
