import { CustomFieldType } from "@prisma/client";
import { HttpError, ok, parseBody, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { customFieldUpdateSchema, idSchema } from "@/lib/validation";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const fieldId = idSchema.parse((await params).id);
    const body = await parseBody(request, customFieldUpdateSchema);

    const existing = await prisma.customField.findFirst({
      where: { id: fieldId, workspaceId: session.workspaceId },
    });
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "Custom field not found");
    }
    if (body.fieldType && body.fieldType !== existing.fieldType) {
      const hasValues = await prisma.entityFieldValue.count({
        where: {
          workspaceId: session.workspaceId,
          customFieldId: fieldId,
        },
      });
      if (hasValues > 0) {
        throw new HttpError(409, "CONFLICT", "Field type cannot change once values exist");
      }
      if (!Object.values(CustomFieldType).includes(body.fieldType)) {
        throw new HttpError(400, "VALIDATION_ERROR", "Invalid field type");
      }
    }

    const updated = await prisma.customField.update({
      where: { id: fieldId },
      data: {
        label: body.label,
        fieldType: body.fieldType,
        isRequired: body.isRequired,
        showInTable: body.showInTable,
        placeholder: body.placeholder,
        helperText: body.helperText,
        sortOrder: body.sortOrder,
      },
    });
    return ok(updated);
  });
}

export async function DELETE(_: Request, { params }: Params) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const fieldId = idSchema.parse((await params).id);

    const existing = await prisma.customField.findFirst({
      where: {
        id: fieldId,
        workspaceId: session.workspaceId,
      },
    });
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "Custom field not found");
    }

    await prisma.customField.update({
      where: { id: fieldId },
      data: { isActive: false },
    });
    return ok({ deleted: true });
  });
}
