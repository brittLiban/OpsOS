import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { ClientsListPage } from "@/components/modules/clients/clients-list-page";

export default async function ClientsPage() {
  const session = await getSessionContext();
  const clients = await prisma.client.findMany({
    where: { workspaceId: session.workspaceId },
    include: {
      billingRecords: {
        include: { billingType: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const withMrr = clients.map((client) => {
    const mrrEstimate = client.billingRecords
      .filter((record) => record.billingType.key === "MONTHLY")
      .reduce((sum, record) => sum + Number(record.amount), 0);
    return {
      ...client,
      mrrEstimate,
    };
  });

  return <ClientsListPage clients={withMrr} />;
}
