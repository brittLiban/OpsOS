import { ok, parseBody, parseSearchParams, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { toPageParams } from "@/lib/server/pagination";
import { prisma } from "@/lib/server/prisma";
import { scriptCreateSchema, scriptListQuerySchema } from "@/lib/validation";

export async function GET(request: Request) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const query = parseSearchParams(request, scriptListQuerySchema);
    const page = toPageParams(query);
    const tags = Array.isArray(query.tags)
      ? query.tags
      : typeof query.tags === "string"
        ? query.tags.split(",").filter(Boolean)
        : [];

    const where = {
      workspaceId: session.workspaceId,
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: "insensitive" as const } },
              { content: { contains: query.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(tags.length > 0 ? { tags: { hasSome: tags } } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.scriptTemplate.findMany({
        where,
        include: {
          category: true,
        },
        skip: page.skip,
        take: page.take,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.scriptTemplate.count({ where }),
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
    const body = await parseBody(request, scriptCreateSchema);

    const created = await prisma.scriptTemplate.create({
      data: {
        workspaceId: session.workspaceId,
        categoryId: body.categoryId,
        title: body.title,
        content: body.content,
        tags: body.tags,
        isActive: body.isActive,
        createdById: session.userId,
        updatedById: session.userId,
      },
    });

    return ok(created);
  });
}
