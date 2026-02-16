import { HttpError, ok, parseBody, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { syncEntityFieldValues, validateCustomFields } from "@/lib/server/custom-fields";
import { prisma } from "@/lib/server/prisma";
import { clientUpdateSchema, idSchema } from "@/lib/validation";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const clientId = idSchema.parse((await params).id);

    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        workspaceId: session.workspaceId,
      },
      include: {
        onboardingItems: { orderBy: { sortOrder: "asc" } },
        notes: { orderBy: { createdAt: "desc" } },
        tasks: { orderBy: { dueAt: "asc" } },
        billingRecords: {
          include: { billingType: true },
          orderBy: { dueDate: "asc" },
        },
      },
    });

    if (!client) {
      throw new HttpError(404, "NOT_FOUND", "Client not found");
    }

    return ok(client);
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const clientId = idSchema.parse((await params).id);
    const body = await parseBody(request, clientUpdateSchema);

    const existing = await prisma.client.findFirst({
      where: {
        id: clientId,
        workspaceId: session.workspaceId,
      },
    });
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "Client not found");
    }

    const customFieldErrors = await validateCustomFields(
      session.workspaceId,
      "CLIENT",
      (body.customData ??
        (existing.customData as Record<string, unknown>) ??
        {}) as Record<string, unknown>,
    );
    if (customFieldErrors.length > 0) {
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid custom fields", customFieldErrors);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const client = await tx.client.update({
        where: { id: clientId },
        data: {
          sourceLeadId: body.sourceLeadId,
          ownerId: body.ownerId,
          name: body.name,
          primaryContactName: body.primaryContactName,
          email: body.email,
          phone: body.phone,
          status: body.status as never,
          customData: body.customData as never,
        },
      });

      if (body.customData) {
        await syncEntityFieldValues({
          tx,
          workspaceId: session.workspaceId,
          entityType: "CLIENT",
          entityId: client.id,
          values: body.customData,
        });
      }

      return client;
    });

    return ok(updated);
  });
}
