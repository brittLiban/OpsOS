import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { TasksPageClient } from "@/components/modules/tasks/tasks-page-client";

export default async function TasksPage() {
  const session = await getSessionContext();
  const [tasks, leads, clients] = await Promise.all([
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
  ]);

  return (
    <TasksPageClient
      initialTasks={tasks}
      leadOptions={leads.map((lead) => ({
        id: lead.id,
        label: lead.businessName,
      }))}
      clientOptions={clients.map((client) => ({
        id: client.id,
        label: client.name,
      }))}
    />
  );
}
