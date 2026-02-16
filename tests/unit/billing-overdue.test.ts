import { BillingStatus } from "@prisma/client";
import { shouldMarkBillingOverdue } from "@/lib/server/billing";

describe("billing overdue rules", () => {
  const now = new Date("2026-02-16T12:00:00.000Z");

  it("marks due records overdue when due date is before today", () => {
    expect(
      shouldMarkBillingOverdue({
        dueDate: new Date("2026-02-15T00:00:00.000Z"),
        status: BillingStatus.DUE,
        now,
      }),
    ).toBe(true);
  });

  it("does not mark paid records overdue", () => {
    expect(
      shouldMarkBillingOverdue({
        dueDate: new Date("2026-02-10T00:00:00.000Z"),
        status: BillingStatus.PAID,
        now,
      }),
    ).toBe(false);
  });

  it("does not mark same-day due as overdue", () => {
    expect(
      shouldMarkBillingOverdue({
        dueDate: new Date("2026-02-16T00:00:00.000Z"),
        status: BillingStatus.DUE,
        now,
      }),
    ).toBe(false);
  });
});
