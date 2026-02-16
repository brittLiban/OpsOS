import { HttpError, ok, parseBody, parseSearchParams, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import {
  customFieldCreateSchema,
  customFieldUpdateSchema,
} from "@/lib/validation";

const listQuerySchema = customFieldUpdateSchema.pick({
  entityType: true,
});

export async function GET(request: Request) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const query = parseSearchParams(
      request,
      listQuerySchema.extend({
        entityType: customFieldCreateSchema.shape.entityType.default("LEAD"),
      }),
    );

    const fields = await prisma.customField.findMany({
      where: {
        workspaceId: session.workspaceId,
        entityType: query.entityType ?? "LEAD",
      },
      include: {
        options: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { sortOrder: "asc" },
    });
    return ok(fields);
  });
}

export async function POST(request: Request) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const body = await parseBody(request, customFieldCreateSchema);

    const existing = await prisma.customField.findFirst({
      where: {
        workspaceId: session.workspaceId,
        entityType: body.entityType,
        key: body.key,
      },
    });
    if (existing) {
      throw new HttpError(409, "CONFLICT", "Custom field key already exists");
    }

    const created = await prisma.customField.create({
      data: {
        workspaceId: session.workspaceId,
        entityType: body.entityType,
        key: body.key,
        label: body.label,
        fieldType: body.fieldType,
        isRequired: body.isRequired,
        showInTable: body.showInTable,
        placeholder: body.placeholder,
        helperText: body.helperText,
        sortOrder: body.sortOrder,
      },
    });

    return ok(created);
  });
}
