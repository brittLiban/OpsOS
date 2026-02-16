import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { ScriptsPageClient } from "@/components/modules/scripts/scripts-page-client";

export default async function ScriptsPage() {
  const session = await getSessionContext();
  const [scripts, categories] = await Promise.all([
    prisma.scriptTemplate.findMany({
      where: { workspaceId: session.workspaceId },
      include: {
        category: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.scriptCategory.findMany({
      where: { workspaceId: session.workspaceId, isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);
  return <ScriptsPageClient initialScripts={scripts} categories={categories} />;
}
