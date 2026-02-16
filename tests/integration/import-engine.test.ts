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

  it("recovers wrapped single-column csv rows and applies alias mapping", async () => {
    importRunFindUnique.mockResolvedValue(null);
    importRunCreate.mockResolvedValue({
      id: "run-2",
      status: "MAPPING",
      totalRows: 1,
      createdCount: 0,
      hardDuplicateCount: 0,
      softDuplicateCount: 0,
      errorCount: 0,
      processedRows: 0,
    });
    importRowCreateMany.mockResolvedValue({ count: 1 });

    const { createImportRunFromCsv } = await import("@/lib/server/import-engine");

    const wrappedCsv = `"company_name,primary_phone,website_url,city_or_town,notes,source_url"
"Three Tree Roofing Company, LLC,(206) 312-7663,www.threetreeroofing.com,Kent,""BBB Accredited; A+; Years in Business: 8"",https://www.bbb.org/us/wa/kent/profile/roofing-contractors/three-tree-roofing-company-llc-1296-22644784"`;

    const run = await createImportRunFromCsv({
      workspaceId: "ws-1",
      uploadedById: "user-1",
      filename: "wrapped.csv",
      csvText: wrappedCsv,
      idempotencyKey: "idem-2",
    });

    expect(run.id).toBe("run-2");
    expect(importRunCreate).toHaveBeenCalledTimes(1);

    const runCreateData = importRunCreate.mock.calls[0][0].data;
    expect(runCreateData.totalRows).toBe(1);
    expect(runCreateData.columnMappingJson).toMatchObject({
      company_name: "businessName",
      primary_phone: "phone",
      website_url: "website",
      city_or_town: "city",
      source_url: "source",
    });

    expect(importRowCreateMany).toHaveBeenCalledTimes(1);
    const [firstRow] = importRowCreateMany.mock.calls[0][0].data;
    expect(firstRow.rawJson).toMatchObject({
      company_name: "Three Tree Roofing Company, LLC",
      primary_phone: "(206) 312-7663",
      website_url: "www.threetreeroofing.com",
      city_or_town: "Kent",
    });
  });
});
