import { HttpError, ok, parseBody, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { idSchema, markPaidSchema } from "@/lib/validation";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const id = idSchema.parse((await params).id);
    const body = await parseBody(request, markPaidSchema);

    const existing = await prisma.billingRecord.findFirst({
      where: { id, workspaceId: session.workspaceId },
    });
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "Billing record not found");
    }

    const updated = await prisma.billingRecord.update({
      where: { id },
      data: {
        status: "PAID",
        paidAt: body.paidAt ?? new Date(),
      },
    });

    return ok(updated);
  });
}
