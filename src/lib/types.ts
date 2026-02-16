import type {
  BillingStatus,
  CustomFieldEntityType,
  CustomFieldType,
  ImportRowStatus,
  ImportRunStatus,
  StageType,
  TaskStatus,
  TouchpointType,
} from "@prisma/client";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "IMPORT_STATE_INVALID"
  | "INTERNAL_ERROR";

export type ApiSuccess<T> = {
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    nextCursor?: string | null;
  };
};

export type ApiError = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
};

export type Paged<T> = {
  rows: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type TodayItemType =
  | "OVERDUE_FOLLOW_UP"
  | "DUE_TODAY_FOLLOW_UP"
  | "UNTOUCHED_NEW_LEAD"
  | "CLIENT_TASK_DUE"
  | "CLIENT_TASK_OVERDUE"
  | "BILLING_DUE_SOON"
  | "BILLING_OVERDUE";

export type TodayQuickAction =
  | "LOG_CALL"
  | "SNOOZE_1D"
  | "SNOOZE_3D"
  | "SNOOZE_7D"
  | "MARK_DONE"
  | "GO_TO_DETAIL"
  | "INSERT_SCRIPT";

export type TodayItem = {
  itemType: TodayItemType;
  score: number;
  entityType: "LEAD" | "CLIENT_TASK" | "BILLING";
  entityId: string;
  name: string;
  stageBadge?: {
    label: string;
    stageType: StageType;
  };
  lastTouchpoint?: {
    type: TouchpointType;
    summary: string | null;
    happenedAt: string;
  };
  dueAt?: string;
  quickActions: TodayQuickAction[];
};

export type ImportRunSummary = {
  id: string;
  status: ImportRunStatus;
  totalRows: number;
  createdCount: number;
  hardDuplicateCount: number;
  softDuplicateCount: number;
  errorCount: number;
  processedRows: number;
};

export type ImportRowResult = {
  id: string;
  rowNumber: number;
  status: ImportRowStatus;
  reason?: string | null;
  rawJson: Record<string, unknown>;
  normalizedJson: Record<string, unknown>;
  matchedLeadId?: string | null;
  softScore?: number | null;
};

export type MergeLogPayload = {
  primaryLeadId: string;
  mergedLeadId: string;
  chosenFields: Record<string, "existing" | "incoming" | string>;
  beforeAfterJson: Record<string, unknown>;
  importRunId?: string | null;
};

export type CustomFieldRenderDefinition = {
  id: string;
  key: string;
  label: string;
  fieldType: CustomFieldType;
  entityType: CustomFieldEntityType;
  isRequired: boolean;
  showInTable: boolean;
  placeholder: string | null;
  helperText: string | null;
  options: { label: string; value: string }[];
};

export type TaskListItem = {
  id: string;
  title: string;
  status: TaskStatus;
  dueAt: string | null;
  leadId: string | null;
  clientId: string | null;
};

export type BillingListItem = {
  id: string;
  clientId: string;
  clientName: string;
  billingType: string;
  amount: string;
  dueDate: string;
  status: BillingStatus;
};
