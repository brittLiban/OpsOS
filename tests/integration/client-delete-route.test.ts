import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionContext = vi.fn();
const clientFindFirst = vi.fn();
const entityFieldValueDeleteMany = vi.fn();
const clientDelete = vi.fn();
const prismaTransaction = vi.fn();

vi.mock("@/lib/server/auth", () => ({
  getSessionContext,
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    client: {
      findFirst: clientFindFirst,
      delete: clientDelete,
    },
    $transaction: prismaTransaction,
  },
}));

describe("client delete route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionContext.mockResolvedValue({
      workspaceId: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
    });
    prismaTransaction.mockImplementation(async (callback) =>
      callback({
        entityFieldValue: {
          deleteMany: entityFieldValueDeleteMany,
        },
        client: {
          delete: clientDelete,
        },
      }),
    );
    entityFieldValueDeleteMany.mockResolvedValue({ count: 1 });
    clientDelete.mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333" });
  });

  it("deletes a client and related field values", async () => {
    clientFindFirst.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
    });

    const { DELETE } = await import("@/app/api/v1/clients/[id]/route");
    const response = await DELETE(new Request("http://localhost/api/v1/clients/333", {}), {
      params: Promise.resolve({ id: "33333333-3333-4333-8333-333333333333" }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toMatchObject({
      deleted: true,
      id: "33333333-3333-4333-8333-333333333333",
    });
    expect(clientFindFirst).toHaveBeenCalledTimes(1);
    expect(entityFieldValueDeleteMany).toHaveBeenCalledTimes(1);
    expect(clientDelete).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when client does not exist in workspace", async () => {
    clientFindFirst.mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/v1/clients/[id]/route");
    const response = await DELETE(new Request("http://localhost/api/v1/clients/missing", {}), {
      params: Promise.resolve({ id: "44444444-4444-4444-8444-444444444444" }),
    });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error.code).toBe("NOT_FOUND");
    expect(clientDelete).not.toHaveBeenCalled();
  });
});
