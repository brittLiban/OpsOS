import { Prisma } from "@prisma/client";
import { HttpError, ok, parseBody, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { syncEntityFieldValues, validateCustomFields } from "@/lib/server/custom-fields";
import { normalizeLeadPayload } from "@/lib/server/normalization";
import { prisma } from "@/lib/server/prisma";
import { idSchema, leadUpdateSchema } from "@/lib/validation";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const leadId = idSchema.parse((await params).id);
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        workspaceId: session.workspaceId,
      },
      include: {
        stage: true,
        pipeline: true,
        touchpoints: { orderBy: { happenedAt: "desc" }, take: 100 },
        tasks: { orderBy: { createdAt: "desc" }, take: 100 },
      },
    });

    if (!lead) {
      throw new HttpError(404, "NOT_FOUND", "Lead not found");
    }

    return ok(lead);
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const leadId = idSchema.parse((await params).id);
    const body = await parseBody(request, leadUpdateSchema);

    const existing = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId: session.workspaceId },
    });
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "Lead not found");
    }

    const customFieldErrors = await validateCustomFields(
      session.workspaceId,
      "LEAD",
      (body.customData ??
        (existing.customData as Record<string, unknown>) ??
        {}) as Record<string, unknown>,
    );
    if (customFieldErrors.length > 0) {
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid custom fields", customFieldErrors);
    }

    const normalized = normalizeLeadPayload({
      email: body.email ?? existing.email,
      phone: body.phone ?? existing.phone,
      website: body.website ?? existing.website,
      businessName: body.businessName ?? existing.businessName,
      city: body.city ?? existing.city,
    });

    const updated = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.update({
        where: { id: leadId },
        data: {
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
              ? undefined
              : new Prisma.Decimal(body.leadValue),
          nextFollowUpAt: body.nextFollowUpAt,
          customData: body.customData as Prisma.JsonObject | undefined,
          ...normalized,
        },
      });

      if (body.customData) {
        await syncEntityFieldValues({
          tx,
          workspaceId: session.workspaceId,
          entityType: "LEAD",
          entityId: lead.id,
          values: body.customData,
        });
      }

      return lead;
    });

    return ok(updated);
  });
}
