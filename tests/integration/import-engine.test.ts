import { beforeEach, describe, expect, it, vi } from "vitest";

const importRunFindUnique = vi.fn();
const importRunCreate = vi.fn();
const importRowCreateMany = vi.fn();

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    importRun: {
      findUnique: importRunFindUnique,
      create: importRunCreate,
    },
    importRow: {
      createMany: importRowCreateMany,
    },
  },
}));

describe("import engine integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses csv and inserts ImportRun + ImportRow records", async () => {
    importRunFindUnique.mockResolvedValue(null);
    importRunCreate.mockResolvedValue({
      id: "run-1",
      status: "MAPPING",
      totalRows: 2,
      createdCount: 0,
      hardDuplicateCount: 0,
      softDuplicateCount: 0,
      errorCount: 0,
      processedRows: 0,
    });
    importRowCreateMany.mockResolvedValue({ count: 2 });

    const { createImportRunFromCsv } = await import("@/lib/server/import-engine");

    const csv = `businessName,email,phone,city
Acme Services,hello@acme.com,15554443333,Austin
North Dental,north@dental.com,15551112222,Dallas`;

    const run = await createImportRunFromCsv({
      workspaceId: "ws-1",
      uploadedById: "user-1",
      filename: "leads.csv",
      csvText: csv,
      idempotencyKey: "idem-1",
    });

    expect(run.id).toBe("run-1");
    expect(importRunCreate).toHaveBeenCalledTimes(1);
    expect(importRunCreate.mock.calls[0][0].data.totalRows).toBe(2);
    expect(importRowCreateMany).toHaveBeenCalledTimes(1);
    expect(importRowCreateMany.mock.calls[0][0].data).toHaveLength(2);
  });
});
