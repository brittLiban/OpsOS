import { Prisma, TaskStatus } from "@prisma/client";

type TaskActivityAction = "CREATED" | "UPDATED" | "COMPLETED" | "REOPENED" | "DELETED";

type TaskActivityTask = {
  id: string;
  title: string;
  leadId: string | null;
  clientId: string | null;
  status: TaskStatus;
  dueAt: Date | null;
  description?: string | null;
  taskType?: { name: string } | null;
};

const ACTION_LABEL: Record<TaskActivityAction, string> = {
  CREATED: "Task created",
  UPDATED: "Task updated",
  COMPLETED: "Task completed",
  REOPENED: "Task reopened",
  DELETED: "Task deleted",
};

export async function logTaskActivity(input: {
  tx: Prisma.TransactionClient;
  workspaceId: string;
  userId: string;
  action: TaskActivityAction;
  task: TaskActivityTask;
}) {
  const { tx, workspaceId, userId, action, task } = input;

  if (!task.leadId && !task.clientId) {
    return;
  }

  const taskTypeName = task.taskType?.name ?? "General";
  const dueText = task.dueAt ? task.dueAt.toLocaleString() : "Unscheduled";
  const detailLines = [
    `Task: ${task.title}`,
    `Type: ${taskTypeName}`,
    `Status: ${task.status}`,
    `Due: ${dueText}`,
    task.description?.trim() ? `Details: ${task.description.trim()}` : "",
  ].filter((line) => line.length > 0);

  if (task.leadId) {
    await tx.touchpoint.create({
      data: {
        workspaceId,
        leadId: task.leadId,
        type: "NOTE",
        summary: `${ACTION_LABEL[action]}: ${task.title}`,
        notes: detailLines.join("\n"),
        createdById: userId,
      },
    });
    return;
  }

  if (task.clientId) {
    await tx.clientNote.create({
      data: {
        workspaceId,
        clientId: task.clientId,
        authorId: userId,
        body: [`${ACTION_LABEL[action]}`, ...detailLines].join("\n"),
      },
    });
  }
}
