import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionContext = vi.fn();
const importRunFindFirst = vi.fn();
const importRunFindMany = vi.fn();
const importRunDelete = vi.fn();
const importRunDeleteMany = vi.fn();

vi.mock("@/lib/server/auth", () => ({
  getSessionContext,
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    importRun: {
      findFirst: importRunFindFirst,
      findMany: importRunFindMany,
      delete: importRunDelete,
      deleteMany: importRunDeleteMany,
    },
  },
}));

describe("import delete routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionContext.mockResolvedValue({
      workspaceId: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
    });
    importRunDelete.mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333" });
    importRunDeleteMany.mockResolvedValue({ count: 2 });
  });

  it("deletes one import run by id", async () => {
    importRunFindFirst.mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333" });

    const { DELETE } = await import("@/app/api/v1/imports/[id]/route");
    const response = await DELETE(new Request("http://localhost/api/v1/imports/333"), {
      params: Promise.resolve({ id: "33333333-3333-4333-8333-333333333333" }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toMatchObject({
      deleted: true,
      id: "33333333-3333-4333-8333-333333333333",
    });
    expect(importRunDelete).toHaveBeenCalledTimes(1);
  });

  it("deletes all import runs in workspace", async () => {
    importRunFindMany.mockResolvedValue([
      { id: "33333333-3333-4333-8333-333333333333" },
      { id: "44444444-4444-4444-8444-444444444444" },
    ]);

    const { DELETE } = await import("@/app/api/v1/imports/route");
    const response = await DELETE(
      new Request("http://localhost/api/v1/imports", {
        method: "DELETE",
        body: JSON.stringify({ deleteAll: true }),
        headers: { "content-type": "application/json" },
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.deleted).toBe(true);
    expect(json.data.count).toBe(2);
    expect(importRunDeleteMany).toHaveBeenCalledTimes(1);
  });
});
