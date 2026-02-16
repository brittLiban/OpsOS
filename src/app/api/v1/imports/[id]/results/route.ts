import { ImportRowStatus } from "@prisma/client";
import { HttpError, ok, parseSearchParams, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { toPageParams } from "@/lib/server/pagination";
import { prisma } from "@/lib/server/prisma";
import { idSchema, importResultsQuerySchema } from "@/lib/validation";

type Params = {
  params: Promise<{ id: string }>;
};

const statusMap: Record<"created" | "hard" | "soft" | "errors", ImportRowStatus[]> = {
  created: [ImportRowStatus.CREATED],
  hard: [ImportRowStatus.HARD_DUPLICATE],
  soft: [ImportRowStatus.SOFT_DUPLICATE],
  errors: [ImportRowStatus.ERROR],
};

export async function GET(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const importRunId = idSchema.parse((await params).id);
    const query = parseSearchParams(request, importResultsQuerySchema);
    const page = toPageParams(query);

    const run = await prisma.importRun.findFirst({
      where: { id: importRunId, workspaceId: session.workspaceId },
    });
    if (!run) {
      throw new HttpError(404, "NOT_FOUND", "Import run not found");
    }

    const where = {
      workspaceId: session.workspaceId,
      importRunId,
      status: { in: statusMap[query.tab] },
    };

    const [rows, total] = await Promise.all([
      prisma.importRow.findMany({
        where,
        skip: page.skip,
        take: page.take,
        orderBy: { rowNumber: "asc" },
      }),
      prisma.importRow.count({ where }),
    ]);

    return ok(
      { rows, page: page.page, pageSize: page.pageSize, total },
      { page: page.page, pageSize: page.pageSize, total },
    );
  });
}
