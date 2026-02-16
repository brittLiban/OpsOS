import { getSessionContext } from "@/lib/server/auth";
import { getCustomFieldDefinitions } from "@/lib/server/custom-fields";
import { prisma } from "@/lib/server/prisma";
import { TasksPageClient } from "@/components/modules/tasks/tasks-page-client";

export default async function TasksPage() {
  const session = await getSessionContext();
  const [tasks, leads, clients, taskTypes, taskCustomFields] = await Promise.all([
    prisma.task.findMany({
      where: { workspaceId: session.workspaceId },
      include: {
        lead: {
          select: {
            id: true,
            businessName: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
          },
        },
        taskType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    }),
    prisma.lead.findMany({
      where: { workspaceId: session.workspaceId },
      select: {
        id: true,
        businessName: true,
      },
      orderBy: { businessName: "asc" },
    }),
    prisma.client.findMany({
      where: { workspaceId: session.workspaceId },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.taskType.findMany({
      where: { workspaceId: session.workspaceId, isActive: true },
      select: {
        id: true,
        name: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    getCustomFieldDefinitions(session.workspaceId, "TASK"),
  ]);

  const taskRows = tasks.map((task) => ({
    ...task,
    customData:
      task.customData && typeof task.customData === "object" && !Array.isArray(task.customData)
        ? (task.customData as Record<string, unknown>)
        : {},
  }));

  return (
    <TasksPageClient
      initialTasks={taskRows}
      leadOptions={leads.map((lead) => ({
        id: lead.id,
        label: lead.businessName,
      }))}
      clientOptions={clients.map((client) => ({
        id: client.id,
        label: client.name,
      }))}
      taskTypeOptions={taskTypes.map((taskType) => ({
        id: taskType.id,
        label: taskType.name,
      }))}
      customFields={taskCustomFields.map((field) => ({
        id: field.id,
        key: field.key,
        label: field.label,
        fieldType: field.fieldType,
        isRequired: field.isRequired,
        options: field.options.map((option) => ({
          label: option.label,
          value: option.value,
        })),
      }))}
    />
  );
}
