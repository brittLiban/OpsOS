import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SETTINGS_SECTIONS = [
  {
    title: "CRM Setup",
    items: [
      {
        label: "Pipelines",
        description: "Configure pipelines, stages, colors, and stage types.",
        href: "/settings/pipelines",
      },
      {
        label: "Custom Fields (Leads/Clients)",
        description: "Create and manage custom fields used on lead and client records.",
        href: "/settings/fields",
      },
      {
        label: "Task Fields",
        description: "Create and manage custom fields used on tasks.",
        href: "/settings/task-fields",
      },
    ],
  },
  {
    title: "Billing & Payments",
    items: [
      {
        label: "Billing Types",
        description: "Manage custom billing record types.",
        href: "/settings/billing-types",
      },
      {
        label: "Stripe",
        description: "Configure Stripe keys and payment tracking.",
        href: "/settings/stripe",
      },
    ],
  },
  {
    title: "Enablement",
    items: [
      {
        label: "Script Categories",
        description: "Organize reusable scripts for calling and follow-up.",
        href: "/settings/script-categories",
      },
    ],
  },
  {
    title: "Integrations",
    items: [
      {
        label: "Email + Calendar Integrations",
        description: "Connect Google or Microsoft for synced inbox and calendar events.",
        href: "/settings/integrations",
      },
    ],
  },
] as const;

export default function SettingsHomePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace Settings"
        subtitle="All setup pages in one place. Sidebar stays clean while every setting is one click away."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {SETTINGS_SECTIONS.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle className="text-base">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {section.items.map((item) => (
                <div
                  key={item.href}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <Button asChild size="sm" variant="secondary">
                    <Link href={item.href}>
                      Open
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
