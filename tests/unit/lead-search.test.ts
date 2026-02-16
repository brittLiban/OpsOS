import { buildLeadSearchWhere } from "@/lib/server/lead-search";

describe("lead search query builder", () => {
  it("builds baseline workspace scope", () => {
    const where = buildLeadSearchWhere({ workspaceId: "ws-1" });
    expect(where.workspaceId).toBe("ws-1");
    expect(where.archivedAt).toBeNull();
    expect(where.mergedIntoLeadId).toBeNull();
  });

  it("adds query filters", () => {
    const where = buildLeadSearchWhere({
      workspaceId: "ws-1",
      q: "acme",
      pipelineId: "p1",
      stageId: "s1",
      niche: "Dental",
      source: "CSV",
    });
    expect(where.pipelineId).toBe("p1");
    expect(where.stageId).toBe("s1");
    expect(where.niche).toBe("Dental");
    expect(where.source).toBe("CSV");
    expect(where.OR).toBeDefined();
  });
});
