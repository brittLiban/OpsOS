"use client";

import * as React from "react";
import { Copy, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StripeSettingsState = {
  hasWorkspaceKeys: boolean;
  keyHint: string | null;
  webhookHint: string | null;
  configuredAt: Date | null;
  usingEnvFallback: boolean;
  encryptionReady: boolean;
  webhookUrl: string;
};

export function StripeSettingsPage({ initialState }: { initialState: StripeSettingsState }) {
  const [state, setState] = React.useState(initialState);
  const [secretKey, setSecretKey] = React.useState("");
  const [webhookSecret, setWebhookSecret] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function saveSettings() {
    if (!secretKey.trim() && !webhookSecret.trim()) {
      toast.error("Enter at least one key to save");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/v1/settings/stripe", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          secretKey: secretKey.trim() || undefined,
          webhookSecret: webhookSecret.trim() || undefined,
        }),
      });

      const json = (await response.json()) as
        | { data: StripeSettingsState }
        | { error?: { message?: string } };
      if (!response.ok || !("data" in json)) {
        toast.error(
          (json as { error?: { message?: string } })?.error?.message ?? "Failed to save Stripe settings",
        );
        return;
      }

      setState(json.data);
      setSecretKey("");
      setWebhookSecret("");
      toast.success("Stripe settings updated");
    } catch {
      toast.error("Failed to save Stripe settings");
    } finally {
      setSaving(false);
    }
  }

  async function clearSettings() {
    const response = await fetch("/api/v1/settings/stripe", {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("Failed to clear Stripe settings");
      return;
    }

    setState((current) => ({
      ...current,
      hasWorkspaceKeys: false,
      keyHint: null,
      webhookHint: null,
      configuredAt: null,
    }));
    toast.success("Stripe settings cleared");
  }

  async function copyWebhookUrl() {
    try {
      await navigator.clipboard.writeText(state.webhookUrl);
      toast.success("Webhook URL copied");
    } catch {
      toast.error("Failed to copy webhook URL");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stripe"
        subtitle="Store Stripe keys in Ops OS and collect payments directly from Billing."
      />

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={state.hasWorkspaceKeys ? "Configured" : "Not Configured"} />
            {state.usingEnvFallback ? <StatusBadge variant="outline" label="Using .env fallback" /> : null}
            {!state.encryptionReady ? <StatusBadge variant="outline" label="Encryption key missing" /> : null}
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Secret key hint</p>
            <p className="mt-1 font-medium">{state.keyHint ?? "-"}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Webhook secret hint</p>
            <p className="mt-1 font-medium">{state.webhookHint ?? "-"}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Webhook endpoint URL</p>
            <div className="mt-2 flex items-center gap-2">
              <Input value={state.webhookUrl} readOnly />
              <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {!state.encryptionReady ? (
            <p className="text-xs text-amber-500">
              Set OPSOS_SECRET_ENCRYPTION_KEY in the server environment before saving keys online.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Update Keys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stripe-secret">Stripe Secret Key</Label>
            <Input
              id="stripe-secret"
              type="password"
              value={secretKey}
              onChange={(event) => setSecretKey(event.target.value)}
              placeholder="sk_test_..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stripe-webhook-secret">Stripe Webhook Secret</Label>
            <Input
              id="stripe-webhook-secret"
              type="password"
              value={webhookSecret}
              onChange={(event) => setWebhookSecret(event.target.value)}
              placeholder="whsec_..."
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={saveSettings} disabled={saving || !state.encryptionReady}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save Stripe Keys"}
            </Button>
            <ConfirmDialog
              trigger={
                <Button variant="destructive" type="button">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear Stored Keys
                </Button>
              }
              title="Clear Stripe keys"
              description="This removes Stripe keys stored in Ops OS for this workspace."
              confirmLabel="Clear"
              onConfirm={clearSettings}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
