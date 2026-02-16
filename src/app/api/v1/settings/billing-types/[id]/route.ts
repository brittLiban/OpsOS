import { z } from "zod";
import { HttpError, ok, parseBody, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { idSchema } from "@/lib/validation";

const billingTypeUpdateSchema = z.object({
  key: z.string().trim().optional(),
  name: z.string().trim().min(1).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const id = idSchema.parse((await params).id);
    const body = await parseBody(request, billingTypeUpdateSchema);

    const existing = await prisma.billingType.findFirst({
      where: { id, workspaceId: session.workspaceId },
    });
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "Billing type not found");
    }

    const updated = await prisma.billingType.update({
      where: { id },
      data: body,
    });
    return ok(updated);
  });
}

export async function DELETE(_: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const id = idSchema.parse((await params).id);

    const existing = await prisma.billingType.findFirst({
      where: { id, workspaceId: session.workspaceId },
      include: { records: { take: 1 } },
    });
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "Billing type not found");
    }
    if (existing.isSystem) {
      throw new HttpError(409, "CONFLICT", "Cannot delete system billing type");
    }
    if (existing.records.length > 0) {
      throw new HttpError(409, "CONFLICT", "Cannot delete billing type in use");
    }

    await prisma.billingType.delete({ where: { id } });
    return ok({ deleted: true });
  });
}
