import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://johndoe:randompassword@localhost:5432/mydb?schema=public";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const DEFAULT_WORKSPACE_NAME = "Ops OS Workspace";
const DEFAULT_PIPELINE_NAME = "Sales Pipeline";
const DEFAULT_WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const DEFAULT_LEAD_ID = "22222222-2222-4222-8222-222222222222";
const DEFAULT_CLIENT_ID = "33333333-3333-4333-8333-333333333333";
const DEFAULT_PIPELINE_STAGES = [
  { name: "New", sortOrder: 0, color: "BLUE", stageType: "OPEN" },
  { name: "Contacted", sortOrder: 1, color: "TEAL", stageType: "OPEN" },
  { name: "Qualified", sortOrder: 2, color: "GREEN", stageType: "OPEN" },
  { name: "Proposal", sortOrder: 3, color: "INDIGO", stageType: "OPEN" },
  { name: "Won", sortOrder: 4, color: "GREEN", stageType: "WON" },
  { name: "Lost", sortOrder: 5, color: "RED", stageType: "LOST" },
] as const;
const DEFAULT_ONBOARDING_TEMPLATE = [
  "Kickoff meeting",
  "Collect business goals",
  "Access & credentials handoff",
  "Service scope confirmation",
  "SLA review",
  "Communication cadence setup",
  "First delivery milestone",
  "Reporting template approval",
  "Billing preference confirmation",
  "Go-live checklist",
];

async function main() {
  const workspace = await prisma.workspace.upsert({
    where: { id: DEFAULT_WORKSPACE_ID },
    update: {},
    create: {
      id: DEFAULT_WORKSPACE_ID,
      name: DEFAULT_WORKSPACE_NAME,
      timezone: "America/New_York",
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: "owner@opsos.local" },
    update: {},
    create: {
      email: "owner@opsos.local",
      displayName: "Owner",
      passwordHash: "dev-password-hash",
    },
  });

  const member = await prisma.user.upsert({
    where: { email: "member@opsos.local" },
    update: {},
    create: {
      email: "member@opsos.local",
      displayName: "Member",
      passwordHash: "dev-password-hash",
    },
  });

  await prisma.membership.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: owner.id,
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: owner.id,
      role: "OWNER",
    },
  });

  await prisma.membership.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: member.id,
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: member.id,
      role: "MEMBER",
    },
  });

  let pipeline = await prisma.pipeline.findFirst({
    where: {
      workspaceId: workspace.id,
      name: DEFAULT_PIPELINE_NAME,
    },
  });

  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: {
        workspaceId: workspace.id,
        name: DEFAULT_PIPELINE_NAME,
        isDefault: true,
        sortOrder: 0,
      },
    });
  }

  for (const stage of DEFAULT_PIPELINE_STAGES) {
    await prisma.stage.upsert({
      where: {
        pipelineId_sortOrder: {
          pipelineId: pipeline.id,
          sortOrder: stage.sortOrder,
        },
      },
      update: {},
      create: {
        workspaceId: workspace.id,
        pipelineId: pipeline.id,
        name: stage.name,
        sortOrder: stage.sortOrder,
        color: stage.color,
        stageType: stage.stageType,
      },
    });
  }

  const billingTypes = [
    { key: "SETUP", name: "Setup", sortOrder: 0 },
    { key: "MONTHLY", name: "Monthly", sortOrder: 1 },
    { key: "OTHER", name: "Other", sortOrder: 2 },
  ];

  for (const billingType of billingTypes) {
    await prisma.billingType.upsert({
      where: {
        workspaceId_key: {
          workspaceId: workspace.id,
          key: billingType.key,
        },
      },
      update: {},
      create: {
        workspaceId: workspace.id,
        key: billingType.key,
        name: billingType.name,
        sortOrder: billingType.sortOrder,
        isSystem: true,
      },
    });
  }

  const scriptCategories = ["Discovery", "Follow-up", "Objection Handling"];
  for (let index = 0; index < scriptCategories.length; index += 1) {
    const name = scriptCategories[index];
    await prisma.scriptCategory.upsert({
      where: {
        workspaceId_name: {
          workspaceId: workspace.id,
          name,
        },
      },
      update: {},
      create: {
        workspaceId: workspace.id,
        name,
        sortOrder: index,
      },
    });
  }

  const firstStage = await prisma.stage.findFirstOrThrow({
    where: {
      pipelineId: pipeline.id,
      sortOrder: 0,
    },
  });

  const lead = await prisma.lead.upsert({
    where: { id: DEFAULT_LEAD_ID },
    update: {
      emailNorm: "hello@acme-services.com",
      phoneNorm: "5554443333",
      domainNorm: "acme-services.com",
      nameNorm: "acme services",
      cityNorm: "austin",
    },
    create: {
      id: DEFAULT_LEAD_ID,
      workspaceId: workspace.id,
      pipelineId: pipeline.id,
      stageId: firstStage.id,
      ownerId: owner.id,
      businessName: "Acme Services",
      contactName: "Alex Doe",
      email: "hello@acme-services.com",
      phone: "15554443333",
      city: "Austin",
      source: "Manual",
      customData: {},
      emailNorm: "hello@acme-services.com",
      phoneNorm: "5554443333",
      domainNorm: "acme-services.com",
      nameNorm: "acme services",
      cityNorm: "austin",
    },
  });

  const client = await prisma.client.upsert({
    where: { id: DEFAULT_CLIENT_ID },
    update: {},
    create: {
      id: DEFAULT_CLIENT_ID,
      workspaceId: workspace.id,
      sourceLeadId: lead.id,
      ownerId: owner.id,
      name: "Acme Services",
      primaryContactName: "Alex Doe",
      email: "hello@acme-services.com",
      phone: "15554443333",
      status: "ACTIVE",
      customData: {},
    },
  });

  for (let index = 0; index < DEFAULT_ONBOARDING_TEMPLATE.length; index += 1) {
    await prisma.onboardingItem.upsert({
      where: {
        clientId_sortOrder: {
          clientId: client.id,
          sortOrder: index,
        },
      },
      update: {},
      create: {
        workspaceId: workspace.id,
        clientId: client.id,
        title: DEFAULT_ONBOARDING_TEMPLATE[index],
        sortOrder: index,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
