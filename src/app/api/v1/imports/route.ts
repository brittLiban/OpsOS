import { z } from "zod";
import { ok, parseBody, parseSearchParams, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { toPageParams } from "@/lib/server/pagination";
import { prisma } from "@/lib/server/prisma";
import { idSchema } from "@/lib/validation";

const importsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: z.string().optional(),
});

const deleteImportsSchema = z
  .object({
    deleteAll: z.boolean().optional(),
    ids: z.array(idSchema).optional(),
  })
  .refine((value) => value.deleteAll || (value.ids && value.ids.length > 0), {
    message: "Provide deleteAll=true or at least one import run id",
  });

export async function GET(request: Request) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const query = parseSearchParams(request, importsQuerySchema);
    const page = toPageParams(query);

    const where = {
      workspaceId: session.workspaceId,
      ...(query.status ? { status: query.status as never } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.importRun.findMany({
        where,
        skip: page.skip,
        take: page.take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.importRun.count({ where }),
    ]);

    return ok(
      {
        rows,
        page: page.page,
        pageSize: page.pageSize,
        total,
      },
      {
        page: page.page,
        pageSize: page.pageSize,
        total,
      },
    );
  });
}

export async function DELETE(request: Request) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const body = await parseBody(request, deleteImportsSchema);

    let targetIds: string[] = [];
    if (body.deleteAll) {
      const runs = await prisma.importRun.findMany({
        where: { workspaceId: session.workspaceId },
        select: { id: true },
      });
      targetIds = runs.map((run) => run.id);
    } else if (body.ids) {
      const runs = await prisma.importRun.findMany({
        where: {
          workspaceId: session.workspaceId,
          id: { in: body.ids },
        },
        select: { id: true },
      });
      targetIds = runs.map((run) => run.id);
    }

    if (targetIds.length === 0) {
      return ok({ deleted: true, count: 0, ids: [] });
    }

    const deleted = await prisma.importRun.deleteMany({
      where: {
        workspaceId: session.workspaceId,
        id: { in: targetIds },
      },
    });

    return ok({
      deleted: true,
      count: deleted.count,
      ids: targetIds,
    });
  });
}
