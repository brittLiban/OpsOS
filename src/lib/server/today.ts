import { BillingStatus, StageType, TaskStatus } from "@prisma/client";
import { addDays, endOfDay, startOfDay, subHours } from "date-fns";
import type { TodayItem } from "@/lib/types";

type TodayContext = {
  workspaceId: string;
  now?: Date;
  ownerId?: string | null;
};

export function scoreTodayItem(itemType: TodayItem["itemType"], isOverdue = false) {
  switch (itemType) {
    case "OVERDUE_FOLLOW_UP":
      return 100;
    case "DUE_TODAY_FOLLOW_UP":
      return 70;
    case "UNTOUCHED_NEW_LEAD":
      return 50;
    case "CLIENT_TASK_OVERDUE":
      return 90;
    case "CLIENT_TASK_DUE":
      return 65;
    case "BILLING_OVERDUE":
      return 95;
    case "BILLING_DUE_SOON":
      return 60;
    default:
      return isOverdue ? 90 : 50;
  }
}

export async function getTodayItems(ctx: TodayContext) {
  const { prisma } = await import("@/lib/server/prisma");
  const now = ctx.now ?? new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const oneDayAgo = subHours(now, 24);
  const dueSoonEnd = endOfDay(addDays(now, 7));

  const leadScope = {
    workspaceId: ctx.workspaceId,
    ...(ctx.ownerId ? { ownerId: ctx.ownerId } : {}),
    stage: { stageType: StageType.OPEN },
    archivedAt: null,
    mergedIntoLeadId: null,
  } as const;

  const [overdueFollowUps, dueTodayFollowUps, untouchedLeads, clientTasks, billingRecords] =
    await Promise.all([
      prisma.lead.findMany({
        where: {
          ...leadScope,
          nextFollowUpAt: { lt: now },
        },
        include: {
          stage: true,
          touchpoints: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { nextFollowUpAt: "asc" },
        take: 100,
      }),
      prisma.lead.findMany({
        where: {
          ...leadScope,
          nextFollowUpAt: { gte: todayStart, lte: todayEnd },
        },
        include: {
          stage: true,
          touchpoints: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { nextFollowUpAt: "asc" },
        take: 100,
      }),
      prisma.lead.findMany({
        where: {
          ...leadScope,
          createdAt: { lt: oneDayAgo },
          touchpoints: { none: {} },
        },
        include: {
          stage: true,
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      }),
      prisma.task.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          clientId: { not: null },
          status: { not: TaskStatus.DONE },
          dueAt: { lte: todayEnd },
          ...(ctx.ownerId ? { assigneeId: ctx.ownerId } : {}),
        },
        include: { client: true },
        orderBy: { dueAt: "asc" },
        take: 100,
      }),
      prisma.billingRecord.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          status: { not: BillingStatus.PAID },
          dueDate: { lte: dueSoonEnd },
        },
        include: {
          client: true,
        },
        orderBy: { dueDate: "asc" },
        take: 100,
      }),
    ]);

  const sections = {
    overdueFollowUps: overdueFollowUps.map((lead): TodayItem => {
      const lastTouchpoint = lead.touchpoints[0];
      return {
        itemType: "OVERDUE_FOLLOW_UP",
        score: scoreTodayItem("OVERDUE_FOLLOW_UP"),
        entityType: "LEAD",
        entityId: lead.id,
        name: lead.businessName,
        stageBadge: { label: lead.stage.name, stageType: lead.stage.stageType },
        lastTouchpoint: lastTouchpoint
          ? {
              type: lastTouchpoint.type,
              summary: lastTouchpoint.summary,
              happenedAt: lastTouchpoint.happenedAt.toISOString(),
            }
          : undefined,
        dueAt: lead.nextFollowUpAt?.toISOString(),
        quickActions: ["LOG_CALL", "SNOOZE_1D", "SNOOZE_3D", "SNOOZE_7D", "GO_TO_DETAIL", "INSERT_SCRIPT"],
      };
    }),
    dueTodayFollowUps: dueTodayFollowUps.map((lead): TodayItem => {
      const lastTouchpoint = lead.touchpoints[0];
      return {
        itemType: "DUE_TODAY_FOLLOW_UP",
        score: scoreTodayItem("DUE_TODAY_FOLLOW_UP"),
        entityType: "LEAD",
        entityId: lead.id,
        name: lead.businessName,
        stageBadge: { label: lead.stage.name, stageType: lead.stage.stageType },
        lastTouchpoint: lastTouchpoint
          ? {
              type: lastTouchpoint.type,
              summary: lastTouchpoint.summary,
              happenedAt: lastTouchpoint.happenedAt.toISOString(),
            }
          : undefined,
        dueAt: lead.nextFollowUpAt?.toISOString(),
        quickActions: ["LOG_CALL", "SNOOZE_1D", "SNOOZE_3D", "SNOOZE_7D", "GO_TO_DETAIL", "INSERT_SCRIPT"],
      };
    }),
    untouchedLeads: untouchedLeads.map((lead): TodayItem => ({
      itemType: "UNTOUCHED_NEW_LEAD",
      score: scoreTodayItem("UNTOUCHED_NEW_LEAD"),
      entityType: "LEAD",
      entityId: lead.id,
      name: lead.businessName,
      stageBadge: { label: lead.stage.name, stageType: lead.stage.stageType },
      dueAt: lead.createdAt.toISOString(),
      quickActions: ["LOG_CALL", "SNOOZE_1D", "GO_TO_DETAIL", "INSERT_SCRIPT"],
    })),
    clientTasks: clientTasks.map((task): TodayItem => {
      const overdue = task.dueAt ? task.dueAt < todayStart : false;
      return {
        itemType: overdue ? "CLIENT_TASK_OVERDUE" : "CLIENT_TASK_DUE",
        score: scoreTodayItem(overdue ? "CLIENT_TASK_OVERDUE" : "CLIENT_TASK_DUE", overdue),
        entityType: "CLIENT_TASK",
        entityId: task.id,
        name: `${task.client?.name ?? "Client"}: ${task.title}`,
        dueAt: task.dueAt?.toISOString(),
        quickActions: ["MARK_DONE", "GO_TO_DETAIL"],
      };
    }),
    billing: billingRecords.map((record): TodayItem => {
      const overdue = record.dueDate < todayStart;
      return {
        itemType: overdue ? "BILLING_OVERDUE" : "BILLING_DUE_SOON",
        score: scoreTodayItem(overdue ? "BILLING_OVERDUE" : "BILLING_DUE_SOON", overdue),
        entityType: "BILLING",
        entityId: record.id,
        name: `${record.client.name} - ${record.amount.toString()}`,
        dueAt: record.dueDate.toISOString(),
        quickActions: ["GO_TO_DETAIL"],
      };
    }),
  };

  const flat = [
    ...sections.overdueFollowUps,
    ...sections.dueTodayFollowUps,
    ...sections.untouchedLeads,
    ...sections.clientTasks,
    ...sections.billing,
  ].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (!a.dueAt || !b.dueAt) {
      return 0;
    }
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });

  return {
    sections,
    total: flat.length,
    prioritized: flat,
  };
}
