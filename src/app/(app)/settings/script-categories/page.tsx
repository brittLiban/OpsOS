import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { ScriptCategoriesSettingsPage } from "@/components/modules/settings/script-categories-settings-page";

export default async function ScriptCategoriesSettingsRoute() {
  const session = await getSessionContext();
  const categories = await prisma.scriptCategory.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: { sortOrder: "asc" },
  });
  return <ScriptCategoriesSettingsPage initialCategories={categories} />;
}
