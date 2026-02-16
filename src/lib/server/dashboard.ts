import { BillingStatus, StageType, TaskStatus } from "@prisma/client";
import { addDays, endOfDay, startOfDay, subDays } from "date-fns";
import { prisma } from "@/lib/server/prisma";

export async function getDashboardSnapshot(workspaceId: string) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const next7DaysEnd = endOfDay(addDays(now, 7));
  const sevenDaysAgo = subDays(now, 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalLeads,
    openLeads,
    dueTodayFollowUps,
    overdueFollowUps,
    totalClients,
    activeClients,
    onboardingClients,
    openTasks,
    overdueTasks,
    completedLast7Days,
    generalOpenTasks,
    billingOverdueCount,
    billingDueSoonCount,
    paidThisMonth,
    stageRows,
    upcomingTasks,
    upcomingFollowUps,
    recentTouchpoints,
    recentClientNotes,
    recentTaskUpdates,
  ] = await Promise.all([
    prisma.lead.count({
      where: { workspaceId, archivedAt: null, mergedIntoLeadId: null },
    }),
    prisma.lead.count({
      where: {
        workspaceId,
        status: "OPEN",
        stage: { stageType: StageType.OPEN },
        archivedAt: null,
        mergedIntoLeadId: null,
      },
    }),
    prisma.lead.count({
      where: {
        workspaceId,
        status: "OPEN",
        stage: { stageType: StageType.OPEN },
        nextFollowUpAt: {
          gte: todayStart,
          lte: todayEnd,
        },
        archivedAt: null,
        mergedIntoLeadId: null,
      },
    }),
    prisma.lead.count({
      where: {
        workspaceId,
        status: "OPEN",
        stage: { stageType: StageType.OPEN },
        nextFollowUpAt: {
          lt: now,
        },
        archivedAt: null,
        mergedIntoLeadId: null,
      },
    }),
    prisma.client.count({ where: { workspaceId } }),
    prisma.client.count({
      where: {
        workspaceId,
        status: "ACTIVE",
      },
    }),
    prisma.client.count({
      where: {
        workspaceId,
        status: "ONBOARDING",
      },
    }),
    prisma.task.count({
      where: {
        workspaceId,
        status: {
          not: TaskStatus.DONE,
        },
      },
    }),
    prisma.task.count({
      where: {
        workspaceId,
        status: {
          not: TaskStatus.DONE,
        },
        dueAt: {
          lt: now,
        },
      },
    }),
    prisma.task.count({
      where: {
        workspaceId,
        status: TaskStatus.DONE,
        completedAt: {
          gte: sevenDaysAgo,
        },
      },
    }),
    prisma.task.count({
      where: {
        workspaceId,
        leadId: null,
        clientId: null,
        status: {
          not: TaskStatus.DONE,
        },
      },
    }),
    prisma.billingRecord.count({
      where: {
        workspaceId,
        status: {
          not: BillingStatus.PAID,
        },
        dueDate: {
          lt: todayStart,
        },
      },
    }),
    prisma.billingRecord.count({
      where: {
        workspaceId,
        status: {
          not: BillingStatus.PAID,
        },
        dueDate: {
          gte: todayStart,
          lte: next7DaysEnd,
        },
      },
    }),
    prisma.billingRecord.aggregate({
      where: {
        workspaceId,
        status: BillingStatus.PAID,
        paidAt: {
          gte: monthStart,
        },
      },
      _sum: {
        amount: true,
      },
    }),
    prisma.stage.findMany({
      where: { workspaceId },
      include: {
        pipeline: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            leads: true,
          },
        },
      },
      orderBy: [{ pipeline: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    }),
    prisma.task.findMany({
      where: {
        workspaceId,
        dueAt: {
          gte: now,
          lte: next7DaysEnd,
        },
        status: {
          not: TaskStatus.DONE,
        },
      },
      include: {
        lead: { select: { id: true, businessName: true } },
        client: { select: { id: true, name: true } },
        taskType: { select: { name: true } },
      },
      orderBy: { dueAt: "asc" },
      take: 20,
    }),
    prisma.lead.findMany({
      where: {
        workspaceId,
        status: "OPEN",
        stage: { stageType: StageType.OPEN },
        nextFollowUpAt: {
          gte: now,
          lte: next7DaysEnd,
        },
      },
      include: {
        stage: {
          select: {
            name: true,
            color: true,
          },
        },
      },
      orderBy: { nextFollowUpAt: "asc" },
      take: 20,
    }),
    prisma.touchpoint.findMany({
      where: { workspaceId },
      include: {
        lead: {
          select: {
            id: true,
            businessName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.clientNote.findMany({
      where: { workspaceId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.task.findMany({
      where: { workspaceId },
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
      orderBy: { updatedAt: "desc" },
      take: 15,
    }),
  ]);

  const stagePipelineSummary = stageRows.reduce<
    {
      pipelineId: string;
      pipelineName: string;
      total: number;
      stages: { id: string; name: string; color: string; count: number }[];
    }[]
  >((acc, stage) => {
    const existing = acc.find((item) => item.pipelineId === stage.pipeline.id);
    const stagePayload = {
      id: stage.id,
      name: stage.name,
      color: stage.color,
      count: stage._count.leads,
    };
    if (!existing) {
      acc.push({
        pipelineId: stage.pipeline.id,
        pipelineName: stage.pipeline.name,
        total: stage._count.leads,
        stages: [stagePayload],
      });
      return acc;
    }
    existing.total += stage._count.leads;
    existing.stages.push(stagePayload);
    return acc;
  }, []);

  const recentActivity = [
    ...recentTouchpoints.map((item) => ({
      id: `touchpoint-${item.id}`,
      kind: "Lead touchpoint",
      title: item.summary ?? item.type,
      target: item.lead.businessName,
      href: `/leads/${item.lead.id}`,
      at: item.createdAt,
    })),
    ...recentClientNotes.map((item) => ({
      id: `client-note-${item.id}`,
      kind: "Client note",
      title: item.body.split("\n")[0] ?? "Note added",
      target: item.client.name,
      href: `/clients/${item.client.id}`,
      at: item.createdAt,
    })),
    ...recentTaskUpdates.map((item) => ({
      id: `task-${item.id}`,
      kind: "Task update",
      title: `${item.title} (${item.status})`,
      target: item.lead?.businessName ?? item.client?.name ?? "General",
      href: "/tasks",
      at: item.updatedAt,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 20);

  return {
    kpis: {
      totalLeads,
      openLeads,
      dueTodayFollowUps,
      overdueFollowUps,
      totalClients,
      activeClients,
      onboardingClients,
      openTasks,
      overdueTasks,
      completedLast7Days,
      generalOpenTasks,
      billingOverdueCount,
      billingDueSoonCount,
      paidThisMonthAmount: Number(paidThisMonth._sum.amount ?? 0),
    },
    stagePipelineSummary,
    upcomingTasks,
    upcomingFollowUps,
    recentActivity,
  };
}
