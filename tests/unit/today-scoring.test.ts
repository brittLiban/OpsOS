import { scoreTodayItem } from "@/lib/server/today";

describe("today scoring", () => {
  it("scores overdue follow-up highest among lead follow-up rules", () => {
    expect(scoreTodayItem("OVERDUE_FOLLOW_UP")).toBe(100);
    expect(scoreTodayItem("DUE_TODAY_FOLLOW_UP")).toBe(70);
    expect(scoreTodayItem("UNTOUCHED_NEW_LEAD")).toBe(50);
  });

  it("scores billing overdue above due soon", () => {
    expect(scoreTodayItem("BILLING_OVERDUE")).toBe(95);
    expect(scoreTodayItem("BILLING_DUE_SOON")).toBe(60);
  });

  it("scores client task overdue above due", () => {
    expect(scoreTodayItem("CLIENT_TASK_OVERDUE")).toBe(90);
    expect(scoreTodayItem("CLIENT_TASK_DUE")).toBe(65);
  });
});
