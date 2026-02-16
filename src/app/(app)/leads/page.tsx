import { getSessionContext } from "@/lib/server/auth";
import { getCustomFieldDefinitions } from "@/lib/server/custom-fields";
import { prisma } from "@/lib/server/prisma";
import { LeadsPageClient } from "@/components/modules/leads/leads-page-client";

export default async function LeadsPage() {
  const session = await getSessionContext();
  const [pipelines, customFields] = await Promise.all([
    prisma.pipeline.findMany({
      where: { workspaceId: session.workspaceId, isActive: true },
      include: { stages: { orderBy: { sortOrder: "asc" } } },
      orderBy: { sortOrder: "asc" },
    }),
    getCustomFieldDefinitions(session.workspaceId, "LEAD"),
  ]);

  return (
    <LeadsPageClient
      pipelines={pipelines}
      customFields={customFields.map((field) => ({
        ...field,
        options: field.options.map((option) => ({
          label: option.label,
          value: option.value,
        })),
      }))}
    />
  );
}
