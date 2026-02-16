import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getSessionContext } from "@/lib/server/auth";
import { ok, parseBody, parseSearchParams, withErrorHandling } from "@/lib/server/api";
import { syncEntityFieldValues, validateCustomFields } from "@/lib/server/custom-fields";
import { buildLeadSearchWhere } from "@/lib/server/lead-search";
import { normalizeLeadPayload } from "@/lib/server/normalization";
import { toPageParams } from "@/lib/server/pagination";
import { prisma } from "@/lib/server/prisma";
import { idSchema, leadCreateSchema, leadListQuerySchema } from "@/lib/validation";

const deleteLeadsSchema = z
  .object({
    deleteAll: z.boolean().optional(),
    ids: z.array(idSchema).optional(),
  })
  .refine((value) => value.deleteAll || (value.ids && value.ids.length > 0), {
    message: "Provide deleteAll=true or at least one lead id",
  });

export async function GET(request: Request) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const query = parseSearchParams(request, leadListQuerySchema);
    const page = toPageParams(query);
    const where = buildLeadSearchWhere({
      workspaceId: session.workspaceId,
      q: query.q,
      pipelineId: query.pipelineId,
      stageId: query.stageId,
      niche: query.niche,
      source: query.source,
    });

    const [rows, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip: page.skip,
        take: page.take,
        orderBy: { createdAt: "desc" },
        include: {
          stage: true,
          pipeline: true,
          owner: true,
          touchpoints: {
            orderBy: { happenedAt: "desc" },
            take: 1,
          },
        },
      }),
      prisma.lead.count({ where }),
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
    const body = await parseBody(request, leadCreateSchema);

    const customFieldErrors = await validateCustomFields(
      session.workspaceId,
      "LEAD",
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

    const normalized = normalizeLeadPayload({
      email: body.email,
      phone: body.phone,
      website: body.website,
      businessName: body.businessName,
      city: body.city,
    });

    const lead = await prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: {
          workspaceId: session.workspaceId,
          pipelineId: body.pipelineId,
          stageId: body.stageId,
          ownerId: body.ownerId,
          businessName: body.businessName,
          contactName: body.contactName,
          email: body.email,
          phone: body.phone,
          website: body.website,
          city: body.city,
          source: body.source,
          niche: body.niche,
          leadValue:
            body.leadValue === null || body.leadValue === undefined
              ? null
              : new Prisma.Decimal(body.leadValue),
          nextFollowUpAt: body.nextFollowUpAt ?? null,
          customData: (body.customData ?? {}) as never,
          ...normalized,
        },
      });

      await syncEntityFieldValues({
        tx,
        workspaceId: session.workspaceId,
        entityType: "LEAD",
        entityId: created.id,
        values: body.customData ?? {},
      });

      return created;
    });

    return ok(lead);
  });
}

export async function DELETE(request: Request) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const body = await parseBody(request, deleteLeadsSchema);

    let targetIds: string[] = [];
    if (body.deleteAll) {
      const leads = await prisma.lead.findMany({
        where: { workspaceId: session.workspaceId },
        select: { id: true },
      });
      targetIds = leads.map((lead) => lead.id);
    } else if (body.ids) {
      const leads = await prisma.lead.findMany({
        where: {
          workspaceId: session.workspaceId,
          id: { in: body.ids },
        },
        select: { id: true },
      });
      targetIds = leads.map((lead) => lead.id);
    }

    if (targetIds.length === 0) {
      return ok({ deleted: true, count: 0, ids: [] });
    }

    const deletedCount = await prisma.$transaction(async (tx) => {
      await tx.entityFieldValue.deleteMany({
        where: {
          workspaceId: session.workspaceId,
          entityType: "LEAD",
          entityId: { in: targetIds },
        },
      });

      await tx.mergeLog.deleteMany({
        where: {
          workspaceId: session.workspaceId,
          OR: [{ primaryLeadId: { in: targetIds } }, { mergedLeadId: { in: targetIds } }],
        },
      });

      const deleted = await tx.lead.deleteMany({
        where: {
          workspaceId: session.workspaceId,
          id: { in: targetIds },
        },
      });

      return deleted.count;
    });

    return ok({
      deleted: true,
      count: deletedCount,
      ids: targetIds,
    });
  });
}
