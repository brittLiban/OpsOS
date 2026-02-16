import { BillingStatus } from "@prisma/client";

function getUtcDateStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getUtcDateEnd(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function getUtcDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function shouldMarkBillingOverdue(input: {
  dueDate: Date;
  status: BillingStatus;
  now?: Date;
}) {
  if (input.status === BillingStatus.PAID || input.status === BillingStatus.VOID) {
    return false;
  }
  const now = input.now ?? new Date();
  return getUtcDateKey(input.dueDate) < getUtcDateKey(now);
}

export async function markOverdueBillingRecords(workspaceId: string, now = new Date()) {
  const { prisma } = await import("@/lib/server/prisma");
  const todayStart = getUtcDateStart(now);
  const todayEnd = getUtcDateEnd(now);

  await prisma.billingRecord.updateMany({
    where: {
      workspaceId,
      status: { in: [BillingStatus.DUE] },
      dueDate: { lt: todayStart },
    },
    data: {
      status: BillingStatus.OVERDUE,
    },
  });

  await prisma.billingRecord.updateMany({
    where: {
      workspaceId,
      status: BillingStatus.OVERDUE,
      dueDate: { gte: todayStart, lte: todayEnd },
    },
    data: {
      status: BillingStatus.DUE,
    },
  });
}
