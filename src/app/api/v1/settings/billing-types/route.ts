import { z } from "zod";
import { ok, parseBody, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

const billingTypeSchema = z.object({
  key: z.string().trim().optional(),
  name: z.string().trim().min(1),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export async function GET() {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const types = await prisma.billingType.findMany({
      where: {
        workspaceId: session.workspaceId,
      },
      orderBy: { sortOrder: "asc" },
    });
    return ok(types);
  });
}

export async function POST(request: Request) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const body = await parseBody(request, billingTypeSchema);
    const created = await prisma.billingType.create({
      data: {
        workspaceId: session.workspaceId,
        key: body.key,
        name: body.name,
        sortOrder: body.sortOrder,
        isActive: body.isActive,
      },
    });
    return ok(created);
  });
}
