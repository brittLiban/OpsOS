import { Prisma, type Lead } from "@prisma/client";
import Papa from "papaparse";
import { isHardDuplicate, isSoftDuplicate, softDuplicateScore } from "@/lib/server/dedupe";
import { normalizeLeadPayload } from "@/lib/server/normalization";
import { prisma } from "@/lib/server/prisma";
import type { ImportRunSummary, MergeLogPayload } from "@/lib/types";

export type ColumnMapping = Record<string, string>;

type ImportCandidate = {
  rowId: string;
  rowNumber: number;
  raw: Record<string, string>;
  mapped: Record<string, unknown>;
  normalized: ReturnType<typeof normalizeLeadPayload>;
};

const CHUNK_SIZE = 100;

export async function createImportRunFromCsv(input: {
  workspaceId: string;
  uploadedById: string;
  filename: string;
  csvText: string;
  idempotencyKey?: string | null;
}) {
  if (input.idempotencyKey) {
    const existing = await prisma.importRun.findUnique({
      where: {
        workspaceId_idempotencyKey: {
          workspaceId: input.workspaceId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) {
      return existing;
    }
  }

  const parsed = Papa.parse<Record<string, string>>(input.csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
  });

  const headers = parsed.meta.fields ?? [];
  const defaultMapping = Object.fromEntries(
    headers.map((header: string) => [header, toDefaultField(header)]),
  );

  const importRun = await prisma.importRun.create({
    data: {
      workspaceId: input.workspaceId,
      uploadedById: input.uploadedById,
      filename: input.filename,
      idempotencyKey: input.idempotencyKey,
      status: "MAPPING",
      totalRows: parsed.data.length,
      columnMappingJson: defaultMapping,
    },
  });

  if (parsed.data.length > 0) {
    await prisma.importRow.createMany({
      data: parsed.data.map((row: Record<string, string>, index: number) => {
        const mapped = mapRowByMapping(row, defaultMapping);
        const normalized = normalizeLeadPayload({
          email: stringOrNull(mapped.email),
          phone: stringOrNull(mapped.phone),
          website: stringOrNull(mapped.website),
          businessName: stringOrNull(mapped.businessName),
          city: stringOrNull(mapped.city),
        });

        return {
          workspaceId: input.workspaceId,
          importRunId: importRun.id,
          rowNumber: index + 1,
          rawJson: row,
          normalizedJson: normalized,
          status: "PENDING",
        };
      }),
      skipDuplicates: true,
    });
  }

  return importRun;
}

export async function setImportColumnMapping(input: {
  workspaceId: string;
  importRunId: string;
  mapping: ColumnMapping;
}) {
  const importRun = await prisma.importRun.findFirstOrThrow({
    where: { id: input.importRunId, workspaceId: input.workspaceId },
  });

  if (importRun.status === "COMPLETED") {
    throw new Error("Cannot remap completed import run");
  }

  await prisma.importRun.update({
    where: { id: input.importRunId },
    data: {
      columnMappingJson: input.mapping,
      status: "PREVIEW_READY",
    },
  });

  const rows = await prisma.importRow.findMany({
    where: {
      importRunId: input.importRunId,
      workspaceId: input.workspaceId,
    },
    orderBy: { rowNumber: "asc" },
  });

  for (const row of rows) {
    const raw = row.rawJson as Record<string, string>;
    const mapped = mapRowByMapping(raw, input.mapping);
    const normalized = normalizeLeadPayload({
      email: stringOrNull(mapped.email),
      phone: stringOrNull(mapped.phone),
      website: stringOrNull(mapped.website),
      businessName: stringOrNull(mapped.businessName),
      city: stringOrNull(mapped.city),
    });

    await prisma.importRow.update({
      where: { id: row.id },
      data: { normalizedJson: normalized, status: "PENDING", reason: null },
    });
  }
}

export async function getImportPreview(input: {
  workspaceId: string;
  importRunId: string;
  limit?: number;
}) {
  const importRun = await prisma.importRun.findFirstOrThrow({
    where: { id: input.importRunId, workspaceId: input.workspaceId },
  });
  const mapping = (importRun.columnMappingJson ?? {}) as ColumnMapping;

  const rows = await prisma.importRow.findMany({
    where: { importRunId: input.importRunId, workspaceId: input.workspaceId },
    orderBy: { rowNumber: "asc" },
    take: Math.min(50, Math.max(1, input.limit ?? 50)),
  });

  return rows.map((row) => {
    const raw = row.rawJson as Record<string, string>;
    const mapped = mapRowByMapping(raw, mapping);
    const errors = validateMappedRow(mapped);
    return {
      id: row.id,
      rowNumber: row.rowNumber,
      raw,
      mapped,
      errors,
      normalized: row.normalizedJson as Record<string, unknown>,
    };
  });
}

export async function executeImportRun(input: {
  workspaceId: string;
  importRunId: string;
}) {
  const importRun = await prisma.importRun.findFirstOrThrow({
    where: { id: input.importRunId, workspaceId: input.workspaceId },
  });

  if (importRun.status === "COMPLETED") {
    return toImportRunSummary(importRun);
  }

  await prisma.importRun.update({
    where: { id: importRun.id },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
    },
  });

  const mapping = (importRun.columnMappingJson ?? {}) as ColumnMapping;

  const pendingRows = await prisma.importRow.findMany({
    where: {
      importRunId: importRun.id,
      workspaceId: input.workspaceId,
      status: "PENDING",
    },
    orderBy: { rowNumber: "asc" },
  });

  let processed = 0;
  let createdCount = 0;
  let hardDuplicateCount = 0;
  let softDuplicateCount = 0;
  let errorCount = 0;

  for (let i = 0; i < pendingRows.length; i += CHUNK_SIZE) {
    const chunk = pendingRows.slice(i, i + CHUNK_SIZE);
    const candidates = chunk.map((row) => toCandidate(row, mapping));

    const hardDuplicateLookup = await getHardDuplicateLookup(input.workspaceId, candidates);

    for (const candidate of candidates) {
      const errors = validateMappedRow(candidate.mapped);
      if (errors.length > 0) {
        errorCount += 1;
        processed += 1;
        await prisma.importRow.update({
          where: { id: candidate.rowId },
          data: {
            status: "ERROR",
            reason: errors.join(", "),
          },
        });
        continue;
      }

      const hardMatched = findHardDuplicate(candidate.normalized, hardDuplicateLookup);
      if (hardMatched) {
        hardDuplicateCount += 1;
        processed += 1;
        await prisma.importRow.update({
          where: { id: candidate.rowId },
          data: {
            status: "HARD_DUPLICATE",
            reason: "Hard duplicate by email/phone/domain",
            matchedLeadId: hardMatched.id,
          },
        });
        continue;
      }

      const softMatched = findSoftDuplicate(candidate.normalized, hardDuplicateLookup);
      if (softMatched) {
        softDuplicateCount += 1;
        processed += 1;
        await prisma.importRow.update({
          where: { id: candidate.rowId },
          data: {
            status: "SOFT_DUPLICATE",
            reason: "Soft duplicate by name/city",
            matchedLeadId: softMatched.id,
            softScore: softDuplicateScore(candidate.normalized, softMatched),
          },
        });
        continue;
      }

      const createdLead = await prisma.lead.create({
        data: {
          workspaceId: input.workspaceId,
          pipelineId: String(candidate.mapped.pipelineId),
          stageId: String(candidate.mapped.stageId),
          businessName: String(candidate.mapped.businessName),
          contactName: stringOrNull(candidate.mapped.contactName),
          email: stringOrNull(candidate.mapped.email),
          phone: stringOrNull(candidate.mapped.phone),
          website: stringOrNull(candidate.mapped.website),
          city: stringOrNull(candidate.mapped.city),
          source: stringOrNull(candidate.mapped.source),
          niche: stringOrNull(candidate.mapped.niche),
          customData: ((candidate.mapped.customData as Prisma.JsonObject) ?? {}) as never,
          ...candidate.normalized,
        },
      });

      createdCount += 1;
      processed += 1;

      await prisma.importRow.update({
        where: { id: candidate.rowId },
        data: {
          status: "CREATED",
          createdLeadId: createdLead.id,
        },
      });
    }

    await prisma.importRun.update({
      where: { id: importRun.id },
      data: {
        processedRows: processed,
        createdCount,
        hardDuplicateCount,
        softDuplicateCount,
        errorCount,
      },
    });
  }

  const finalized = await prisma.importRun.update({
    where: { id: importRun.id },
    data: {
      status: "COMPLETED",
      finishedAt: new Date(),
      processedRows: processed,
      createdCount,
      hardDuplicateCount,
      softDuplicateCount,
      errorCount,
    },
  });

  return toImportRunSummary(finalized);
}

export async function resolveSoftDuplicate(input: {
  workspaceId: string;
  importRunId: string;
  rowId: string;
  action: "CREATE" | "SKIP" | "LINK_EXISTING" | "MERGE";
  matchedLeadId?: string;
  chosenFields?: Record<string, "existing" | "incoming" | string>;
  reason?: string;
  userId?: string;
}) {
  const row = await prisma.importRow.findFirstOrThrow({
    where: { id: input.rowId, importRunId: input.importRunId, workspaceId: input.workspaceId },
  });

  if (row.status !== "SOFT_DUPLICATE") {
    throw new Error("Import row is not in soft duplicate status");
  }

  if (input.action === "SKIP") {
    await prisma.importRow.update({
      where: { id: row.id },
      data: { status: "SKIPPED", chosenAction: "SKIP" },
    });
    return { status: "SKIPPED" };
  }

  if (input.action === "CREATE") {
    const run = await prisma.importRun.findUniqueOrThrow({ where: { id: input.importRunId } });
    const mapping = (run.columnMappingJson ?? {}) as ColumnMapping;
    const candidate = toCandidate(row, mapping);
    const createdLead = await prisma.lead.create({
      data: {
        workspaceId: input.workspaceId,
        pipelineId: String(candidate.mapped.pipelineId),
        stageId: String(candidate.mapped.stageId),
        businessName: String(candidate.mapped.businessName),
        contactName: stringOrNull(candidate.mapped.contactName),
        email: stringOrNull(candidate.mapped.email),
        phone: stringOrNull(candidate.mapped.phone),
        website: stringOrNull(candidate.mapped.website),
        city: stringOrNull(candidate.mapped.city),
        source: stringOrNull(candidate.mapped.source),
        niche: stringOrNull(candidate.mapped.niche),
        customData: ((candidate.mapped.customData as Prisma.JsonObject) ?? {}) as never,
        ...candidate.normalized,
      },
    });
    await prisma.importRow.update({
      where: { id: row.id },
      data: {
        status: "CREATED",
        chosenAction: "CREATE",
        createdLeadId: createdLead.id,
      },
    });
    return { status: "CREATED" };
  }

  if (!input.matchedLeadId) {
    throw new Error("matchedLeadId is required for LINK_EXISTING or MERGE");
  }

  if (input.action === "LINK_EXISTING") {
    await prisma.importRow.update({
      where: { id: row.id },
      data: {
        status: "SKIPPED",
        chosenAction: "LINK_EXISTING",
        matchedLeadId: input.matchedLeadId,
      },
    });
    return { status: "LINKED" };
  }

  const mergePayload = await mergeLeadFromImport({
    workspaceId: input.workspaceId,
    importRunId: input.importRunId,
    row,
    primaryLeadId: input.matchedLeadId,
    chosenFields: input.chosenFields ?? {},
    mergedById: input.userId ?? null,
    reason: input.reason ?? "Soft duplicate merge",
  });

  await prisma.importRow.update({
    where: { id: row.id },
    data: {
      status: "MERGED",
      chosenAction: "MERGE",
      mergedIntoLeadId: input.matchedLeadId,
    },
  });

  return { status: "MERGED", mergePayload };
}

export async function mergeLeadRecords(input: {
  workspaceId: string;
  primaryLeadId: string;
  mergedLeadId: string;
  chosenFields: Record<string, "existing" | "incoming" | string>;
  reason?: string;
  mergedById?: string | null;
  importRunId?: string | null;
}) {
  const [primaryLead, mergedLead] = await Promise.all([
    prisma.lead.findFirstOrThrow({
      where: {
        id: input.primaryLeadId,
        workspaceId: input.workspaceId,
      },
    }),
    prisma.lead.findFirstOrThrow({
      where: {
        id: input.mergedLeadId,
        workspaceId: input.workspaceId,
      },
    }),
  ]);

  const resolved = resolveLeadValues(primaryLead, mergedLead, input.chosenFields);

  const beforeAfterJson = {
    before: { primaryLead, mergedLead },
    after: { primaryLead: resolved },
  };

  const updated = await prisma.$transaction(async (tx) => {
    const updatedPrimary = await tx.lead.update({
      where: { id: primaryLead.id },
      data: resolved as Prisma.LeadUpdateInput,
    });

    await tx.task.updateMany({
      where: { leadId: mergedLead.id },
      data: { leadId: primaryLead.id },
    });

    await tx.touchpoint.updateMany({
      where: { leadId: mergedLead.id },
      data: { leadId: primaryLead.id },
    });

    await tx.importRow.updateMany({
      where: { matchedLeadId: mergedLead.id },
      data: { matchedLeadId: primaryLead.id },
    });

    await tx.lead.update({
      where: { id: mergedLead.id },
      data: {
        status: "MERGED",
        mergedIntoLeadId: primaryLead.id,
      },
    });

    const mergeLog = await tx.mergeLog.create({
      data: {
        workspaceId: input.workspaceId,
        importRunId: input.importRunId,
        primaryLeadId: primaryLead.id,
        mergedLeadId: mergedLead.id,
        chosenFields: toJsonValue(input.chosenFields),
        beforeAfterJson: toJsonValue(beforeAfterJson),
        reason: input.reason,
        mergedById: input.mergedById,
      },
    });

    return {
      updatedPrimary,
      mergeLog,
    };
  });

  const payload: MergeLogPayload = {
    primaryLeadId: updated.updatedPrimary.id,
    mergedLeadId: mergedLead.id,
    chosenFields: input.chosenFields,
    beforeAfterJson: beforeAfterJson as Record<string, unknown>,
    importRunId: input.importRunId,
  };

  return {
    payload,
    mergeLogId: updated.mergeLog.id,
  };
}

async function mergeLeadFromImport(input: {
  workspaceId: string;
  importRunId: string;
  row: {
    rawJson: Prisma.JsonValue;
    normalizedJson: Prisma.JsonValue;
  };
  primaryLeadId: string;
  chosenFields: Record<string, "existing" | "incoming" | string>;
  mergedById: string | null;
  reason: string;
}) {
  const primaryLead = await prisma.lead.findFirstOrThrow({
    where: {
      id: input.primaryLeadId,
      workspaceId: input.workspaceId,
    },
  });

  const incoming = (input.row.rawJson ?? {}) as Record<string, unknown>;
  const incomingNormalized = (input.row.normalizedJson ?? {}) as Record<string, unknown>;
  const mergedPreview = applyIncomingLeadMerge(primaryLead, incoming, input.chosenFields);
  const notes = `Merged from import run ${input.importRunId} at ${new Date().toISOString()}`;

  const beforeAfterJson = {
    before: { primaryLead },
    incoming,
    incomingNormalized,
    after: { primaryLead: mergedPreview },
  };

  await prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: primaryLead.id },
      data: mergedPreview as Prisma.LeadUpdateInput,
    });

    await tx.touchpoint.create({
      data: {
        workspaceId: input.workspaceId,
        leadId: primaryLead.id,
        type: "NOTE",
        summary: notes,
        notes,
        createdById: input.mergedById,
      },
    });

    await tx.mergeLog.create({
      data: {
        workspaceId: input.workspaceId,
        importRunId: input.importRunId,
        primaryLeadId: primaryLead.id,
        mergedLeadId: primaryLead.id,
        chosenFields: toJsonValue(input.chosenFields),
        beforeAfterJson: toJsonValue(beforeAfterJson),
        reason: input.reason,
        mergedById: input.mergedById,
      },
    });
  });

  const payload: MergeLogPayload = {
    primaryLeadId: primaryLead.id,
    mergedLeadId: primaryLead.id,
    chosenFields: input.chosenFields,
    beforeAfterJson: beforeAfterJson as Record<string, unknown>,
    importRunId: input.importRunId,
  };
  return payload;
}

function applyIncomingLeadMerge(
  existingLead: Lead,
  incoming: Record<string, unknown>,
  chosenFields: Record<string, "existing" | "incoming" | string>,
) {
  const fields: (keyof Lead | "businessName" | "contactName" | "email" | "phone" | "website" | "city" | "source" | "niche")[] =
    ["businessName", "contactName", "email", "phone", "website", "city", "source", "niche"];

  const updates: Record<string, unknown> = {};

  for (const field of fields) {
    const incomingValue = incoming[field];
    const existingValue = existingLead[field as keyof Lead];
    const decision = chosenFields[field];

    if (decision === "incoming" && !isEmpty(incomingValue)) {
      updates[field] = incomingValue;
      continue;
    }

    if (isEmpty(existingValue) && !isEmpty(incomingValue)) {
      updates[field] = incomingValue;
    }
  }

  const normalized = normalizeLeadPayload({
    email: String((updates.email as string | undefined) ?? existingLead.email ?? ""),
    phone: String((updates.phone as string | undefined) ?? existingLead.phone ?? ""),
    website: String((updates.website as string | undefined) ?? existingLead.website ?? ""),
    businessName: String(
      (updates.businessName as string | undefined) ?? existingLead.businessName ?? "",
    ),
    city: String((updates.city as string | undefined) ?? existingLead.city ?? ""),
  });

  return ({
    ...updates,
    ...normalized,
  } satisfies Prisma.LeadUpdateInput);
}

function resolveLeadValues(
  existingLead: Lead,
  incomingLead: Lead,
  chosenFields: Record<string, "existing" | "incoming" | string>,
) {
  const fields: (keyof Lead)[] = [
    "businessName",
    "contactName",
    "email",
    "phone",
    "website",
    "city",
    "source",
    "niche",
  ];

  const resolved: Record<string, unknown> = {};

  for (const field of fields) {
    const existingValue = existingLead[field];
    const incomingValue = incomingLead[field];
    const decision = chosenFields[field];

    if (decision === "incoming" && !isEmpty(incomingValue)) {
      resolved[field] = incomingValue;
      continue;
    }

    if (!isEmpty(existingValue)) {
      resolved[field] = existingValue;
      continue;
    }

    if (!isEmpty(incomingValue)) {
      resolved[field] = incomingValue;
    }
  }

  const normalized = normalizeLeadPayload({
    email: String((resolved.email as string | undefined) ?? ""),
    phone: String((resolved.phone as string | undefined) ?? ""),
    website: String((resolved.website as string | undefined) ?? ""),
    businessName: String((resolved.businessName as string | undefined) ?? ""),
    city: String((resolved.city as string | undefined) ?? ""),
  });

  return ({
    ...resolved,
    ...normalized,
  } satisfies Prisma.LeadUpdateInput);
}

function toImportRunSummary(importRun: {
  id: string;
  status: string;
  totalRows: number;
  createdCount: number;
  hardDuplicateCount: number;
  softDuplicateCount: number;
  errorCount: number;
  processedRows: number;
}): ImportRunSummary {
  return {
    id: importRun.id,
    status: importRun.status as ImportRunSummary["status"],
    totalRows: importRun.totalRows,
    createdCount: importRun.createdCount,
    hardDuplicateCount: importRun.hardDuplicateCount,
    softDuplicateCount: importRun.softDuplicateCount,
    errorCount: importRun.errorCount,
    processedRows: importRun.processedRows,
  };
}

function toCandidate(
  row: {
    id: string;
    rowNumber: number;
    rawJson: Prisma.JsonValue;
  },
  mapping: ColumnMapping,
): ImportCandidate {
  const raw = row.rawJson as Record<string, string>;
  const mapped = mapRowByMapping(raw, mapping);
  const normalized = normalizeLeadPayload({
    email: stringOrNull(mapped.email),
    phone: stringOrNull(mapped.phone),
    website: stringOrNull(mapped.website),
    businessName: stringOrNull(mapped.businessName),
    city: stringOrNull(mapped.city),
  });
  return {
    rowId: row.id,
    rowNumber: row.rowNumber,
    raw,
    mapped,
    normalized,
  };
}

async function getHardDuplicateLookup(workspaceId: string, candidates: ImportCandidate[]) {
  const emailNorms = unique(candidates.map((candidate) => candidate.normalized.emailNorm));
  const phoneNorms = unique(candidates.map((candidate) => candidate.normalized.phoneNorm));
  const domainNorms = unique(candidates.map((candidate) => candidate.normalized.domainNorm));
  const nameNorms = unique(candidates.map((candidate) => candidate.normalized.nameNorm));
  const cityNorms = unique(candidates.map((candidate) => candidate.normalized.cityNorm));

  return prisma.lead.findMany({
    where: {
      workspaceId,
      mergedIntoLeadId: null,
      archivedAt: null,
      OR: [
        { emailNorm: { in: emailNorms } },
        { phoneNorm: { in: phoneNorms } },
        { domainNorm: { in: domainNorms } },
        {
          AND: [{ nameNorm: { in: nameNorms } }, { cityNorm: { in: cityNorms } }],
        },
      ],
    },
  });
}

function findHardDuplicate(
  normalized: ReturnType<typeof normalizeLeadPayload>,
  existingLeads: Lead[],
) {
  return existingLeads.find((lead) => isHardDuplicate(normalized, lead)) ?? null;
}

function findSoftDuplicate(
  normalized: ReturnType<typeof normalizeLeadPayload>,
  existingLeads: Lead[],
) {
  return existingLeads.find((lead) => isSoftDuplicate(normalized, lead)) ?? null;
}

function validateMappedRow(mapped: Record<string, unknown>) {
  const errors: string[] = [];
  if (stringOrNull(mapped.businessName) === null) {
    errors.push("businessName is required");
  }
  if (stringOrNull(mapped.pipelineId) === null) {
    errors.push("pipelineId is required");
  }
  if (stringOrNull(mapped.stageId) === null) {
    errors.push("stageId is required");
  }
  return errors;
}

function toDefaultField(header: string) {
  const normalized = header.trim().toLowerCase();
  const map: Record<string, string> = {
    businessname: "businessName",
    name: "businessName",
    contactname: "contactName",
    email: "email",
    phone: "phone",
    website: "website",
    city: "city",
    source: "source",
    niche: "niche",
  };
  return map[normalized.replace(/\s+/g, "")] ?? `custom:${normalized}`;
}

function mapRowByMapping(raw: Record<string, string>, mapping: ColumnMapping) {
  const mapped: Record<string, unknown> = {
    customData: {},
  };
  for (const [column, destination] of Object.entries(mapping)) {
    const rawValue = raw[column];
    if (!destination) {
      continue;
    }
    if (column.startsWith("$default:")) {
      const key = column.replace("$default:", "");
      mapped[key] = destination;
      continue;
    }
    if (destination.startsWith("custom:")) {
      const key = destination.replace("custom:", "");
      (mapped.customData as Record<string, string>)[key] = rawValue;
    } else {
      mapped[destination] = rawValue;
    }
  }
  return mapped;
}

function isEmpty(value: unknown) {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim().length === 0;
  }
  return false;
}

function stringOrNull(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }
  const asString = String(value).trim();
  return asString.length > 0 ? asString : null;
}

function unique(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function toJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
