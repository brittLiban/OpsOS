import { z } from "zod";
import { ok, parseBody, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

const scriptCategorySchema = z.object({
  name: z.string().trim().min(1),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export async function GET() {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const categories = await prisma.scriptCategory.findMany({
      where: {
        workspaceId: session.workspaceId,
      },
      orderBy: { sortOrder: "asc" },
    });
    return ok(categories);
  });
}

export async function POST(request: Request) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const body = await parseBody(request, scriptCategorySchema);
    const created = await prisma.scriptCategory.create({
      data: {
        workspaceId: session.workspaceId,
        name: body.name,
        sortOrder: body.sortOrder,
        isActive: body.isActive,
      },
    });
    return ok(created);
  });
}
