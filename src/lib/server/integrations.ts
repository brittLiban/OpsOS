import crypto from "node:crypto";
import { IntegrationProvider, IntegrationStatus } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import {
  decryptSecretValue,
  encryptSecretValue,
  isSecretEncryptionConfigured,
  toSecretHint,
} from "@/lib/server/secrets";

type ProviderMeta = {
  slug: "google" | "microsoft";
  label: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
  redirectUriEnv: string;
};

type ProviderConfigSource = "workspace" | "env" | "none";

type ProviderOAuthConfig = {
  provider: IntegrationProvider;
  slug: "google" | "microsoft";
  label: string;
  requiredEnv: [string, string];
  source: ProviderConfigSource;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  clientIdHint: string | null;
  clientSecretHint: string | null;
  configReady: boolean;
  configError: string | null;
};

const PROVIDER_META: Record<IntegrationProvider, ProviderMeta> = {
  [IntegrationProvider.GOOGLE]: {
    slug: "google",
    label: "Google (Gmail + Calendar)",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/calendar",
    ],
    clientIdEnv: "GOOGLE_OAUTH_CLIENT_ID",
    clientSecretEnv: "GOOGLE_OAUTH_CLIENT_SECRET",
    redirectUriEnv: "GOOGLE_OAUTH_REDIRECT_URI",
  },
  [IntegrationProvider.MICROSOFT]: {
    slug: "microsoft",
    label: "Microsoft 365 (Outlook + Calendar)",
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: [
      "openid",
      "profile",
      "offline_access",
      "User.Read",
      "Mail.Read",
      "Mail.Send",
      "Calendars.Read",
      "Calendars.ReadWrite",
    ],
    clientIdEnv: "MICROSOFT_OAUTH_CLIENT_ID",
    clientSecretEnv: "MICROSOFT_OAUTH_CLIENT_SECRET",
    redirectUriEnv: "MICROSOFT_OAUTH_REDIRECT_URI",
  },
};

const PROVIDER_FROM_SLUG: Record<"google" | "microsoft", IntegrationProvider> = {
  google: IntegrationProvider.GOOGLE,
  microsoft: IntegrationProvider.MICROSOFT,
};

export type IntegrationProviderSlug = keyof typeof PROVIDER_FROM_SLUG;

export type IntegrationProviderSummary = {
  provider: IntegrationProvider;
  slug: IntegrationProviderSlug;
  label: string;
  requiredEnv: [string, string];
  configSource: ProviderConfigSource;
  configReady: boolean;
  clientIdHint: string | null;
  clientSecretHint: string | null;
  redirectUri: string;
  configError: string | null;
  connected: boolean;
  status: IntegrationStatus | "DISCONNECTED";
  accountEmail: string | null;
  connectedAt: Date | null;
  tokenExpiresAt: Date | null;
  lastError: string | null;
};

export type IntegrationSettingsSummary = {
  schemaReady: boolean;
  encryptionReady: boolean;
  providers: IntegrationProviderSummary[];
};

export type IntegrationPreview = {
  provider: IntegrationProvider;
  emails: { id: string; subject: string; from: string | null; receivedAt: string | null }[];
  events: { id: string; title: string; startAt: string | null; endAt: string | null }[];
};

export type SyncedCalendarEvent = {
  id: string;
  provider: IntegrationProvider;
  providerSlug: IntegrationProviderSlug;
  title: string;
  startAt: string;
  endAt: string | null;
  isAllDay: boolean;
  link: string | null;
};

export type SyncedCalendarProviderStatus = {
  provider: IntegrationProvider;
  slug: IntegrationProviderSlug;
  label: string;
  connected: boolean;
  synced: boolean;
  lastError: string | null;
};

export type SyncedCalendarResult = {
  windowStart: string;
  windowEnd: string;
  hasConnectedProviders: boolean;
  providers: SyncedCalendarProviderStatus[];
  events: SyncedCalendarEvent[];
};

type OAuthTokenPayload = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scopes: string[];
};

function getAppBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

function getProviderMeta(provider: IntegrationProvider) {
  return PROVIDER_META[provider];
}

function getProviderDefaultRedirectUri(meta: ProviderMeta) {
  return `${getAppBaseUrl()}/api/v1/settings/integrations/${meta.slug}/callback`;
}

function toPublicHint(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length <= 6) {
    return `${trimmed.slice(0, 2)}***`;
  }
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

function toEnvProviderConfig(provider: IntegrationProvider): ProviderOAuthConfig {
  const meta = getProviderMeta(provider);
  const clientId = process.env[meta.clientIdEnv] ?? "";
  const clientSecret = process.env[meta.clientSecretEnv] ?? "";
  const redirectUri = process.env[meta.redirectUriEnv] ?? getProviderDefaultRedirectUri(meta);
  const source: ProviderConfigSource =
    clientId.length > 0 || clientSecret.length > 0 ? "env" : "none";

  return {
    provider,
    slug: meta.slug,
    label: meta.label,
    requiredEnv: [meta.clientIdEnv, meta.clientSecretEnv],
    source,
    clientId,
    clientSecret,
    redirectUri,
    clientIdHint: toPublicHint(clientId),
    clientSecretHint: clientSecret.length > 0 ? toSecretHint(clientSecret) : null,
    configReady: clientId.length > 0 && clientSecret.length > 0,
    configError: null,
  };
}

function isIntegrationSchemaMismatchError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes("integrationaccount") ||
    message.includes("integrationauthsession") ||
    message.includes("integrationproviderconfig") ||
    message.includes("integrationprovider") ||
    message.includes("relation \"integrationaccount\" does not exist") ||
    message.includes("relation \"integrationauthsession\" does not exist") ||
    message.includes("relation \"integrationproviderconfig\" does not exist")
  );
}

function randomBase64Url(byteLength: number) {
  return crypto.randomBytes(byteLength).toString("base64url");
}

function toCodeChallenge(codeVerifier: string) {
  return crypto.createHash("sha256").update(codeVerifier).digest("base64url");
}

function toProviderSummaryDefaults(): IntegrationProviderSummary[] {
  return Object.values(IntegrationProvider).map((provider) => {
    const config = toEnvProviderConfig(provider);
    return {
      provider,
      slug: config.slug,
      label: config.label,
      requiredEnv: config.requiredEnv,
      configSource: config.source,
      configReady: config.configReady,
      clientIdHint: config.clientIdHint,
      clientSecretHint: config.clientSecretHint,
      redirectUri: config.redirectUri,
      configError: null,
      connected: false,
      status: "DISCONNECTED",
      accountEmail: null,
      connectedAt: null,
      tokenExpiresAt: null,
      lastError: null,
    };
  });
}

export function parseIntegrationProviderSlug(slug: string): IntegrationProvider {
  const normalized = slug.toLowerCase() as IntegrationProviderSlug;
  const provider = PROVIDER_FROM_SLUG[normalized];
  if (!provider) {
    throw new Error("Unsupported integration provider");
  }
  return provider;
}

async function resolveProviderConfigForWorkspace(
  workspaceId: string,
  provider: IntegrationProvider,
): Promise<ProviderOAuthConfig> {
  const envConfig = toEnvProviderConfig(provider);

  try {
    const record = await prisma.integrationProviderConfig.findUnique({
      where: {
        workspaceId_provider: { workspaceId, provider },
      },
      select: {
        clientId: true,
        clientSecretEncrypted: true,
        clientIdHint: true,
        clientSecretHint: true,
        redirectUri: true,
      },
    });

    if (!record) {
      return envConfig;
    }

    try {
      const clientSecret = decryptSecretValue(record.clientSecretEncrypted);
      const clientId = record.clientId.trim();
      const redirectUri =
        record.redirectUri?.trim() ||
        process.env[getProviderMeta(provider).redirectUriEnv] ||
        getProviderDefaultRedirectUri(getProviderMeta(provider));

      return {
        ...envConfig,
        source: "workspace",
        clientId,
        clientSecret,
        redirectUri,
        clientIdHint: record.clientIdHint ?? toPublicHint(clientId),
        clientSecretHint: record.clientSecretHint ?? toSecretHint(clientSecret),
        configReady: clientId.length > 0 && clientSecret.length > 0,
        configError: null,
      };
    } catch {
      return {
        ...envConfig,
        source: "workspace",
        clientId: record.clientId ?? "",
        clientSecret: "",
        redirectUri:
          record.redirectUri?.trim() ||
          process.env[getProviderMeta(provider).redirectUriEnv] ||
          getProviderDefaultRedirectUri(getProviderMeta(provider)),
        clientIdHint: record.clientIdHint ?? toPublicHint(record.clientId),
        clientSecretHint: record.clientSecretHint ?? null,
        configReady: false,
        configError:
          "Stored provider secret cannot be decrypted. Re-save credentials in Settings.",
      };
    }
  } catch (error) {
    if (isIntegrationSchemaMismatchError(error)) {
      return {
        ...envConfig,
        configError:
          envConfig.source === "none"
            ? "App-managed provider config requires DB sync (`npx prisma db push`)."
            : null,
      };
    }
    throw error;
  }
}

export async function getIntegrationSettingsSummary(
  workspaceId: string,
): Promise<IntegrationSettingsSummary> {
  const defaults = toProviderSummaryDefaults();

  try {
    const accounts = await prisma.integrationAccount.findMany({
      where: { workspaceId },
      orderBy: { provider: "asc" },
    });
    const byProvider = new Map(accounts.map((account) => [account.provider, account]));

    const providers: IntegrationProviderSummary[] = [];
    for (const provider of Object.values(IntegrationProvider)) {
      const config = await resolveProviderConfigForWorkspace(workspaceId, provider);
      const account = byProvider.get(provider);
      const connected =
        account?.status === IntegrationStatus.CONNECTED &&
        Boolean(account.accessTokenEncrypted);

      providers.push({
        provider,
        slug: config.slug,
        label: config.label,
        requiredEnv: config.requiredEnv,
        configSource: config.source,
        configReady: config.configReady,
        clientIdHint: config.clientIdHint,
        clientSecretHint: config.clientSecretHint,
        redirectUri: config.redirectUri,
        configError: config.configError,
        connected,
        status: connected ? IntegrationStatus.CONNECTED : account?.status ?? "DISCONNECTED",
        accountEmail: account?.accountEmail ?? null,
        connectedAt: account?.connectedAt ?? null,
        tokenExpiresAt: account?.tokenExpiresAt ?? null,
        lastError: account?.lastError ?? null,
      });
    }

    return {
      schemaReady: true,
      encryptionReady: isSecretEncryptionConfigured(),
      providers,
    };
  } catch (error) {
    if (isIntegrationSchemaMismatchError(error)) {
      return {
        schemaReady: false,
        encryptionReady: isSecretEncryptionConfigured(),
        providers: defaults,
      };
    }
    throw error;
  }
}

export async function saveWorkspaceProviderConfig(input: {
  workspaceId: string;
  provider: IntegrationProvider;
  clientId: string;
  clientSecret: string;
  redirectUri?: string | null;
}) {
  if (!isSecretEncryptionConfigured()) {
    throw new Error(
      "Secret encryption key is missing. Configure OPSOS_SECRET_ENCRYPTION_KEY first.",
    );
  }

  const clientId = input.clientId.trim();
  const clientSecret = input.clientSecret.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Client ID and Client Secret are required.");
  }

  const redirectUriCandidate =
    input.redirectUri?.trim() ||
    process.env[getProviderMeta(input.provider).redirectUriEnv] ||
    getProviderDefaultRedirectUri(getProviderMeta(input.provider));
  try {
    const parsed = new URL(redirectUriCandidate);
    if (!(parsed.protocol === "http:" || parsed.protocol === "https:")) {
      throw new Error("Redirect URI must use http or https.");
    }
  } catch {
    throw new Error("Redirect URI is invalid.");
  }

  try {
    await prisma.integrationProviderConfig.upsert({
      where: {
        workspaceId_provider: {
          workspaceId: input.workspaceId,
          provider: input.provider,
        },
      },
      create: {
        workspaceId: input.workspaceId,
        provider: input.provider,
        clientId,
        clientSecretEncrypted: encryptSecretValue(clientSecret),
        clientIdHint: toPublicHint(clientId),
        clientSecretHint: toSecretHint(clientSecret),
        redirectUri: redirectUriCandidate,
        configuredAt: new Date(),
      },
      update: {
        clientId,
        clientSecretEncrypted: encryptSecretValue(clientSecret),
        clientIdHint: toPublicHint(clientId),
        clientSecretHint: toSecretHint(clientSecret),
        redirectUri: redirectUriCandidate,
        configuredAt: new Date(),
      },
    });
  } catch (error) {
    if (isIntegrationSchemaMismatchError(error)) {
      throw new Error("Integrations schema is not synced. Run `npx prisma db push`.");
    }
    throw error;
  }
}

export async function clearWorkspaceProviderConfig(
  workspaceId: string,
  provider: IntegrationProvider,
) {
  try {
    await prisma.integrationProviderConfig.deleteMany({
      where: { workspaceId, provider },
    });
  } catch (error) {
    if (isIntegrationSchemaMismatchError(error)) {
      throw new Error("Integrations schema is not synced. Run `npx prisma db push`.");
    }
    throw error;
  }
}

export async function createIntegrationConnectUrl(input: {
  workspaceId: string;
  userId: string;
  provider: IntegrationProvider;
}) {
  if (!isSecretEncryptionConfigured()) {
    throw new Error(
      "Secret encryption key is missing. Configure OPSOS_SECRET_ENCRYPTION_KEY first.",
    );
  }

  const config = await resolveProviderConfigForWorkspace(
    input.workspaceId,
    input.provider,
  );
  if (config.configError && config.source === "workspace") {
    throw new Error(config.configError);
  }
  if (!config.configReady) {
    throw new Error(
      "Provider OAuth keys are missing. Add them in Settings > Integrations.",
    );
  }

  try {
    await prisma.integrationAuthSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          {
            workspaceId: input.workspaceId,
            provider: input.provider,
            userId: input.userId,
          },
        ],
      },
    });
  } catch (error) {
    if (!isIntegrationSchemaMismatchError(error)) {
      throw error;
    }
    throw new Error(
      "Integrations schema is not synced. Run `npm run prisma:generate` and `npx prisma db push`.",
    );
  }

  const state = randomBase64Url(24);
  const codeVerifier = randomBase64Url(64);
  const codeChallenge = toCodeChallenge(codeVerifier);

  await prisma.integrationAuthSession.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider: input.provider,
      state,
      codeVerifier,
      expiresAt: new Date(Date.now() + 1000 * 60 * 10),
    },
  });

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: getProviderMeta(input.provider).scopes.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  if (input.provider === IntegrationProvider.GOOGLE) {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
    params.set("include_granted_scopes", "true");
  } else {
    params.set("response_mode", "query");
  }

  return `${getProviderMeta(input.provider).authUrl}?${params.toString()}`;
}

async function exchangeCodeForToken(input: {
  provider: IntegrationProvider;
  workspaceId: string;
  code: string;
  codeVerifier: string;
}) {
  const config = await resolveProviderConfigForWorkspace(
    input.workspaceId,
    input.provider,
  );
  if (!config.configReady) {
    throw new Error("Provider OAuth keys are missing for this workspace.");
  }

  const body = new URLSearchParams({
    code: input.code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
    code_verifier: input.codeVerifier,
  });

  if (input.provider === IntegrationProvider.MICROSOFT) {
    body.set("scope", getProviderMeta(input.provider).scopes.join(" "));
  }

  const response = await fetch(getProviderMeta(input.provider).tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? payload.error ?? "OAuth token exchange failed");
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    expiresAt:
      typeof payload.expires_in === "number"
        ? new Date(Date.now() + payload.expires_in * 1000)
        : null,
    scopes:
      typeof payload.scope === "string" && payload.scope.trim().length > 0
        ? payload.scope.split(/\s+/)
        : getProviderMeta(input.provider).scopes,
  } satisfies OAuthTokenPayload;
}

async function fetchAccountEmail(provider: IntegrationProvider, accessToken: string) {
  if (provider === IntegrationProvider.GOOGLE) {
    const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({}))) as { email?: string };
    return payload.email ?? null;
  }

  const response = await fetch(
    "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName",
    {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );
  const payload = (await response.json().catch(() => ({}))) as {
    mail?: string | null;
    userPrincipalName?: string | null;
  };
  return payload.mail ?? payload.userPrincipalName ?? null;
}

export async function finalizeIntegrationCallback(input: {
  provider: IntegrationProvider;
  state: string;
  code: string;
}) {
  const authSession = await prisma.integrationAuthSession.findFirst({
    where: {
      provider: input.provider,
      state: input.state,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      workspaceId: true,
      codeVerifier: true,
    },
  });

  if (!authSession) {
    throw new Error("Integration session expired. Start connection again.");
  }

  try {
    const token = await exchangeCodeForToken({
      provider: input.provider,
      workspaceId: authSession.workspaceId,
      code: input.code,
      codeVerifier: authSession.codeVerifier,
    });
    const accountEmail = await fetchAccountEmail(input.provider, token.accessToken);

    await prisma.integrationAccount.upsert({
      where: {
        workspaceId_provider: {
          workspaceId: authSession.workspaceId,
          provider: input.provider,
        },
      },
      create: {
        workspaceId: authSession.workspaceId,
        provider: input.provider,
        status: IntegrationStatus.CONNECTED,
        accountEmail,
        accessTokenEncrypted: encryptSecretValue(token.accessToken),
        refreshTokenEncrypted: token.refreshToken
          ? encryptSecretValue(token.refreshToken)
          : null,
        tokenExpiresAt: token.expiresAt,
        scopes: token.scopes,
        connectedAt: new Date(),
        lastError: null,
      },
      update: {
        status: IntegrationStatus.CONNECTED,
        accountEmail,
        accessTokenEncrypted: encryptSecretValue(token.accessToken),
        refreshTokenEncrypted: token.refreshToken
          ? encryptSecretValue(token.refreshToken)
          : undefined,
        tokenExpiresAt: token.expiresAt,
        scopes: token.scopes,
        connectedAt: new Date(),
        lastError: null,
      },
    });

    await prisma.integrationAuthSession.delete({ where: { id: authSession.id } });

    return {
      workspaceId: authSession.workspaceId,
      provider: input.provider,
      accountEmail,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Integration callback failed unexpectedly";

    await prisma.integrationAccount.upsert({
      where: {
        workspaceId_provider: {
          workspaceId: authSession.workspaceId,
          provider: input.provider,
        },
      },
      create: {
        workspaceId: authSession.workspaceId,
        provider: input.provider,
        status: IntegrationStatus.ERROR,
        lastError: message,
      },
      update: {
        status: IntegrationStatus.ERROR,
        lastError: message,
      },
    });

    await prisma.integrationAuthSession.deleteMany({
      where: { id: authSession.id },
    });

    throw error;
  }
}

export async function disconnectIntegration(
  workspaceId: string,
  provider: IntegrationProvider,
) {
  await prisma.integrationAccount.deleteMany({
    where: { workspaceId, provider },
  });
  await prisma.integrationAuthSession.deleteMany({
    where: { workspaceId, provider },
  });
}

async function refreshAccessToken(input: {
  workspaceId: string;
  provider: IntegrationProvider;
  refreshToken: string;
}) {
  const config = await resolveProviderConfigForWorkspace(
    input.workspaceId,
    input.provider,
  );
  if (!config.configReady) {
    throw new Error("Provider OAuth keys are missing for this workspace.");
  }

  const body = new URLSearchParams({
    refresh_token: input.refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
  });

  if (input.provider === IntegrationProvider.MICROSOFT) {
    body.set("scope", getProviderMeta(input.provider).scopes.join(" "));
  }

  const response = await fetch(getProviderMeta(input.provider).tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? payload.error ?? "Token refresh failed");
  }

  const nextToken: OAuthTokenPayload = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? input.refreshToken,
    expiresAt:
      typeof payload.expires_in === "number"
        ? new Date(Date.now() + payload.expires_in * 1000)
        : null,
    scopes:
      typeof payload.scope === "string" && payload.scope.trim().length > 0
        ? payload.scope.split(/\s+/)
        : getProviderMeta(input.provider).scopes,
  };

  await prisma.integrationAccount.update({
    where: {
      workspaceId_provider: {
        workspaceId: input.workspaceId,
        provider: input.provider,
      },
    },
    data: {
      status: IntegrationStatus.CONNECTED,
      accessTokenEncrypted: encryptSecretValue(nextToken.accessToken),
      refreshTokenEncrypted: nextToken.refreshToken
        ? encryptSecretValue(nextToken.refreshToken)
        : null,
      tokenExpiresAt: nextToken.expiresAt,
      scopes: nextToken.scopes,
      lastError: null,
    },
  });

  return nextToken.accessToken;
}

async function getActiveAccessToken(workspaceId: string, provider: IntegrationProvider) {
  const account = await prisma.integrationAccount.findUnique({
    where: {
      workspaceId_provider: { workspaceId, provider },
    },
    select: {
      accessTokenEncrypted: true,
      refreshTokenEncrypted: true,
      tokenExpiresAt: true,
    },
  });

  if (!account?.accessTokenEncrypted) {
    throw new Error("Integration is not connected");
  }

  const expiresAt = account.tokenExpiresAt?.getTime() ?? null;
  const needsRefresh = Boolean(expiresAt && expiresAt <= Date.now() + 60_000);

  if (needsRefresh) {
    if (!account.refreshTokenEncrypted) {
      throw new Error("Integration token expired. Reconnect the account.");
    }
    const refreshToken = decryptSecretValue(account.refreshTokenEncrypted);
    return refreshAccessToken({ workspaceId, provider, refreshToken });
  }

  return decryptSecretValue(account.accessTokenEncrypted);
}

function toSyncedCalendarProviderStatus(
  provider: IntegrationProvider,
  connected: boolean,
  synced: boolean,
  lastError: string | null = null,
): SyncedCalendarProviderStatus {
  const meta = getProviderMeta(provider);
  return {
    provider,
    slug: meta.slug,
    label: meta.label,
    connected,
    synced,
    lastError,
  };
}

function normalizeIsoDateTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const normalized = /[zZ]|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function normalizeAllDayDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function normalizeGoogleEventWindow(event: {
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}) {
  const startAt =
    normalizeIsoDateTime(event.start?.dateTime) ?? normalizeAllDayDate(event.start?.date);
  if (!startAt) {
    return null;
  }

  const endAt =
    normalizeIsoDateTime(event.end?.dateTime) ?? normalizeAllDayDate(event.end?.date) ?? null;
  return {
    startAt,
    endAt,
    isAllDay: !event.start?.dateTime && Boolean(event.start?.date),
  };
}

function normalizeMicrosoftEventWindow(event: {
  start?: { dateTime?: string | null };
  end?: { dateTime?: string | null };
  isAllDay?: boolean | null;
}) {
  const startAt = normalizeIsoDateTime(event.start?.dateTime ?? null);
  if (!startAt) {
    return null;
  }
  const endAt = normalizeIsoDateTime(event.end?.dateTime ?? null) ?? null;
  return {
    startAt,
    endAt,
    isAllDay: Boolean(event.isAllDay),
  };
}

async function fetchGoogleCalendarEventsRange(input: {
  accessToken: string;
  start: Date;
  end: Date;
  limit: number;
}): Promise<SyncedCalendarEvent[]> {
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("timeMin", input.start.toISOString());
  url.searchParams.set("timeMax", input.end.toISOString());
  url.searchParams.set("maxResults", String(Math.max(1, Math.min(input.limit, 500))));

  const response = await fetch(url.toString(), {
    headers: { authorization: `Bearer ${input.accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || "Google Calendar sync failed");
  }

  const payload = (await response.json().catch(() => ({}))) as {
    items?: Array<{
      id?: string;
      summary?: string;
      htmlLink?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }>;
  };

  const events: SyncedCalendarEvent[] = [];
  for (const event of payload.items ?? []) {
    const normalized = normalizeGoogleEventWindow(event);
    if (!normalized) {
      continue;
    }
    events.push({
      id: `google:${event.id ?? crypto.randomUUID()}`,
      provider: IntegrationProvider.GOOGLE,
      providerSlug: "google",
      title: event.summary?.trim() || "(Untitled event)",
      startAt: normalized.startAt,
      endAt: normalized.endAt,
      isAllDay: normalized.isAllDay,
      link: event.htmlLink ?? null,
    });
  }

  return events;
}

async function fetchMicrosoftCalendarEventsRange(input: {
  accessToken: string;
  start: Date;
  end: Date;
  limit: number;
}): Promise<SyncedCalendarEvent[]> {
  const firstUrl = new URL("https://graph.microsoft.com/v1.0/me/calendarView");
  firstUrl.searchParams.set("startDateTime", input.start.toISOString());
  firstUrl.searchParams.set("endDateTime", input.end.toISOString());
  firstUrl.searchParams.set("$top", String(Math.max(1, Math.min(input.limit, 200))));
  firstUrl.searchParams.set("$orderby", "start/dateTime");
  firstUrl.searchParams.set("$select", "id,subject,start,end,isAllDay,webLink");

  const events: SyncedCalendarEvent[] = [];
  let nextUrl: string | null = firstUrl.toString();
  let pageCount = 0;
  const maxPages = 5;

  while (nextUrl && pageCount < maxPages && events.length < input.limit) {
    pageCount += 1;
    const response = await fetch(nextUrl, {
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        Prefer: 'outlook.timezone="UTC"',
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(message || "Microsoft Calendar sync failed");
    }

    const payload = (await response.json().catch(() => ({}))) as {
      value?: Array<{
        id?: string;
        subject?: string;
        webLink?: string;
        isAllDay?: boolean;
        start?: { dateTime?: string | null };
        end?: { dateTime?: string | null };
      }>;
      "@odata.nextLink"?: string;
    };

    for (const event of payload.value ?? []) {
      if (events.length >= input.limit) {
        break;
      }
      const normalized = normalizeMicrosoftEventWindow(event);
      if (!normalized) {
        continue;
      }
      events.push({
        id: `microsoft:${event.id ?? crypto.randomUUID()}`,
        provider: IntegrationProvider.MICROSOFT,
        providerSlug: "microsoft",
        title: event.subject?.trim() || "(Untitled event)",
        startAt: normalized.startAt,
        endAt: normalized.endAt,
        isAllDay: normalized.isAllDay,
        link: event.webLink ?? null,
      });
    }

    const nextLink = payload["@odata.nextLink"];
    nextUrl = typeof nextLink === "string" && nextLink.length > 0 ? nextLink : null;
  }

  return events;
}

async function syncProviderCalendarEvents(input: {
  workspaceId: string;
  provider: IntegrationProvider;
  start: Date;
  end: Date;
  limitPerProvider: number;
}) {
  const accessToken = await getActiveAccessToken(input.workspaceId, input.provider);
  const events =
    input.provider === IntegrationProvider.GOOGLE
      ? await fetchGoogleCalendarEventsRange({
          accessToken,
          start: input.start,
          end: input.end,
          limit: input.limitPerProvider,
        })
      : await fetchMicrosoftCalendarEventsRange({
          accessToken,
          start: input.start,
          end: input.end,
          limit: input.limitPerProvider,
        });

  await prisma.integrationAccount.updateMany({
    where: {
      workspaceId: input.workspaceId,
      provider: input.provider,
    },
    data: {
      status: IntegrationStatus.CONNECTED,
      lastError: null,
      lastSyncAt: new Date(),
    },
  });

  return events;
}

export async function getSyncedCalendarEvents(input: {
  workspaceId: string;
  start: Date;
  end: Date;
  limitPerProvider?: number;
}): Promise<SyncedCalendarResult> {
  const start = new Date(input.start);
  const end = new Date(input.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw new Error("Invalid calendar range");
  }

  const connectedAccounts = await prisma.integrationAccount.findMany({
    where: {
      workspaceId: input.workspaceId,
      accessTokenEncrypted: { not: null },
    },
    select: {
      provider: true,
    },
    orderBy: {
      provider: "asc",
    },
  });

  const connectedProviders = new Set(connectedAccounts.map((account) => account.provider));
  const providerStatusByProvider = new Map<IntegrationProvider, SyncedCalendarProviderStatus>(
    Object.values(IntegrationProvider).map((provider) => [
      provider,
      toSyncedCalendarProviderStatus(provider, connectedProviders.has(provider), false),
    ]),
  );

  if (connectedProviders.size === 0) {
    return {
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
      hasConnectedProviders: false,
      providers: Array.from(providerStatusByProvider.values()),
      events: [],
    };
  }

  const limitPerProvider = Math.max(25, Math.min(input.limitPerProvider ?? 500, 1000));
  const events: SyncedCalendarEvent[] = [];

  await Promise.all(
    [...connectedProviders].map(async (provider) => {
      try {
        const providerEvents = await syncProviderCalendarEvents({
          workspaceId: input.workspaceId,
          provider,
          start,
          end,
          limitPerProvider,
        });
        providerStatusByProvider.set(
          provider,
          toSyncedCalendarProviderStatus(provider, true, true, null),
        );
        events.push(...providerEvents);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Calendar sync failed for provider";
        await prisma.integrationAccount.updateMany({
          where: {
            workspaceId: input.workspaceId,
            provider,
          },
          data: {
            status: IntegrationStatus.ERROR,
            lastError: message,
          },
        });
        providerStatusByProvider.set(
          provider,
          toSyncedCalendarProviderStatus(provider, true, false, message),
        );
      }
    }),
  );

  events.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  return {
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
    hasConnectedProviders: connectedProviders.size > 0,
    providers: Array.from(providerStatusByProvider.values()),
    events,
  };
}

async function fetchGooglePreview(accessToken: string): Promise<IntegrationPreview> {
  const [eventsResponse, messageListResponse] = await Promise.all([
    fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=5&singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(
        new Date().toISOString(),
      )}`,
      {
        headers: { authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    ),
    fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&labelIds=INBOX", {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }),
  ]);

  const eventsPayload = (await eventsResponse.json().catch(() => ({}))) as {
    items?: Array<{
      id?: string;
      summary?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }>;
  };

  const messageListPayload = (await messageListResponse.json().catch(() => ({}))) as {
    messages?: Array<{ id?: string }>;
  };
  const messageIds = (messageListPayload.messages ?? [])
    .map((item) => item.id)
    .filter((id): id is string => Boolean(id));

  const messageDetails = await Promise.all(
    messageIds.map(async (id) => {
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        {
          headers: { authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        },
      );
      if (!response.ok) {
        return null;
      }
      const payload = (await response.json().catch(() => null)) as
        | {
            id?: string;
            internalDate?: string;
            payload?: {
              headers?: Array<{ name?: string; value?: string }>;
            };
          }
        | null;
      if (!payload?.id) {
        return null;
      }
      const headers = payload.payload?.headers ?? [];
      const findHeader = (name: string) =>
        headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value ?? null;
      return {
        id: payload.id,
        subject: findHeader("Subject") ?? "(No subject)",
        from: findHeader("From"),
        receivedAt: payload.internalDate
          ? new Date(Number(payload.internalDate)).toISOString()
          : findHeader("Date"),
      };
    }),
  );

  return {
    provider: IntegrationProvider.GOOGLE,
    emails: messageDetails.filter((item): item is NonNullable<typeof item> => Boolean(item)),
    events: (eventsPayload.items ?? []).map((event) => ({
      id: event.id ?? crypto.randomUUID(),
      title: event.summary ?? "(Untitled event)",
      startAt: event.start?.dateTime ?? event.start?.date ?? null,
      endAt: event.end?.dateTime ?? event.end?.date ?? null,
    })),
  };
}

async function fetchMicrosoftPreview(accessToken: string): Promise<IntegrationPreview> {
  const now = new Date();
  const end = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7);

  const calendarViewUrl = new URL("https://graph.microsoft.com/v1.0/me/calendarView");
  calendarViewUrl.searchParams.set("startDateTime", now.toISOString());
  calendarViewUrl.searchParams.set("endDateTime", end.toISOString());
  calendarViewUrl.searchParams.set("$top", "5");
  calendarViewUrl.searchParams.set("$orderby", "start/dateTime");
  calendarViewUrl.searchParams.set("$select", "id,subject,start,end");

  const [messagesResponse, eventsResponse] = await Promise.all([
    fetch(
      "https://graph.microsoft.com/v1.0/me/messages?$top=5&$orderby=receivedDateTime%20desc&$select=id,subject,from,receivedDateTime",
      {
        headers: { authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    ),
    fetch(calendarViewUrl.toString(), {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }),
  ]);

  const messagesPayload = (await messagesResponse.json().catch(() => ({}))) as {
    value?: Array<{
      id?: string;
      subject?: string;
      from?: { emailAddress?: { address?: string } };
      receivedDateTime?: string;
    }>;
  };
  const eventsPayload = (await eventsResponse.json().catch(() => ({}))) as {
    value?: Array<{
      id?: string;
      subject?: string;
      start?: { dateTime?: string };
      end?: { dateTime?: string };
    }>;
  };

  return {
    provider: IntegrationProvider.MICROSOFT,
    emails: (messagesPayload.value ?? []).map((message) => ({
      id: message.id ?? crypto.randomUUID(),
      subject: message.subject ?? "(No subject)",
      from: message.from?.emailAddress?.address ?? null,
      receivedAt: message.receivedDateTime ?? null,
    })),
    events: (eventsPayload.value ?? []).map((event) => ({
      id: event.id ?? crypto.randomUUID(),
      title: event.subject ?? "(Untitled event)",
      startAt: event.start?.dateTime ?? null,
      endAt: event.end?.dateTime ?? null,
    })),
  };
}

export async function getIntegrationPreview(
  workspaceId: string,
  provider: IntegrationProvider,
): Promise<IntegrationPreview> {
  const accessToken = await getActiveAccessToken(workspaceId, provider);

  try {
    const preview =
      provider === IntegrationProvider.GOOGLE
        ? await fetchGooglePreview(accessToken)
        : await fetchMicrosoftPreview(accessToken);

    await prisma.integrationAccount.update({
      where: {
        workspaceId_provider: { workspaceId, provider },
      },
      data: {
        status: IntegrationStatus.CONNECTED,
        lastError: null,
        lastSyncAt: new Date(),
      },
    });

    return preview;
  } catch (error) {
    const lastError =
      error instanceof Error ? error.message : "Failed to fetch integration preview";
    await prisma.integrationAccount.updateMany({
      where: { workspaceId, provider },
      data: {
        status: IntegrationStatus.ERROR,
        lastError,
      },
    });
    throw error;
  }
}
