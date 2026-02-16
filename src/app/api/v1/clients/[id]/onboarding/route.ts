import { ok, parseBody, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { idSchema } from "@/lib/validation";
import { z } from "zod";

const onboardingCreateSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const clientId = idSchema.parse((await params).id);
    const items = await prisma.onboardingItem.findMany({
      where: {
        workspaceId: session.workspaceId,
        clientId,
      },
      orderBy: { sortOrder: "asc" },
    });
    return ok(items);
  });
}

export async function POST(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const clientId = idSchema.parse((await params).id);
    const body = await parseBody(request, onboardingCreateSchema);

    const count = await prisma.onboardingItem.count({
      where: { workspaceId: session.workspaceId, clientId },
    });

    const item = await prisma.onboardingItem.create({
      data: {
        workspaceId: session.workspaceId,
        clientId,
        title: body.title,
        description: body.description ?? null,
        sortOrder: body.sortOrder ?? count,
      },
    });

    return ok(item);
  });
}
