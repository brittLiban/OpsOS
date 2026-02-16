import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { StageBadge, StatusBadge } from "@/components/app/status-badge";
import { getSessionContext } from "@/lib/server/auth";
import { getTodayItems } from "@/lib/server/today";

export default async function TodayPage() {
  const session = await getSessionContext();
  const today = await getTodayItems({
    workspaceId: session.workspaceId,
  });

  const sections = [
    { key: "overdueFollowUps", title: "Overdue Follow-ups", items: today.sections.overdueFollowUps },
    { key: "dueTodayFollowUps", title: "Due Today Follow-ups", items: today.sections.dueTodayFollowUps },
    { key: "untouchedLeads", title: "New Untouched Leads", items: today.sections.untouchedLeads },
    { key: "clientTasks", title: "Client Tasks Due/Overdue", items: today.sections.clientTasks },
    { key: "billing", title: "Billing Due Soon/Overdue", items: today.sections.billing },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Today"
        subtitle="Command center: highest-impact actions first."
        actions={<Button asChild><Link href="/leads">Log Touchpoint</Link></Button>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Actions" value={today.total} />
        <KpiCard label="Overdue Follow-ups" value={today.sections.overdueFollowUps.length} />
        <KpiCard label="Client Tasks" value={today.sections.clientTasks.length} />
        <KpiCard label="Billing Alerts" value={today.sections.billing.length} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {sections.map((section) => (
            <Card key={section.key}>
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {section.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No items in this section.
                  </p>
                ) : (
                  section.items.map((item) => (
                    <div
                      key={`${item.entityType}-${item.entityId}-${item.itemType}`}
                      className="rounded-lg border p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{item.name}</p>
                        <StatusBadge label={`Score ${item.score}`} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {item.stageBadge ? (
                          <StageBadge
                            label={item.stageBadge.label}
                            color={item.stageBadge.stageType === "OPEN" ? "TEAL" : "SLATE"}
                          />
                        ) : null}
                        {item.dueAt ? <span>Due: {new Date(item.dueAt).toLocaleString()}</span> : null}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.entityType === "LEAD" ? (
                          <>
                            <Button size="sm" variant="secondary" asChild>
                              <Link href={`/leads/${item.entityId}`}>Log Call</Link>
                            </Button>
                            <Button size="sm" variant="ghost" asChild>
                              <Link href={`/leads/${item.entityId}`}>Insert Script</Link>
                            </Button>
                          </>
                        ) : null}
                        {item.entityType === "CLIENT_TASK" ? (
                          <Button size="sm" variant="secondary" asChild>
                            <Link href="/clients">Mark Done</Link>
                          </Button>
                        ) : null}
                        <Button size="sm" variant="ghost" asChild>
                          <Link
                            href={
                              item.entityType === "LEAD"
                                ? `/leads/${item.entityId}`
                                : item.entityType === "CLIENT_TASK"
                                  ? "/clients"
                                  : "/billing"
                            }
                          >
                            Open
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start" asChild>
                <Link href="/leads">+ New Lead</Link>
              </Button>
              <Button className="w-full justify-start" variant="secondary" asChild>
                <Link href="/imports/new">Import CSV</Link>
              </Button>
              <Button className="w-full justify-start" variant="secondary" asChild>
                <Link href="/scripts">Insert Script</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
