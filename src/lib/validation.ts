import { z } from "zod";
import {
  BillingStatus,
  CustomFieldEntityType,
  CustomFieldType,
  ImportRowAction,
  StageColor,
  StageType,
  TaskPriority,
  TaskStatus,
  TouchpointType,
} from "@prisma/client";

export const idSchema = z.string().uuid();
export const optionalStringSchema = z.string().trim().optional().nullable();
export const optionalDateSchema = z
  .union([z.string(), z.date()])
  .transform((value) => (value ? new Date(value) : null))
  .optional()
  .nullable();

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const leadListQuerySchema = paginationQuerySchema.extend({
  q: z.string().optional(),
  pipelineId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  niche: z.string().optional(),
  source: z.string().optional(),
});

export const leadCreateSchema = z.object({
  pipelineId: idSchema,
  stageId: idSchema,
  ownerId: idSchema.optional().nullable(),
  businessName: z.string().trim().min(1),
  contactName: optionalStringSchema,
  email: optionalStringSchema,
  phone: optionalStringSchema,
  website: optionalStringSchema,
  city: optionalStringSchema,
  source: optionalStringSchema,
  niche: optionalStringSchema,
  leadValue: z.coerce.number().optional().nullable(),
  nextFollowUpAt: optionalDateSchema,
  customData: z.record(z.string(), z.unknown()).default({}),
});

export const leadUpdateSchema = leadCreateSchema.partial();

export const touchpointCreateSchema = z.object({
  type: z.nativeEnum(TouchpointType),
  outcome: optionalStringSchema,
  summary: optionalStringSchema,
  notes: optionalStringSchema,
  happenedAt: optionalDateSchema,
  nextFollowUpAt: optionalDateSchema,
});

export const touchpointUpdateSchema = touchpointCreateSchema.partial();

export const taskCreateSchema = z.object({
  leadId: idSchema.optional().nullable(),
  clientId: idSchema.optional().nullable(),
  taskTypeId: idSchema.optional().nullable(),
  title: z.string().trim().min(1),
  description: optionalStringSchema,
  customData: z.record(z.string(), z.unknown()).default({}),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.TODO),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  dueAt: optionalDateSchema,
  assigneeId: idSchema.optional().nullable(),
});

export const taskUpdateSchema = taskCreateSchema.partial();

export const pipelineCreateSchema = z.object({
  name: z.string().trim().min(1),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const pipelineUpdateSchema = pipelineCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const stageCreateSchema = z.object({
  name: z.string().trim().min(1),
  sortOrder: z.number().int().min(0),
  color: z.nativeEnum(StageColor),
  stageType: z.nativeEnum(StageType),
});

export const stageUpdateSchema = stageCreateSchema.partial();

export const stageReorderSchema = z.object({
  stageIds: z.array(idSchema).min(1),
});

export const customFieldCreateSchema = z.object({
  entityType: z.nativeEnum(CustomFieldEntityType),
  key: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9_]+$/),
  label: z.string().trim().min(1),
  fieldType: z.nativeEnum(CustomFieldType),
  isRequired: z.boolean().default(false),
  showInTable: z.boolean().default(false),
  placeholder: optionalStringSchema,
  helperText: optionalStringSchema,
  sortOrder: z.number().int().default(0),
});

export const customFieldUpdateSchema = customFieldCreateSchema.partial();

export const customFieldOptionCreateSchema = z.object({
  label: z.string().trim().min(1),
  value: z.string().trim().min(1),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const customFieldOptionUpdateSchema = customFieldOptionCreateSchema.partial();

export const importStartSchema = z.object({
  idempotencyKey: z.string().trim().optional(),
});

export const importMappingSchema = z.object({
  mapping: z.record(z.string(), z.string()),
});

export const importResultsQuerySchema = paginationQuerySchema.extend({
  tab: z.enum(["created", "hard", "soft", "errors"]).default("created"),
});

export const resolveSoftDuplicateSchema = z.object({
  action: z.nativeEnum(ImportRowAction),
  matchedLeadId: z.string().uuid().optional(),
  chosenFields: z.record(z.string(), z.string()).optional(),
  reason: z.string().optional(),
});

export const mergeLeadSchema = z.object({
  primaryLeadId: idSchema,
  mergedLeadId: idSchema,
  chosenFields: z.record(z.string(), z.string()),
  reason: optionalStringSchema,
});

export const clientCreateSchema = z.object({
  sourceLeadId: idSchema.optional().nullable(),
  ownerId: idSchema.optional().nullable(),
  name: z.string().trim().min(1),
  primaryContactName: optionalStringSchema,
  email: optionalStringSchema,
  phone: optionalStringSchema,
  status: z.string().optional(),
  customData: z.record(z.string(), z.unknown()).default({}),
});

export const clientUpdateSchema = clientCreateSchema.partial();

export const convertLeadSchema = z.object({
  createInitialBilling: z.boolean().default(false),
  billingTypeKey: z.string().optional(),
  billingAmount: z.coerce.number().optional(),
  billingDueDate: optionalDateSchema,
});

export const billingListQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(BillingStatus).optional(),
  billingTypeId: idSchema.optional(),
  dueFrom: z.string().optional(),
  dueTo: z.string().optional(),
});

export const billingCreateSchema = z.object({
  clientId: idSchema,
  billingTypeId: idSchema,
  amount: z.coerce.number().positive(),
  dueDate: z.union([z.string(), z.date()]).transform((value) => new Date(value)),
  notes: optionalStringSchema,
});

export const billingUpdateSchema = billingCreateSchema.partial().extend({
  status: z.nativeEnum(BillingStatus).optional(),
  paidAt: optionalDateSchema,
});

export const markPaidSchema = z.object({
  paidAt: optionalDateSchema,
});

export const scriptListQuerySchema = paginationQuerySchema.extend({
  q: z.string().optional(),
  categoryId: idSchema.optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
});

export const scriptCreateSchema = z.object({
  categoryId: idSchema.optional().nullable(),
  title: z.string().trim().min(1),
  content: z.string().trim().min(1),
  tags: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

export const scriptUpdateSchema = scriptCreateSchema.partial();

export const todayQuerySchema = z.object({
  date: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  ownerScope: z.enum(["me", "all"]).default("me"),
});

export const calendarEventsQuerySchema = z
  .object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
  })
  .refine(
    (value) => {
      if (!value.start || !value.end) {
        return true;
      }
      return new Date(value.end).getTime() > new Date(value.start).getTime();
    },
    {
      path: ["end"],
      message: "end must be greater than start",
    },
  );

const calendarDateTimeInputSchema = z
  .union([z.string(), z.date()])
  .transform((value) => new Date(value))
  .refine((value) => !Number.isNaN(value.getTime()), {
    message: "Invalid date value",
  });

export const calendarEventCreateSchema = z
  .object({
    provider: z.enum(["google", "microsoft"]),
    title: z.string().trim().min(1).max(200),
    description: optionalStringSchema,
    location: optionalStringSchema,
    isAllDay: z.coerce.boolean().default(false),
    startAt: calendarDateTimeInputSchema,
    endAt: calendarDateTimeInputSchema.optional().nullable(),
  })
  .refine(
    (value) => {
      if (!value.endAt) {
        return true;
      }
      return value.endAt.getTime() > value.startAt.getTime();
    },
    {
      path: ["endAt"],
      message: "endAt must be after startAt",
    },
  );
