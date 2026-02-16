import { Prisma } from "@prisma/client";
import { getSessionContext } from "@/lib/server/auth";
import { ok, parseBody, parseSearchParams, withErrorHandling } from "@/lib/server/api";
import { syncEntityFieldValues, validateCustomFields } from "@/lib/server/custom-fields";
import { buildLeadSearchWhere } from "@/lib/server/lead-search";
import { normalizeLeadPayload } from "@/lib/server/normalization";
import { toPageParams } from "@/lib/server/pagination";
import { prisma } from "@/lib/server/prisma";
import { leadCreateSchema, leadListQuerySchema } from "@/lib/validation";

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
