import { ClientStatus } from "@prisma/client";
import { HttpError, ok, parseBody, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { syncEntityFieldValues } from "@/lib/server/custom-fields";
import { DEFAULT_ONBOARDING_TEMPLATE } from "@/lib/server/constants";
import { prisma } from "@/lib/server/prisma";
import { convertLeadSchema, idSchema } from "@/lib/validation";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const leadId = idSchema.parse((await params).id);
    const body = await parseBody(request, convertLeadSchema);

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId: session.workspaceId },
      include: {
        pipeline: true,
      },
    });
    if (!lead) {
      throw new HttpError(404, "NOT_FOUND", "Lead not found");
    }
    if (lead.status === "CONVERTED") {
      throw new HttpError(409, "CONFLICT", "Lead already converted");
    }

    const result = await prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          workspaceId: session.workspaceId,
          sourceLeadId: lead.id,
          ownerId: lead.ownerId,
          name: lead.businessName,
          primaryContactName: lead.contactName,
          email: lead.email,
          phone: lead.phone,
          status: ClientStatus.ACTIVE,
          customData: lead.customData as never,
        },
      });

      await tx.lead.update({
        where: { id: lead.id },
        data: { status: "CONVERTED" },
      });

      await syncEntityFieldValues({
        tx,
        workspaceId: session.workspaceId,
        entityType: "CLIENT",
        entityId: client.id,
        values: (lead.customData as Record<string, unknown>) ?? {},
      });

      await tx.onboardingItem.createMany({
        data: DEFAULT_ONBOARDING_TEMPLATE.map((title, index) => ({
          workspaceId: session.workspaceId,
          clientId: client.id,
          title,
          sortOrder: index,
        })),
      });

      let billingRecord = null;
      if (body.createInitialBilling && body.billingTypeKey && body.billingAmount) {
        const billingType = await tx.billingType.findFirst({
          where: {
            workspaceId: session.workspaceId,
            key: body.billingTypeKey,
          },
        });
        if (billingType) {
          billingRecord = await tx.billingRecord.create({
            data: {
              workspaceId: session.workspaceId,
              clientId: client.id,
              billingTypeId: billingType.id,
              amount: body.billingAmount,
              dueDate: body.billingDueDate ?? new Date(),
              status: "DUE",
            },
          });
        }
      }

      return { client, billingRecord };
    });

    return ok({
      leadId: lead.id,
      client: result.client,
      onboardingCount: DEFAULT_ONBOARDING_TEMPLATE.length,
      billingRecord: result.billingRecord,
    });
  });
}
