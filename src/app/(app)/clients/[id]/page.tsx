import { notFound } from "next/navigation";
import { getSessionContext } from "@/lib/server/auth";
import { getCustomFieldDefinitions } from "@/lib/server/custom-fields";
import { prisma } from "@/lib/server/prisma";
import { ClientDetailPage } from "@/components/modules/clients/client-detail-page";

type Params = {
  params: Promise<{ id: string }>;
};

export default async function ClientDetailRoute({ params }: Params) {
  const { id } = await params;
  const session = await getSessionContext();
  const [client, customFields] = await Promise.all([
    prisma.client.findFirst({
      where: {
        id,
        workspaceId: session.workspaceId,
      },
      include: {
        onboardingItems: { orderBy: { sortOrder: "asc" } },
        notes: { orderBy: { createdAt: "desc" } },
        tasks: { orderBy: { dueAt: "asc" } },
        billingRecords: {
          include: { billingType: true },
          orderBy: { dueDate: "asc" },
        },
      },
    }),
    getCustomFieldDefinitions(session.workspaceId, "CLIENT"),
  ]);
  if (!client) {
    notFound();
  }
  return (
    <ClientDetailPage
      client={{
        ...client,
        customData: (client.customData ?? {}) as Record<string, unknown>,
      }}
      customFields={customFields.map((field) => ({
        id: field.id,
        key: field.key,
        label: field.label,
      }))}
    />
  );
}
