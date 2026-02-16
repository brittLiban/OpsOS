import { getSessionContext } from "@/lib/server/auth";
import { isSecretEncryptionConfigured } from "@/lib/server/secrets";
import { getStripeConfigSummaryForWorkspace, getWorkspaceStripeWebhookUrl } from "@/lib/server/stripe";
import { StripeSettingsPage } from "@/components/modules/settings/stripe-settings-page";

export default async function StripeSettingsRoute() {
  const session = await getSessionContext();
  const summary = await getStripeConfigSummaryForWorkspace(session.workspaceId);

  return (
    <StripeSettingsPage
      initialState={{
        ...summary,
        encryptionReady: isSecretEncryptionConfigured(),
        webhookUrl: getWorkspaceStripeWebhookUrl(session.workspaceId),
      }}
    />
  );
}
