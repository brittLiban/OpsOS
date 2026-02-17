import { IntegrationsSettingsPage } from "@/components/modules/settings/integrations-settings-page";
import { getSessionContext } from "@/lib/server/auth";
import { getIntegrationSettingsSummary } from "@/lib/server/integrations";

export default async function IntegrationsSettingsRoute() {
  const session = await getSessionContext();
  const summary = await getIntegrationSettingsSummary(session.workspaceId);

  return <IntegrationsSettingsPage initialState={summary} />;
}
