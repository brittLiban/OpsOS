import { ClientStatus, LeadLifecycleStatus, StageType } from "@prisma/client";
import { CallQueuePageClient } from "@/components/modules/calls/call-queue-page-client";
import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

export default async function CallsPage() {
  const session = await getSessionContext();
  const [leads, clients] = await Promise.all([
    prisma.lead.findMany({
      where: {
        workspaceId: session.workspaceId,
        status: LeadLifecycleStatus.OPEN,
        stage: {
          stageType: StageType.OPEN,
        },
      },
      select: {
        id: true,
        businessName: true,
        contactName: true,
        phone: true,
        email: true,
        city: true,
        nextFollowUpAt: true,
        stage: {
          select: {
            name: true,
            color: true,
          },
        },
        touchpoints: {
          orderBy: { happenedAt: "desc" },
          take: 1,
          select: {
            happenedAt: true,
            summary: true,
            notes: true,
            outcome: true,
          },
        },
      },
      orderBy: [{ nextFollowUpAt: "asc" }, { createdAt: "asc" }],
      take: 500,
    }),
    prisma.client.findMany({
      where: {
        workspaceId: session.workspaceId,
        status: { in: [ClientStatus.ACTIVE, ClientStatus.ONBOARDING] },
      },
      select: {
        id: true,
        name: true,
        primaryContactName: true,
        phone: true,
        email: true,
        status: true,
        notes: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            body: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ createdAt: "asc" }],
      take: 500,
    }),
  ]);

  return (
    <CallQueuePageClient
      leads={leads
        .filter((lead) => Boolean(lead.phone?.trim()))
        .map((lead) => ({
          id: lead.id,
          businessName: lead.businessName,
          contactName: lead.contactName,
          phone: lead.phone,
          email: lead.email,
          city: lead.city,
          nextFollowUpAt: lead.nextFollowUpAt,
          stage: lead.stage,
          lastTouchpoint: lead.touchpoints[0] ?? null,
        }))}
      clients={clients
        .filter((client) => Boolean(client.phone?.trim()))
        .map((client) => ({
          id: client.id,
          name: client.name,
          primaryContactName: client.primaryContactName,
          phone: client.phone,
          email: client.email,
          status: client.status,
          lastNote: client.notes[0] ?? null,
        }))}
    />
  );
}
