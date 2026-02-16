import { HttpError, ok, parseBody, parseSearchParams, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { toPageParams } from "@/lib/server/pagination";
import { prisma } from "@/lib/server/prisma";
import {
  idSchema,
  paginationQuerySchema,
  touchpointCreateSchema,
} from "@/lib/validation";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const leadId = idSchema.parse((await params).id);
    const query = parseSearchParams(request, paginationQuerySchema);
    const page = toPageParams(query);

    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        workspaceId: session.workspaceId,
      },
    });
    if (!lead) {
      throw new HttpError(404, "NOT_FOUND", "Lead not found");
    }

    const [rows, total] = await Promise.all([
      prisma.touchpoint.findMany({
        where: {
          workspaceId: session.workspaceId,
          leadId,
        },
        skip: page.skip,
        take: page.take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.touchpoint.count({
        where: {
          workspaceId: session.workspaceId,
          leadId,
        },
      }),
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

export async function POST(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const leadId = idSchema.parse((await params).id);
    const body = await parseBody(request, touchpointCreateSchema);

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId: session.workspaceId },
    });
    if (!lead) {
      throw new HttpError(404, "NOT_FOUND", "Lead not found");
    }

    const touchpoint = await prisma.$transaction(async (tx) => {
      const created = await tx.touchpoint.create({
        data: {
          workspaceId: session.workspaceId,
          leadId,
          type: body.type,
          outcome: body.outcome ?? null,
          summary: body.summary ?? null,
          notes: body.notes ?? null,
          happenedAt: body.happenedAt ?? new Date(),
          nextFollowUpAt: body.nextFollowUpAt ?? null,
          createdById: session.userId,
        },
      });

      await tx.lead.update({
        where: { id: leadId },
        data: {
          lastContactedAt: created.happenedAt,
          ...(body.nextFollowUpAt ? { nextFollowUpAt: body.nextFollowUpAt } : {}),
        },
      });

      return created;
    });

    return ok(touchpoint);
  });
}
