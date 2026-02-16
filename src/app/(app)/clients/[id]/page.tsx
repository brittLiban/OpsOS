import { notFound } from "next/navigation";
import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { ClientDetailPage } from "@/components/modules/clients/client-detail-page";

type Params = {
  params: Promise<{ id: string }>;
};

export default async function ClientDetailRoute({ params }: Params) {
  const { id } = await params;
  const session = await getSessionContext();
  const client = await prisma.client.findFirst({
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
  });
  if (!client) {
    notFound();
  }
  return <ClientDetailPage client={client} />;
}
