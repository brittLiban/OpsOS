import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { FieldsSettingsPage } from "@/components/modules/settings/fields-settings-page";

export default async function TaskFieldsSettingsRoute() {
  const session = await getSessionContext();
  const fields = await prisma.customField.findMany({
    where: {
      workspaceId: session.workspaceId,
      entityType: "TASK",
    },
    include: {
      options: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: [{ sortOrder: "asc" }],
  });

  return (
    <FieldsSettingsPage
      initialFields={fields}
      initialEntityType="TASK"
      lockEntityType
    />
  );
}
