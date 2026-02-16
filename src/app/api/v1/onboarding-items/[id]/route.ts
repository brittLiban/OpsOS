import { z } from "zod";
import { HttpError, ok, parseBody, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { idSchema } from "@/lib/validation";

const onboardingUpdateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["TODO", "DONE", "SKIPPED"]).optional(),
  sortOrder: z.number().int().optional(),
});

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const id = idSchema.parse((await params).id);
    const body = await parseBody(request, onboardingUpdateSchema);

    const item = await prisma.onboardingItem.findFirst({
      where: {
        id,
        workspaceId: session.workspaceId,
      },
    });
    if (!item) {
      throw new HttpError(404, "NOT_FOUND", "Onboarding item not found");
    }

    const updated = await prisma.onboardingItem.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        status: body.status,
        sortOrder: body.sortOrder,
        completedAt: body.status === "DONE" ? new Date() : null,
      },
    });
    return ok(updated);
  });
}
