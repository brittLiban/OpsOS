import type { Prisma, StageColor, StageType } from "@prisma/client";
import {
  DEFAULT_PIPELINE_NAME,
  DEFAULT_PIPELINE_STAGES,
  DEFAULT_WORKSPACE_NAME,
} from "@/lib/server/constants";
import { prisma } from "@/lib/server/prisma";

export async function ensureBootstrapData() {
  const workspace = await prisma.workspace.findFirst({
    include: {
      pipelines: {
        include: {
          stages: true,
        },
      },
      memberships: true,
    },
  });

  if (workspace) {
    await ensureDefaultPipeline(workspace.id);
    await ensureSystemBillingTypes(workspace.id);
    return workspace;
  }

  const createdWorkspace = await prisma.workspace.create({
    data: {
      name: DEFAULT_WORKSPACE_NAME,
      timezone: "America/New_York",
    },
  });

  const ownerUser = await prisma.user.create({
    data: {
      email: "owner@opsos.local",
      displayName: "Owner",
      passwordHash: "dev-password-hash",
      isActive: true,
    },
  });

  const memberUser = await prisma.user.create({
    data: {
      email: "member@opsos.local",
      displayName: "Member",
      passwordHash: "dev-password-hash",
      isActive: true,
    },
  });

  await prisma.membership.createMany({
    data: [
      { workspaceId: createdWorkspace.id, userId: ownerUser.id, role: "OWNER" },
      { workspaceId: createdWorkspace.id, userId: memberUser.id, role: "MEMBER" },
    ],
  });

  await ensureDefaultPipeline(createdWorkspace.id);
  await ensureSystemBillingTypes(createdWorkspace.id);
  await ensureScriptCategories(createdWorkspace.id);

  return prisma.workspace.findUniqueOrThrow({
    where: { id: createdWorkspace.id },
    include: {
      memberships: true,
      pipelines: {
        include: {
          stages: true,
        },
      },
    },
  });
}

async function ensureDefaultPipeline(workspaceId: string) {
  const existing = await prisma.pipeline.findFirst({
    where: { workspaceId, name: DEFAULT_PIPELINE_NAME },
    include: { stages: true },
  });

  if (existing?.stages.length) {
    return existing;
  }

  if (existing) {
    await prisma.stage.createMany({
      data: DEFAULT_PIPELINE_STAGES.map((stage) => ({
        workspaceId,
        pipelineId: existing.id,
        name: stage.name,
        sortOrder: stage.sortOrder,
        color: stage.color as StageColor,
        stageType: stage.stageType as StageType,
      })),
    });

    return existing;
  }

  return prisma.pipeline.create({
    data: {
      workspaceId,
      name: DEFAULT_PIPELINE_NAME,
      isDefault: true,
      sortOrder: 0,
      stages: {
        create: DEFAULT_PIPELINE_STAGES.map((stage) => ({
          workspaceId,
          name: stage.name,
          sortOrder: stage.sortOrder,
          color: stage.color as StageColor,
          stageType: stage.stageType as StageType,
        })),
      },
    },
  });
}

async function ensureSystemBillingTypes(workspaceId: string) {
  const defaults: Prisma.BillingTypeCreateManyInput[] = [
    { workspaceId, key: "SETUP", name: "Setup", sortOrder: 0, isSystem: true },
    {
      workspaceId,
      key: "MONTHLY",
      name: "Monthly",
      sortOrder: 1,
      isSystem: true,
    },
    { workspaceId, key: "OTHER", name: "Other", sortOrder: 2, isSystem: true },
  ];

  for (const billingType of defaults) {
    const existing = await prisma.billingType.findFirst({
      where: { workspaceId, key: billingType.key },
    });
    if (!existing) {
      await prisma.billingType.create({ data: billingType });
    }
  }
}

async function ensureScriptCategories(workspaceId: string) {
  const defaults = ["Discovery", "Follow-up", "Objection Handling"];
  for (let index = 0; index < defaults.length; index += 1) {
    const name = defaults[index];
    const existing = await prisma.scriptCategory.findFirst({
      where: { workspaceId, name },
    });
    if (!existing) {
      await prisma.scriptCategory.create({
        data: {
          workspaceId,
          name,
          sortOrder: index,
        },
      });
    }
  }
}
