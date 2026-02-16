import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { ImportNewPage } from "@/components/modules/imports/import-new-page";

export default async function ImportNewRoute() {
  const session = await getSessionContext();
  const [pipelines, customFields] = await Promise.all([
    prisma.pipeline.findMany({
      where: { workspaceId: session.workspaceId, isActive: true },
      include: {
        stages: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.customField.findMany({
      where: {
        workspaceId: session.workspaceId,
        entityType: "LEAD",
        isActive: true,
      },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return <ImportNewPage pipelines={pipelines} customFields={customFields} />;
}
