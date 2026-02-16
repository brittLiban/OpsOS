import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { FieldsSettingsPage } from "@/components/modules/settings/fields-settings-page";

export default async function FieldsSettingsRoute() {
  const session = await getSessionContext();
  const fields = await prisma.customField.findMany({
    where: {
      workspaceId: session.workspaceId,
    },
    include: {
      options: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: [{ entityType: "asc" }, { sortOrder: "asc" }],
  });
  return <FieldsSettingsPage initialFields={fields} />;
}
