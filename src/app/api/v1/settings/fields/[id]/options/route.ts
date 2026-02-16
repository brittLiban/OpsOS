import { HttpError, ok, parseBody, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { customFieldOptionCreateSchema, idSchema } from "@/lib/validation";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const fieldId = idSchema.parse((await params).id);
    const body = await parseBody(request, customFieldOptionCreateSchema);

    const field = await prisma.customField.findFirst({
      where: {
        id: fieldId,
        workspaceId: session.workspaceId,
      },
    });
    if (!field) {
      throw new HttpError(404, "NOT_FOUND", "Custom field not found");
    }

    const option = await prisma.customFieldOption.create({
      data: {
        customFieldId: fieldId,
        label: body.label,
        value: body.value,
        sortOrder: body.sortOrder,
        isActive: body.isActive,
      },
    });
    return ok(option);
  });
}
