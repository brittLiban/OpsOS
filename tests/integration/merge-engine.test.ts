import { beforeEach, describe, expect, it, vi } from "vitest";

const leadFindFirstOrThrow = vi.fn();
const leadUpdate = vi.fn();
const taskUpdateMany = vi.fn();
const touchpointUpdateMany = vi.fn();
const importRowUpdateMany = vi.fn();
const mergeLogCreate = vi.fn();
const leadUpdateMerged = vi.fn();
const transaction = vi.fn();

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    lead: {
      findFirstOrThrow: leadFindFirstOrThrow,
    },
    $transaction: transaction,
  },
}));

describe("merge engine integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates MergeLog and updates lead links", async () => {
    leadFindFirstOrThrow
      .mockResolvedValueOnce({
        id: "lead-primary",
        workspaceId: "ws-1",
        businessName: "Acme",
        contactName: "Alex",
        email: "a@acme.com",
        phone: "5551112222",
        website: null,
        city: "Austin",
        source: null,
        niche: null,
      })
      .mockResolvedValueOnce({
        id: "lead-merge",
        workspaceId: "ws-1",
        businessName: "Acme LLC",
        contactName: null,
        email: null,
        phone: null,
        website: "https://acme.com",
        city: "Austin",
        source: "CSV",
        niche: "Home Services",
      });

    transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        lead: {
          update: vi
            .fn()
            .mockImplementationOnce(async () => {
              leadUpdate();
              return { id: "lead-primary" };
            })
            .mockImplementationOnce(async () => {
              leadUpdateMerged();
              return { id: "lead-merge" };
            }),
        },
        task: { updateMany: taskUpdateMany.mockResolvedValue({ count: 1 }) },
        touchpoint: { updateMany: touchpointUpdateMany.mockResolvedValue({ count: 1 }) },
        importRow: { updateMany: importRowUpdateMany.mockResolvedValue({ count: 1 }) },
        mergeLog: {
          create: mergeLogCreate.mockResolvedValue({ id: "merge-1" }),
        },
      }),
    );

    const { mergeLeadRecords } = await import("@/lib/server/import-engine");

    const result = await mergeLeadRecords({
      workspaceId: "ws-1",
      primaryLeadId: "lead-primary",
      mergedLeadId: "lead-merge",
      chosenFields: {
        website: "incoming",
        source: "incoming",
      },
      reason: "Soft duplicate",
      mergedById: "user-1",
    });

    expect(result.mergeLogId).toBe("merge-1");
    expect(leadUpdate).toHaveBeenCalledTimes(1);
    expect(leadUpdateMerged).toHaveBeenCalledTimes(1);
    expect(taskUpdateMany).toHaveBeenCalledTimes(1);
    expect(touchpointUpdateMany).toHaveBeenCalledTimes(1);
    expect(importRowUpdateMany).toHaveBeenCalledTimes(1);
    expect(mergeLogCreate).toHaveBeenCalledTimes(1);
  });
});
