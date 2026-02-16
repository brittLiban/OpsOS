import { ok, parseBody, parseSearchParams, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { syncEntityFieldValues, validateCustomFields } from "@/lib/server/custom-fields";
import { toPageParams } from "@/lib/server/pagination";
import { prisma } from "@/lib/server/prisma";
import { clientCreateSchema, paginationQuerySchema } from "@/lib/validation";

export async function GET(request: Request) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const query = parseSearchParams(
      request,
      paginationQuerySchema.extend({
        q: clientCreateSchema.shape.name.optional(),
        status: clientCreateSchema.shape.status.optional(),
      }),
    );
    const page = toPageParams(query);
    const where = {
      workspaceId: session.workspaceId,
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" as const } },
              { email: { contains: query.q, mode: "insensitive" as const } },
              {
                primaryContactName: {
                  contains: query.q,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status as never } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.client.findMany({
        where,
        include: {
          billingRecords: {
            where: {
              billingType: { key: "MONTHLY" },
            },
          },
        },
        skip: page.skip,
        take: page.take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.client.count({ where }),
    ]);

    const rowsWithMrr = rows.map((client) => {
      const mrrEstimate = client.billingRecords.reduce((sum, record) => {
        return sum + Number(record.amount);
      }, 0);
      return {
        ...client,
        mrrEstimate,
      };
    });

    return ok(
      {
        rows: rowsWithMrr,
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
    const body = await parseBody(request, clientCreateSchema);

    const customFieldErrors = await validateCustomFields(
      session.workspaceId,
      "CLIENT",
      body.customData ?? {},
    );
    if (customFieldErrors.length > 0) {
      return new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid custom fields",
            details: customFieldErrors,
          },
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          workspaceId: session.workspaceId,
          sourceLeadId: body.sourceLeadId,
          ownerId: body.ownerId,
          name: body.name,
          primaryContactName: body.primaryContactName,
          email: body.email,
          phone: body.phone,
          status: (body.status as never) ?? "ACTIVE",
          customData: (body.customData ?? {}) as never,
        },
      });

      await syncEntityFieldValues({
        tx,
        workspaceId: session.workspaceId,
        entityType: "CLIENT",
        entityId: client.id,
        values: body.customData ?? {},
      });

      return client;
    });

    return ok(created);
  });
}
