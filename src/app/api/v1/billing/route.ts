import { Prisma } from "@prisma/client";
import { ok, parseBody, parseSearchParams, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { markOverdueBillingRecords } from "@/lib/server/billing";
import { toPageParams } from "@/lib/server/pagination";
import { prisma } from "@/lib/server/prisma";
import { billingCreateSchema, billingListQuerySchema } from "@/lib/validation";

export async function GET(request: Request) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const query = parseSearchParams(request, billingListQuerySchema);
    const page = toPageParams(query);

    await markOverdueBillingRecords(session.workspaceId);

    const where = {
      workspaceId: session.workspaceId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.billingTypeId ? { billingTypeId: query.billingTypeId } : {}),
      ...(query.dueFrom || query.dueTo
        ? {
            dueDate: {
              ...(query.dueFrom ? { gte: new Date(query.dueFrom) } : {}),
              ...(query.dueTo ? { lte: new Date(query.dueTo) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.billingRecord.findMany({
        where,
        include: { client: true, billingType: true },
        skip: page.skip,
        take: page.take,
        orderBy: { dueDate: "asc" },
      }),
      prisma.billingRecord.count({ where }),
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
    const body = await parseBody(request, billingCreateSchema);

    const created = await prisma.billingRecord.create({
      data: {
        workspaceId: session.workspaceId,
        clientId: body.clientId,
        billingTypeId: body.billingTypeId,
        amount: new Prisma.Decimal(body.amount),
        dueDate: body.dueDate,
        notes: body.notes ?? null,
        status: "DUE",
      },
    });

    return ok(created);
  });
}
