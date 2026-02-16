import { randomUUID } from "node:crypto";

export function leadFactory(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    businessName: "Acme Services",
    email: "hello@acme.com",
    phone: "15554443333",
    city: "Austin",
    pipelineId: randomUUID(),
    stageId: randomUUID(),
    workspaceId: randomUUID(),
    ...overrides,
  };
}

export function importRowFactory(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    rowNumber: 1,
    rawJson: { businessName: "Acme Services" },
    normalizedJson: {
      emailNorm: "hello@acme.com",
      phoneNorm: "5554443333",
      domainNorm: "acme.com",
      nameNorm: "acme services",
      cityNorm: "austin",
    },
    status: "PENDING",
    ...overrides,
  };
}

export function todayItemFactory(overrides: Record<string, unknown> = {}) {
  return {
    itemType: "OVERDUE_FOLLOW_UP",
    score: 100,
    entityType: "LEAD",
    entityId: randomUUID(),
    name: "Acme Services",
    quickActions: ["LOG_CALL", "GO_TO_DETAIL"],
    ...overrides,
  };
}
