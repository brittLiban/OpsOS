import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/server/auth";
import {
  createIntegrationConnectUrl,
  parseIntegrationProviderSlug,
} from "@/lib/server/integrations";

type Params = {
  params: Promise<{
    provider: string;
  }>;
};

function integrationSettingsUrl(search?: Record<string, string>) {
  const url = new URL("/settings/integrations", "http://localhost");
  for (const [key, value] of Object.entries(search ?? {})) {
    url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}`;
}

export async function GET(request: Request, { params }: Params) {
  const session = await getSessionContext();
  if (session.role !== "OWNER") {
    return NextResponse.redirect(
      new URL(
        integrationSettingsUrl({
          status: "error",
          message: "Only workspace owners can manage integrations.",
        }),
        request.url,
      ),
    );
  }

  try {
    const provider = parseIntegrationProviderSlug((await params).provider);
    const connectUrl = await createIntegrationConnectUrl({
      workspaceId: session.workspaceId,
      userId: session.userId,
      provider,
    });
    return NextResponse.redirect(connectUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to start integration flow";
    return NextResponse.redirect(
      new URL(
        integrationSettingsUrl({
          status: "error",
          message,
        }),
        request.url,
      ),
    );
  }
}
