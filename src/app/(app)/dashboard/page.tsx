import Link from "next/link";
import { ArrowRight, CalendarClock, CheckCircle2, Clock3, TrendingUp } from "lucide-react";
import { StageBadge, StatusBadge } from "@/components/app/status-badge";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionContext } from "@/lib/server/auth";
import { getDashboardSnapshot } from "@/lib/server/dashboard";

export default async function DashboardPage() {
  const session = await getSessionContext();
  const dashboard = await getDashboardSnapshot(session.workspaceId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Business health, execution load, and activity pulse in one view."
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/today">Open Today Queue</Link>
            </Button>
            <Button asChild>
              <Link href="/tasks">New Task</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Open Leads" value={dashboard.kpis.openLeads} subtext={`${dashboard.kpis.totalLeads} total`} />
        <KpiCard label="Follow-ups Today" value={dashboard.kpis.dueTodayFollowUps} subtext={`${dashboard.kpis.overdueFollowUps} overdue`} />
        <KpiCard label="Open Tasks" value={dashboard.kpis.openTasks} subtext={`${dashboard.kpis.overdueTasks} overdue`} />
        <KpiCard label="Active Clients" value={dashboard.kpis.activeClients} subtext={`${dashboard.kpis.onboardingClients} onboarding`} />
        <KpiCard
          label="Paid This Month"
          value={`$${dashboard.kpis.paidThisMonthAmount.toFixed(2)}`}
          subtext={`${dashboard.kpis.billingOverdueCount} billing overdue`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Pipeline Coverage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard.stagePipelineSummary.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pipelines configured yet.</p>
            ) : (
              dashboard.stagePipelineSummary.map((pipeline) => (
                <div key={pipeline.pipelineId} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{pipeline.pipelineName}</p>
                    <StatusBadge label={`${pipeline.total} leads`} variant="outline" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {pipeline.stages.map((stage) => (
                      <div key={stage.id} className="rounded-md border px-2 py-1 text-xs">
                        <div className="flex items-center gap-2">
                          <StageBadge label={stage.name} color={stage.color} />
                          <span>{stage.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
            <Button variant="ghost" className="w-full justify-between" asChild>
              <Link href="/pipeline">
                Open Pipeline Board
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Execution Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <SnapshotRow
              icon={<Clock3 className="h-4 w-4" />}
              label="General tasks open"
              value={dashboard.kpis.generalOpenTasks}
            />
            <SnapshotRow
              icon={<CalendarClock className="h-4 w-4" />}
              label="Billing due in 7 days"
              value={dashboard.kpis.billingDueSoonCount}
            />
            <SnapshotRow
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Tasks completed (7d)"
              value={dashboard.kpis.completedLast7Days}
            />
            <SnapshotRow
              icon={<TrendingUp className="h-4 w-4" />}
              label="Total clients"
              value={dashboard.kpis.totalClients}
            />
            <div className="rounded-lg border p-3 text-sm text-muted-foreground">
              Keep this page for health checks, then execute from <Link className="underline" href="/today">Today</Link>.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Upcoming Calendar (7d)</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/tasks">Open Tasks</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {dashboard.upcomingTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming tasks in the next 7 days.</p>
            ) : (
              dashboard.upcomingTasks.map((task) => (
                <div key={task.id} className="rounded-lg border p-3">
                  <p className="font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Due {task.dueAt ? new Date(task.dueAt).toLocaleString() : "unscheduled"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {task.taskType?.name ?? "General"} - {task.lead?.businessName ?? task.client?.name ?? "General"}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Upcoming Lead Follow-ups (7d)</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/leads">Open Leads</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {dashboard.upcomingFollowUps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scheduled lead follow-ups in the next 7 days.</p>
            ) : (
              dashboard.upcomingFollowUps.map((lead) => (
                <div key={lead.id} className="rounded-lg border p-3">
                  <p className="font-medium">{lead.businessName}</p>
                  <p className="text-xs text-muted-foreground">
                    Follow-up {lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleString() : "-"}
                  </p>
                  <div className="mt-2">
                    <StageBadge label={lead.stage.name} color={lead.stage.color} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Activity Feed</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/today">Go to Today</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {dashboard.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity yet.</p>
          ) : (
            dashboard.recentActivity.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-start justify-between gap-3 rounded-lg border p-3 hover:bg-muted/30"
              >
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.kind} - {item.target}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.at.toLocaleString()}
                </p>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string | number;
  subtext: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{subtext}</p>
      </CardContent>
    </Card>
  );
}

function SnapshotRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
