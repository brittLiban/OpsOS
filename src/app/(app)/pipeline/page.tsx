import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { PipelineBoardClient } from "@/components/modules/pipeline/pipeline-board-client";

export default async function PipelinePage() {
  const session = await getSessionContext();
  const pipelines = await prisma.pipeline.findMany({
    where: { workspaceId: session.workspaceId, isActive: true },
    include: {
      stages: {
        orderBy: { sortOrder: "asc" },
        include: {
          leads: {
            where: {
              workspaceId: session.workspaceId,
              archivedAt: null,
              mergedIntoLeadId: null,
            },
            orderBy: { updatedAt: "desc" },
          },
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <PipelineBoardClient
      pipelines={pipelines.map((pipeline) => ({
        ...pipeline,
        stages: pipeline.stages.map((stage) => ({
          ...stage,
          leads: stage.leads.map((lead) => ({
            id: lead.id,
            businessName: lead.businessName,
            city: lead.city,
            nextFollowUpAt: lead.nextFollowUpAt,
            leadValue: lead.leadValue ? lead.leadValue.toString() : null,
          })),
        })),
      }))}
    />
  );
}
