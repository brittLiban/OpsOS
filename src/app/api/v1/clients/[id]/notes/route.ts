import { z } from "zod";
import { ok, parseBody, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { idSchema } from "@/lib/validation";

const noteCreateSchema = z.object({
  body: z.string().trim().min(1),
});

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const clientId = idSchema.parse((await params).id);
    const notes = await prisma.clientNote.findMany({
      where: {
        workspaceId: session.workspaceId,
        clientId,
      },
      orderBy: { createdAt: "desc" },
    });
    return ok(notes);
  });
}

export async function POST(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const clientId = idSchema.parse((await params).id);
    const body = await parseBody(request, noteCreateSchema);
    const note = await prisma.clientNote.create({
      data: {
        workspaceId: session.workspaceId,
        clientId,
        authorId: session.userId,
        body: body.body,
      },
    });
    return ok(note);
  });
}
