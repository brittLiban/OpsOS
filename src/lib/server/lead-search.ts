import type { Prisma } from "@prisma/client";

export type LeadSearchFilters = {
  workspaceId: string;
  q?: string | null;
  pipelineId?: string | null;
  stageId?: string | null;
  niche?: string | null;
  source?: string | null;
};

export function buildLeadSearchWhere(filters: LeadSearchFilters): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {
    workspaceId: filters.workspaceId,
    archivedAt: null,
    mergedIntoLeadId: null,
  };

  if (filters.q) {
    const q = filters.q.trim();
    if (q.length > 0) {
      where.OR = [
        { businessName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
      ];
    }
  }

  if (filters.pipelineId) {
    where.pipelineId = filters.pipelineId;
  }
  if (filters.stageId) {
    where.stageId = filters.stageId;
  }
  if (filters.niche) {
    where.niche = filters.niche;
  }
  if (filters.source) {
    where.source = filters.source;
  }

  return where;
}
