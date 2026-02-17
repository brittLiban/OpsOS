import { prisma } from "@/lib/server/prisma";

type StarterTemplate = {
  title: string;
  categoryName?: string;
  tags: string[];
  content: string;
};

const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    title: "Cold Intro - First Call",
    categoryName: "Discovery",
    tags: ["call", "intro", "discovery"],
    content:
      "Hi {{contactName}}, this is {{yourName}} with {{company}}. I work with businesses like {{businessName}} to help with {{valueProp}}. Is now a bad time for a quick 60-second overview?",
  },
  {
    title: "Voicemail - Call Back Request",
    categoryName: "Follow-up",
    tags: ["call", "voicemail", "follow-up"],
    content:
      "Hi {{contactName}}, this is {{yourName}}. Reaching out about {{topic}} for {{businessName}}. Call me back at {{phone}} when you can. I will follow up again on {{followUpDate}}.",
  },
  {
    title: "No Answer - SMS Follow-up",
    categoryName: "Follow-up",
    tags: ["sms", "follow-up"],
    content:
      "Hi {{contactName}}, this is {{yourName}} from {{company}}. Tried to reach you about {{topic}}. Want me to send a quick summary here?",
  },
  {
    title: "Quote Follow-up - 24 Hours",
    categoryName: "Follow-up",
    tags: ["follow-up", "quote"],
    content:
      "Hi {{contactName}}, wanted to check in on the quote I sent for {{businessName}}. Any questions I can clear up so we can keep this moving?",
  },
  {
    title: "Objection - Need to Think About It",
    categoryName: "Objection Handling",
    tags: ["objection", "call"],
    content:
      "Totally fair. Most clients say that first. Usually it comes down to timeline, budget, or confidence in outcome. Which one is holding this up for you right now?",
  },
  {
    title: "Objection - Price Too High",
    categoryName: "Objection Handling",
    tags: ["objection", "price"],
    content:
      "Makes sense. If we remove price for a second, does this solve the problem you want fixed? If yes, I can show two options so you can pick what fits best.",
  },
  {
    title: "Meeting Confirmation",
    categoryName: "Follow-up",
    tags: ["meeting", "confirmation"],
    content:
      "Confirming our meeting on {{meetingDate}} at {{meetingTime}}. Reply YES to confirm, or share a better time if needed.",
  },
  {
    title: "No Show - Reschedule",
    categoryName: "Follow-up",
    tags: ["meeting", "reschedule"],
    content:
      "Looks like we missed each other today. No problem. Want to reschedule for {{optionA}} or {{optionB}}?",
  },
  {
    title: "Reactivation - Past Lead",
    categoryName: "Follow-up",
    tags: ["reactivation", "lead"],
    content:
      "Hi {{contactName}}, checking in since we spoke about {{topic}} a while back. Still looking to solve this, or should I close the loop on my side?",
  },
  {
    title: "Referral Request - Happy Client",
    categoryName: "Discovery",
    tags: ["referral", "client"],
    content:
      "Glad we could help with {{result}}. Do 1-2 other businesses come to mind that would also benefit from this?",
  },
];

function normalizeTitle(value: string) {
  return value.trim().toLowerCase();
}

function normalizeCategoryName(value: string) {
  return value.trim().toLowerCase();
}

async function findScriptsByIds(ids: string[]) {
  if (ids.length === 0) {
    return [];
  }

  return prisma.scriptTemplate.findMany({
    where: {
      id: {
        in: ids,
      },
    },
    include: {
      category: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function installStarterScriptPack(input: {
  workspaceId: string;
  userId: string;
}) {
  const [existingScripts, categories] = await Promise.all([
    prisma.scriptTemplate.findMany({
      where: { workspaceId: input.workspaceId },
      select: { title: true },
    }),
    prisma.scriptCategory.findMany({
      where: { workspaceId: input.workspaceId, isActive: true },
      select: { id: true, name: true },
    }),
  ]);

  const existingTitles = new Set(existingScripts.map((script) => normalizeTitle(script.title)));
  const categoryByName = new Map(
    categories.map((category) => [normalizeCategoryName(category.name), category.id]),
  );

  const toCreate = STARTER_TEMPLATES.filter(
    (template) => !existingTitles.has(normalizeTitle(template.title)),
  );

  if (toCreate.length === 0) {
    return {
      createdCount: 0,
      skippedCount: STARTER_TEMPLATES.length,
      created: [] as Awaited<ReturnType<typeof findScriptsByIds>>,
    };
  }

  const createdIds = await prisma.$transaction(async (tx) => {
    const ids: string[] = [];
    for (const template of toCreate) {
      const created = await tx.scriptTemplate.create({
        data: {
          workspaceId: input.workspaceId,
          categoryId: template.categoryName
            ? (categoryByName.get(normalizeCategoryName(template.categoryName)) ?? null)
            : null,
          title: template.title,
          content: template.content,
          tags: template.tags,
          isActive: true,
          createdById: input.userId,
          updatedById: input.userId,
        },
        select: {
          id: true,
        },
      });
      ids.push(created.id);
    }
    return ids;
  });

  const created = await findScriptsByIds(createdIds);

  return {
    createdCount: created.length,
    skippedCount: STARTER_TEMPLATES.length - created.length,
    created,
  };
}
