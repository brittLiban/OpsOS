import { NextResponse } from "next/server";
import {
  finalizeIntegrationCallback,
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
  const search = new URL(request.url).searchParams;
  const providerSlug = (await params).provider.toLowerCase();

  const oauthError = search.get("error");
  if (oauthError) {
    const description =
      search.get("error_description") ?? "Provider denied authorization";
    return NextResponse.redirect(
      new URL(
        integrationSettingsUrl({
          status: "error",
          provider: providerSlug,
          message: description,
        }),
        request.url,
      ),
    );
  }

  const code = search.get("code");
  const state = search.get("state");
  if (!code || !state) {
    return NextResponse.redirect(
      new URL(
        integrationSettingsUrl({
          status: "error",
          provider: providerSlug,
          message: "Missing authorization code or state.",
        }),
        request.url,
      ),
    );
  }

  try {
    const provider = parseIntegrationProviderSlug(providerSlug);
    await finalizeIntegrationCallback({ provider, state, code });
    return NextResponse.redirect(
      new URL(
        integrationSettingsUrl({
          status: "connected",
          provider: providerSlug,
        }),
        request.url,
      ),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to complete integration";
    return NextResponse.redirect(
      new URL(
        integrationSettingsUrl({
          status: "error",
          provider: providerSlug,
          message,
        }),
        request.url,
      ),
    );
  }
}
