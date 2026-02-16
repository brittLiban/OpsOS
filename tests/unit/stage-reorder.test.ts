import { reorderStageIds } from "@/lib/server/stage-order";

describe("stage reorder", () => {
  it("reorders stage ids", () => {
    expect(reorderStageIds(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("ignores invalid source index", () => {
    expect(reorderStageIds(["a", "b"], -1, 1)).toEqual(["a", "b"]);
  });

  it("ignores invalid target index", () => {
    expect(reorderStageIds(["a", "b"], 0, 10)).toEqual(["a", "b"]);
  });
});
