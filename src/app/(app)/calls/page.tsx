import { ClientStatus, LeadLifecycleStatus, StageType } from "@prisma/client";
import { CallQueuePageClient } from "@/components/modules/calls/call-queue-page-client";
import { getSessionContext } from "@/lib/server/auth";
import { getCustomFieldDefinitions } from "@/lib/server/custom-fields";
import { prisma } from "@/lib/server/prisma";

export default async function CallsPage() {
  const session = await getSessionContext();
  const [leads, clients, leadCustomFields, clientCustomFields] = await Promise.all([
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
        customData: true,
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
        customData: true,
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
    getCustomFieldDefinitions(session.workspaceId, "LEAD"),
    getCustomFieldDefinitions(session.workspaceId, "CLIENT"),
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
          customData: (lead.customData ?? {}) as Record<string, unknown>,
          nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
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
          customData: (client.customData ?? {}) as Record<string, unknown>,
          lastNote: client.notes[0] ?? null,
        }))}
      leadCustomFields={leadCustomFields.map((field) => ({
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
      clientCustomFields={clientCustomFields.map((field) => ({
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
