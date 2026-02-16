import { CustomFieldType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";

export type CustomFieldValueInput = Record<string, unknown>;

export async function getCustomFieldDefinitions(
  workspaceId: string,
  entityType: "LEAD" | "CLIENT",
) {
  return prisma.customField.findMany({
    where: {
      workspaceId,
      entityType,
      isActive: true,
    },
    include: {
      options: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });
}

export async function validateCustomFields(
  workspaceId: string,
  entityType: "LEAD" | "CLIENT",
  values: CustomFieldValueInput,
) {
  const definitions = await getCustomFieldDefinitions(workspaceId, entityType);
  const errors: string[] = [];

  for (const definition of definitions) {
    const value = values[definition.key];

    if (definition.isRequired && isEmptyValue(value)) {
      errors.push(`${definition.label} is required`);
      continue;
    }

    if (isEmptyValue(value)) {
      continue;
    }

    if (definition.fieldType === CustomFieldType.NUMBER && typeof value !== "number") {
      errors.push(`${definition.label} must be a number`);
    }
    if (definition.fieldType === CustomFieldType.BOOLEAN && typeof value !== "boolean") {
      errors.push(`${definition.label} must be a boolean`);
    }
    if (definition.fieldType === CustomFieldType.DATE && Number.isNaN(Date.parse(String(value)))) {
      errors.push(`${definition.label} must be a date`);
    }
    if (
      definition.fieldType === CustomFieldType.SELECT &&
      !definition.options.some((option) => option.value === value)
    ) {
      errors.push(`${definition.label} has an invalid option`);
    }
    if (definition.fieldType === CustomFieldType.MULTI_SELECT) {
      if (!Array.isArray(value)) {
        errors.push(`${definition.label} must be a list`);
      } else {
        const invalid = value.some(
          (item) => !definition.options.some((option) => option.value === item),
        );
        if (invalid) {
          errors.push(`${definition.label} has invalid options`);
        }
      }
    }
  }

  return errors;
}

export async function syncEntityFieldValues(input: {
  tx: Prisma.TransactionClient;
  workspaceId: string;
  entityType: "LEAD" | "CLIENT";
  entityId: string;
  values: CustomFieldValueInput;
}) {
  const definitions = await input.tx.customField.findMany({
    where: {
      workspaceId: input.workspaceId,
      entityType: input.entityType,
      isActive: true,
    },
    include: { options: true },
  });

  for (const definition of definitions) {
    const value = input.values[definition.key];
    if (isEmptyValue(value)) {
      await input.tx.entityFieldValue.deleteMany({
        where: {
          workspaceId: input.workspaceId,
          entityType: input.entityType,
          entityId: input.entityId,
          customFieldId: definition.id,
        },
      });
      continue;
    }

    await input.tx.entityFieldValue.upsert({
      where: {
        workspaceId_entityType_entityId_customFieldId: {
          workspaceId: input.workspaceId,
          entityType: input.entityType,
          entityId: input.entityId,
          customFieldId: definition.id,
        },
      },
      create: {
        workspaceId: input.workspaceId,
        entityType: input.entityType,
        entityId: input.entityId,
        customFieldId: definition.id,
        ...toTypedFieldValue(definition.fieldType, value),
      },
      update: {
        ...toTypedFieldValue(definition.fieldType, value),
      },
    });
  }
}

function toTypedFieldValue(fieldType: CustomFieldType, value: unknown) {
  switch (fieldType) {
    case CustomFieldType.TEXT:
    case CustomFieldType.TEXTAREA:
    case CustomFieldType.SELECT:
      return {
        valueText: String(value),
        valueNumber: null,
        valueDate: null,
        valueBoolean: null,
        valueJson: undefined,
      };
    case CustomFieldType.NUMBER:
      return {
        valueText: null,
        valueNumber: new Prisma.Decimal(Number(value)),
        valueDate: null,
        valueBoolean: null,
        valueJson: undefined,
      };
    case CustomFieldType.DATE:
      return {
        valueText: null,
        valueNumber: null,
        valueDate: new Date(String(value)),
        valueBoolean: null,
        valueJson: undefined,
      };
    case CustomFieldType.BOOLEAN:
      return {
        valueText: null,
        valueNumber: null,
        valueDate: null,
        valueBoolean: Boolean(value),
        valueJson: undefined,
      };
    case CustomFieldType.MULTI_SELECT:
      return {
        valueText: null,
        valueNumber: null,
        valueDate: null,
        valueBoolean: null,
        valueJson: value as Prisma.InputJsonValue,
      };
    default:
      return {
        valueText: null,
        valueNumber: null,
        valueDate: null,
        valueBoolean: null,
        valueJson: value as Prisma.InputJsonValue,
      };
  }
}

function isEmptyValue(value: unknown) {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === "string" && value.trim().length === 0) {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  return false;
}
