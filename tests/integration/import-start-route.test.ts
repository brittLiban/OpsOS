import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionContext = vi.fn();
const createImportRunFromCsv = vi.fn();
const xlsxRead = vi.fn();
const sheetToCsv = vi.fn();

vi.mock("@/lib/server/auth", () => ({
  getSessionContext,
}));

vi.mock("@/lib/server/import-engine", () => ({
  createImportRunFromCsv,
}));

vi.mock("xlsx", () => ({
  read: xlsxRead,
  utils: {
    sheet_to_csv: sheetToCsv,
  },
}));

describe("imports start route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionContext.mockResolvedValue({
      workspaceId: "ws-1",
      userId: "user-1",
    });
    createImportRunFromCsv.mockResolvedValue({
      id: "run-1",
    });
  });

  it("accepts csv files", async () => {
    const { POST } = await import("@/app/api/v1/imports/start/route");

    const formData = new FormData();
    formData.append(
      "file",
      new File(["businessName,phone\nAcme,1111111111"], "leads.csv", { type: "text/csv" }),
    );
    formData.append("idempotencyKey", "idem-1");

    const request = new Request("http://localhost/api/v1/imports/start", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.id).toBe("run-1");
    expect(createImportRunFromCsv).toHaveBeenCalledTimes(1);
    expect(createImportRunFromCsv.mock.calls[0][0]).toMatchObject({
      workspaceId: "ws-1",
      uploadedById: "user-1",
      filename: "leads.csv",
      idempotencyKey: "idem-1",
    });
    expect(String(createImportRunFromCsv.mock.calls[0][0].csvText)).toContain("businessName");
  });

  it("accepts excel files and converts first sheet to csv", async () => {
    const { POST } = await import("@/app/api/v1/imports/start/route");

    xlsxRead.mockReturnValue({
      SheetNames: ["Sheet1"],
      Sheets: {
        Sheet1: {},
      },
    });
    sheetToCsv.mockReturnValue("businessName,phone\nAcme,1111111111");

    const formData = new FormData();
    formData.append(
      "file",
      new File([new Uint8Array([1, 2, 3])], "leads.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    formData.append("idempotencyKey", "idem-2");

    const request = new Request("http://localhost/api/v1/imports/start", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.id).toBe("run-1");
    expect(xlsxRead).toHaveBeenCalledTimes(1);
    expect(sheetToCsv).toHaveBeenCalledTimes(1);
    expect(createImportRunFromCsv).toHaveBeenCalledTimes(1);
    expect(createImportRunFromCsv.mock.calls[0][0]).toMatchObject({
      workspaceId: "ws-1",
      uploadedById: "user-1",
      filename: "leads.xlsx",
      idempotencyKey: "idem-2",
      csvText: "businessName,phone\nAcme,1111111111",
    });
  });

  it("rejects unsupported file extensions", async () => {
    const { POST } = await import("@/app/api/v1/imports/start/route");

    const formData = new FormData();
    formData.append("file", new File(["hello"], "leads.txt", { type: "text/plain" }));

    const request = new Request("http://localhost/api/v1/imports/start", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(String(json.error.message)).toContain(".xlsx");
    expect(createImportRunFromCsv).not.toHaveBeenCalled();
  });
});
