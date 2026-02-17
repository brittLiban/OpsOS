"use client";

import * as React from "react";
import { CalendarClock, Link2, Mail, RefreshCcw, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProviderState = {
  provider: "GOOGLE" | "MICROSOFT";
  slug: "google" | "microsoft";
  label: string;
  requiredEnv: [string, string];
  configSource: "workspace" | "env" | "none";
  configReady: boolean;
  clientIdHint: string | null;
  clientSecretHint: string | null;
  redirectUri: string;
  configError: string | null;
  connected: boolean;
  status: "CONNECTED" | "ERROR" | "DISCONNECTED";
  accountEmail: string | null;
  connectedAt: string | Date | null;
  tokenExpiresAt: string | Date | null;
  lastError: string | null;
};

type IntegrationSettingsState = {
  schemaReady: boolean;
  encryptionReady: boolean;
  providers: ProviderState[];
};

type IntegrationPreview = {
  provider: "GOOGLE" | "MICROSOFT";
  emails: { id: string; subject: string; from: string | null; receivedAt: string | null }[];
  events: { id: string; title: string; startAt: string | null; endAt: string | null }[];
};

export function IntegrationsSettingsPage({
  initialState,
}: {
  initialState: IntegrationSettingsState;
}) {
  const [state, setState] = React.useState(initialState);
  const [busyProvider, setBusyProvider] = React.useState<string | null>(null);
  const [configBusyProvider, setConfigBusyProvider] = React.useState<string | null>(null);
  const [previewProvider, setPreviewProvider] = React.useState<string | null>(null);
  const [previewMap, setPreviewMap] = React.useState<
    Record<string, IntegrationPreview | undefined>
  >({});
  const [configDraftMap, setConfigDraftMap] = React.useState<
    Record<string, { clientId: string; clientSecret: string; redirectUri: string }>
  >({});
  const searchParams = useSearchParams();
  const handledQuery = React.useRef<string | null>(null);

  React.useEffect(() => {
    setConfigDraftMap((current) => {
      const next = { ...current };
      for (const provider of state.providers) {
        if (!next[provider.slug]) {
          next[provider.slug] = {
            clientId: "",
            clientSecret: "",
            redirectUri: provider.redirectUri ?? "",
          };
        } else if (!next[provider.slug].redirectUri) {
          next[provider.slug] = {
            ...next[provider.slug],
            redirectUri: provider.redirectUri ?? "",
          };
        }
      }
      return next;
    });
  }, [state.providers]);

  React.useEffect(() => {
    const query = searchParams.toString();
    if (!query || handledQuery.current === query) {
      return;
    }
    handledQuery.current = query;

    const status = searchParams.get("status");
    if (!status) {
      return;
    }
    const providerSlug = searchParams.get("provider");
    const label =
      state.providers.find((provider) => provider.slug === providerSlug)?.label ??
      "Integration";
    if (status === "connected") {
      toast.success(`${label} connected`);
      return;
    }
    if (status === "error") {
      toast.error(searchParams.get("message") ?? `${label} connection failed`);
    }
  }, [searchParams, state.providers]);

  async function refreshState() {
    const response = await fetch("/api/v1/settings/integrations", {
      method: "GET",
      cache: "no-store",
    });
    const json = (await response.json()) as
      | { data: IntegrationSettingsState }
      | { error?: { message?: string } };
    if (!response.ok || !("data" in json)) {
      throw new Error(
        (json as { error?: { message?: string } }).error?.message ??
          "Failed to refresh integration status",
      );
    }
    setState(json.data);
  }

  function connect(slug: ProviderState["slug"]) {
    window.location.assign(`/api/v1/settings/integrations/${slug}/connect`);
  }

  function updateDraft(
    slug: ProviderState["slug"],
    partial: Partial<{ clientId: string; clientSecret: string; redirectUri: string }>,
  ) {
    setConfigDraftMap((current) => ({
      ...current,
      [slug]: {
        clientId: current[slug]?.clientId ?? "",
        clientSecret: current[slug]?.clientSecret ?? "",
        redirectUri: current[slug]?.redirectUri ?? "",
        ...partial,
      },
    }));
  }

  async function saveProviderConfig(provider: ProviderState) {
    const draft = configDraftMap[provider.slug];
    if (!draft?.clientId.trim() || !draft?.clientSecret.trim()) {
      toast.error("Client ID and Client Secret are required.");
      return;
    }
    setConfigBusyProvider(provider.slug);
    try {
      const response = await fetch(`/api/v1/settings/integrations/${provider.slug}/config`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId: draft.clientId.trim(),
          clientSecret: draft.clientSecret.trim(),
          redirectUri: draft.redirectUri.trim() || undefined,
        }),
      });
      const json = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(json.error?.message ?? "Failed to save provider config");
      }
      await refreshState();
      updateDraft(provider.slug, { clientSecret: "" });
      toast.success(`${provider.label} config saved`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save provider config");
    } finally {
      setConfigBusyProvider(null);
    }
  }

  async function clearProviderConfig(provider: ProviderState) {
    setConfigBusyProvider(provider.slug);
    try {
      const response = await fetch(`/api/v1/settings/integrations/${provider.slug}/config`, {
        method: "DELETE",
      });
      const json = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(json.error?.message ?? "Failed to clear provider config");
      }
      await refreshState();
      updateDraft(provider.slug, {
        clientId: "",
        clientSecret: "",
      });
      toast.success(`${provider.label} app config cleared`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clear provider config");
    } finally {
      setConfigBusyProvider(null);
    }
  }

  async function disconnect(provider: ProviderState) {
    setBusyProvider(provider.slug);
    try {
      const response = await fetch(`/api/v1/settings/integrations/${provider.slug}`, {
        method: "DELETE",
      });
      const json = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(json.error?.message ?? "Failed to disconnect integration");
      }
      await refreshState();
      setPreviewMap((current) => {
        const next = { ...current };
        delete next[provider.slug];
        return next;
      });
      toast.success(`${provider.label} disconnected`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to disconnect integration");
    } finally {
      setBusyProvider(null);
    }
  }

  async function loadPreview(provider: ProviderState) {
    setPreviewProvider(provider.slug);
    try {
      const response = await fetch(`/api/v1/settings/integrations/${provider.slug}/preview`, {
        method: "GET",
        cache: "no-store",
      });
      const json = (await response.json()) as
        | { data: IntegrationPreview }
        | { error?: { message?: string } };
      if (!response.ok || !("data" in json)) {
        throw new Error(
          (json as { error?: { message?: string } }).error?.message ??
            "Failed to load integration preview",
        );
      }
      setPreviewMap((current) => ({
        ...current,
        [provider.slug]: json.data,
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load preview");
    } finally {
      setPreviewProvider(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        subtitle="Connect Gmail/Google Calendar or Outlook/Microsoft Calendar to sync communications."
      />

      {!state.schemaReady ? (
        <Card>
          <CardHeader>
            <CardTitle>Schema Update Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>The integration tables are not available in your database yet.</p>
            <code className="block rounded bg-muted px-3 py-2 text-xs text-foreground">
              npm run prisma:generate
              <br />
              npx prisma db push
            </code>
          </CardContent>
        </Card>
      ) : null}

      {!state.encryptionReady ? (
        <Card>
          <CardHeader>
            <CardTitle>Encryption Key Missing</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Set <code>OPSOS_SECRET_ENCRYPTION_KEY</code> before connecting provider accounts.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4">
        {state.providers.map((provider) => {
          const preview = previewMap[provider.slug];
          const connectingDisabled =
            !provider.configReady || !state.schemaReady || !state.encryptionReady;

          return (
            <Card key={provider.provider}>
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>{provider.label}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={provider.connected ? "Connected" : "Not Connected"}
                      variant={provider.connected ? "default" : "outline"}
                    />
                    {!provider.configReady ? (
                      <StatusBadge label="Missing OAuth App Keys" variant="outline" />
                    ) : null}
                    {provider.status === "ERROR" ? (
                      <StatusBadge label="Connection Error" variant="destructive" />
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <DataBox label="Account" value={provider.accountEmail ?? "-"} />
                  <DataBox
                    label="Connected At"
                    value={provider.connectedAt ? formatDateTime(provider.connectedAt) : "-"}
                  />
                  <DataBox
                    label="Token Expires"
                    value={provider.tokenExpiresAt ? formatDateTime(provider.tokenExpiresAt) : "-"}
                  />
                </div>

                {!provider.configReady ? (
                  <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">
                      Provider keys not configured
                    </p>
                    <ul className="mt-2 list-disc pl-5">
                      <li>
                        <code>{provider.requiredEnv[0]}</code>
                      </li>
                      <li>
                        <code>{provider.requiredEnv[1]}</code>
                      </li>
                    </ul>
                  </div>
                ) : null}

                <div className="rounded-lg border p-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={
                        provider.configSource === "workspace"
                          ? "Configured In App"
                          : provider.configSource === "env"
                            ? "Using Server Env"
                            : "No Provider Config"
                      }
                      variant={provider.configSource === "workspace" ? "default" : "outline"}
                    />
                    <p className="text-xs text-muted-foreground">
                      Redirect URI: <code>{provider.redirectUri}</code>
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1">
                      <Label>OAuth Client ID</Label>
                      <Input
                        placeholder={provider.clientIdHint ?? "Paste client ID"}
                        value={configDraftMap[provider.slug]?.clientId ?? ""}
                        onChange={(event) =>
                          updateDraft(provider.slug, { clientId: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>OAuth Client Secret</Label>
                      <Input
                        type="password"
                        placeholder={provider.clientSecretHint ?? "Paste client secret"}
                        value={configDraftMap[provider.slug]?.clientSecret ?? ""}
                        onChange={(event) =>
                          updateDraft(provider.slug, { clientSecret: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Redirect URI (optional override)</Label>
                      <Input
                        placeholder={provider.redirectUri}
                        value={configDraftMap[provider.slug]?.redirectUri ?? ""}
                        onChange={(event) =>
                          updateDraft(provider.slug, { redirectUri: event.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => void saveProviderConfig(provider)}
                      disabled={configBusyProvider === provider.slug || !state.encryptionReady}
                    >
                      {configBusyProvider === provider.slug ? "Saving..." : "Save Provider Keys"}
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button
                          variant="outline"
                          disabled={configBusyProvider === provider.slug}
                        >
                          Clear Saved App Keys
                        </Button>
                      }
                      title={`Clear ${provider.label} app keys`}
                      description="This clears the app-stored OAuth client ID/secret for this workspace."
                      confirmLabel="Clear"
                      onConfirm={() => clearProviderConfig(provider)}
                    />
                  </div>
                </div>

                {provider.configError ? (
                  <div className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
                    {provider.configError}
                  </div>
                ) : null}

                {provider.lastError ? (
                  <div className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
                    {provider.lastError}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => connect(provider.slug)}
                    disabled={connectingDisabled || busyProvider === provider.slug}
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    {provider.connected ? "Reconnect" : "Connect"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void loadPreview(provider)}
                    disabled={!provider.connected || previewProvider === provider.slug}
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    {previewProvider === provider.slug ? "Loading..." : "Preview Sync"}
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button
                        variant="destructive"
                        disabled={!provider.connected || busyProvider === provider.slug}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Disconnect
                      </Button>
                    }
                    title={`Disconnect ${provider.label}`}
                    description="This removes tokens from Ops OS for this workspace."
                    confirmLabel="Disconnect"
                    onConfirm={() => disconnect(provider)}
                  />
                </div>

                {preview ? (
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-lg border p-3">
                      <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <Mail className="h-4 w-4" />
                        Recent Emails
                      </p>
                      <div className="space-y-2">
                        {preview.emails.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            No recent emails returned.
                          </p>
                        ) : (
                          preview.emails.map((email) => (
                            <div key={email.id} className="rounded border p-2 text-xs">
                              <p className="font-medium">{email.subject}</p>
                              <p className="text-muted-foreground">
                                {email.from ?? "Unknown sender"}
                              </p>
                              <p className="text-muted-foreground">
                                {email.receivedAt ? formatDateTime(email.receivedAt) : "-"}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <CalendarClock className="h-4 w-4" />
                        Upcoming Events
                      </p>
                      <div className="space-y-2">
                        {preview.events.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            No upcoming events returned.
                          </p>
                        ) : (
                          preview.events.map((event) => (
                            <div key={event.id} className="rounded border p-2 text-xs">
                              <p className="font-medium">{event.title}</p>
                              <p className="text-muted-foreground">
                                {event.startAt ? formatDateTime(event.startAt) : "-"}
                              </p>
                              <p className="text-muted-foreground">
                                {event.endAt ? formatDateTime(event.endAt) : "-"}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function DataBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function formatDateTime(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
}
