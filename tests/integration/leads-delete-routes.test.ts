import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionContext = vi.fn();
const leadFindFirst = vi.fn();
const leadFindMany = vi.fn();
const leadDelete = vi.fn();
const leadDeleteMany = vi.fn();
const entityFieldValueDeleteMany = vi.fn();
const mergeLogDeleteMany = vi.fn();
const prismaTransaction = vi.fn();

vi.mock("@/lib/server/auth", () => ({
  getSessionContext,
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    lead: {
      findFirst: leadFindFirst,
      findMany: leadFindMany,
      delete: leadDelete,
      deleteMany: leadDeleteMany,
    },
    entityFieldValue: {
      deleteMany: entityFieldValueDeleteMany,
    },
    mergeLog: {
      deleteMany: mergeLogDeleteMany,
    },
    $transaction: prismaTransaction,
  },
}));

describe("lead delete routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionContext.mockResolvedValue({
      workspaceId: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
    });
    prismaTransaction.mockImplementation(async (callback) =>
      callback({
        lead: {
          delete: leadDelete,
          deleteMany: leadDeleteMany,
        },
        entityFieldValue: {
          deleteMany: entityFieldValueDeleteMany,
        },
        mergeLog: {
          deleteMany: mergeLogDeleteMany,
        },
      }),
    );
    entityFieldValueDeleteMany.mockResolvedValue({ count: 1 });
    mergeLogDeleteMany.mockResolvedValue({ count: 1 });
    leadDelete.mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333" });
    leadDeleteMany.mockResolvedValue({ count: 2 });
  });

  it("deletes one lead by id", async () => {
    leadFindFirst.mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333" });

    const { DELETE } = await import("@/app/api/v1/leads/[id]/route");
    const response = await DELETE(new Request("http://localhost/api/v1/leads/333"), {
      params: Promise.resolve({ id: "33333333-3333-4333-8333-333333333333" }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toMatchObject({
      deleted: true,
      id: "33333333-3333-4333-8333-333333333333",
    });
    expect(leadDelete).toHaveBeenCalledTimes(1);
  });

  it("deletes all leads in workspace", async () => {
    leadFindMany.mockResolvedValue([
      { id: "33333333-3333-4333-8333-333333333333" },
      { id: "44444444-4444-4444-8444-444444444444" },
    ]);

    const { DELETE } = await import("@/app/api/v1/leads/route");
    const response = await DELETE(
      new Request("http://localhost/api/v1/leads", {
        method: "DELETE",
        body: JSON.stringify({ deleteAll: true }),
        headers: { "content-type": "application/json" },
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.deleted).toBe(true);
    expect(json.data.count).toBe(2);
    expect(leadDeleteMany).toHaveBeenCalledTimes(1);
  });
});
