import { headers } from "next/headers";
import { ensureBootstrapData } from "@/lib/server/bootstrap";
import { prisma } from "@/lib/server/prisma";

export type SessionContext = {
  workspaceId: string;
  userId: string;
  role: "OWNER" | "MEMBER";
};

export async function getSessionContext(): Promise<SessionContext> {
  const bootstrap = await ensureBootstrapData();
  const requestHeaders = await headers();
  const workspaceIdHeader = requestHeaders.get("x-workspace-id");
  const userIdHeader = requestHeaders.get("x-user-id");

  const membership = await resolveMembership(
    workspaceIdHeader ?? bootstrap.id,
    userIdHeader,
  );

  return {
    workspaceId: membership.workspaceId,
    userId: membership.userId,
    role: membership.role,
  };
}

async function resolveMembership(workspaceId: string, userIdHeader: string | null) {
  if (userIdHeader) {
    const membership = await prisma.membership.findFirst({
      where: {
        workspaceId,
        userId: userIdHeader,
      },
    });
    if (membership) {
      return membership;
    }
  }

  const fallbackMembership = await prisma.membership.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
  });

  if (!fallbackMembership) {
    throw new Error("Workspace membership not found");
  }

  return fallbackMembership;
}
