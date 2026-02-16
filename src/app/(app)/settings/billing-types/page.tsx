import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { BillingTypesSettingsPage } from "@/components/modules/settings/billing-types-settings-page";

export default async function BillingTypesSettingsRoute() {
  const session = await getSessionContext();
  const billingTypes = await prisma.billingType.findMany({
    where: {
      workspaceId: session.workspaceId,
    },
    orderBy: { sortOrder: "asc" },
  });
  return <BillingTypesSettingsPage initialBillingTypes={billingTypes} />;
}
