import { Prisma } from "@prisma/client";
import { HttpError, ok, parseBody, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { billingUpdateSchema, idSchema } from "@/lib/validation";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const id = idSchema.parse((await params).id);
    const body = await parseBody(request, billingUpdateSchema);

    const existing = await prisma.billingRecord.findFirst({
      where: { id, workspaceId: session.workspaceId },
    });
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "Billing record not found");
    }

    const updated = await prisma.billingRecord.update({
      where: { id },
      data: {
        clientId: body.clientId,
        billingTypeId: body.billingTypeId,
        amount:
          body.amount === undefined || body.amount === null
            ? undefined
            : new Prisma.Decimal(body.amount),
        dueDate: body.dueDate,
        notes: body.notes,
        status: body.status,
        paidAt: body.paidAt,
      },
    });
    return ok(updated);
  });
}

export async function DELETE(_: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const id = idSchema.parse((await params).id);
    const existing = await prisma.billingRecord.findFirst({
      where: { id, workspaceId: session.workspaceId },
    });
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "Billing record not found");
    }
    await prisma.billingRecord.delete({ where: { id } });
    return ok({ deleted: true });
  });
}
