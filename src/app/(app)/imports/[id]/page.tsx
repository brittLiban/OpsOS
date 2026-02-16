import { notFound } from "next/navigation";
import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { ImportDetailPage } from "@/components/modules/imports/import-detail-page";

type Params = {
  params: Promise<{ id: string }>;
};

export default async function ImportDetailRoute({ params }: Params) {
  const { id } = await params;
  const session = await getSessionContext();
  const run = await prisma.importRun.findFirst({
    where: { id, workspaceId: session.workspaceId },
  });
  if (!run) {
    notFound();
  }
  return <ImportDetailPage run={run} />;
}
