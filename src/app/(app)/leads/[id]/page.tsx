import { notFound } from "next/navigation";
import { getSessionContext } from "@/lib/server/auth";
import { getCustomFieldDefinitions } from "@/lib/server/custom-fields";
import { prisma } from "@/lib/server/prisma";
import { LeadDetailClient } from "@/components/modules/leads/lead-detail-client";

type Params = {
  params: Promise<{ id: string }>;
};

export default async function LeadDetailPage({ params }: Params) {
  const { id } = await params;
  const session = await getSessionContext();
  const [lead, customFields, pipelines] = await Promise.all([
    prisma.lead.findFirst({
      where: {
        id,
        workspaceId: session.workspaceId,
      },
      include: {
        pipeline: true,
        stage: true,
        touchpoints: { orderBy: { happenedAt: "desc" } },
        tasks: { orderBy: { dueAt: "asc" } },
      },
    }),
    getCustomFieldDefinitions(session.workspaceId, "LEAD"),
    prisma.pipeline.findMany({
      where: { workspaceId: session.workspaceId },
      include: {
        stages: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  if (!lead) {
    notFound();
  }

  return (
    <LeadDetailClient
      lead={{
        ...lead,
        customData: (lead.customData ?? {}) as Record<string, unknown>,
      }}
      customFields={customFields.map((field) => ({
        ...field,
        options: field.options.map((option) => ({
          label: option.label,
          value: option.value,
        })),
      }))}
      pipelines={pipelines}
    />
  );
}
