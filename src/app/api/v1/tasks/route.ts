import { HttpError, ok, parseBody, parseSearchParams, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { toPageParams } from "@/lib/server/pagination";
import { prisma } from "@/lib/server/prisma";
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

    if (!body.leadId && !body.clientId) {
      throw new HttpError(400, "VALIDATION_ERROR", "Task requires leadId or clientId");
    }
    if (body.leadId && body.clientId) {
      throw new HttpError(400, "VALIDATION_ERROR", "Task cannot have both leadId and clientId");
    }

    const created = await prisma.task.create({
      data: {
        workspaceId: session.workspaceId,
        leadId: body.leadId,
        clientId: body.clientId,
        taskTypeId: body.taskTypeId,
        title: body.title,
        description: body.description,
        status: body.status,
        priority: body.priority,
        dueAt: body.dueAt,
        assigneeId: body.assigneeId ?? session.userId,
        createdById: session.userId,
      },
    });

    return ok(created);
  });
}
