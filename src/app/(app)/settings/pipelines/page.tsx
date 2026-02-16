import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { PipelinesSettingsPage } from "@/components/modules/settings/pipelines-settings-page";

export default async function PipelinesSettingsRoute() {
  const session = await getSessionContext();
  const pipelines = await prisma.pipeline.findMany({
    where: { workspaceId: session.workspaceId },
    include: {
      stages: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { sortOrder: "asc" },
  });
  return <PipelinesSettingsPage initialPipelines={pipelines} />;
}
