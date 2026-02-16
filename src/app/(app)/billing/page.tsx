import { getSessionContext } from "@/lib/server/auth";
import { markOverdueBillingRecords } from "@/lib/server/billing";
import { prisma } from "@/lib/server/prisma";
import { BillingPageClient } from "@/components/modules/billing/billing-page-client";

export default async function BillingPage() {
  const session = await getSessionContext();
  await markOverdueBillingRecords(session.workspaceId);
  const [records, clients, billingTypes] = await Promise.all([
    prisma.billingRecord.findMany({
      where: { workspaceId: session.workspaceId },
      include: {
        client: true,
        billingType: true,
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.client.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: { name: "asc" },
    }),
    prisma.billingType.findMany({
      where: { workspaceId: session.workspaceId, isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);
  return (
    <BillingPageClient
      initialRecords={records}
      clients={clients}
      billingTypes={billingTypes}
    />
  );
}
