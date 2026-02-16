import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { ImportsListPage } from "@/components/modules/imports/imports-list-page";

export default async function ImportsPage() {
  const session = await getSessionContext();
  const runs = await prisma.importRun.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return <ImportsListPage runs={runs} />;
}
