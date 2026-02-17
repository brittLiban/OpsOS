import {
  AlarmClock,
  BookTemplate,
  Building2,
  ChartNoAxesCombined,
  Columns3,
  CreditCard,
  Download,
  ListTodo,
  Phone,
  Settings,
  Users,
} from "lucide-react";

export const NAV_GROUPS = [
  {
    label: "Operations",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: ChartNoAxesCombined },
      { href: "/today", label: "Today", icon: AlarmClock },
      { href: "/leads", label: "Leads", icon: Users },
      { href: "/calls", label: "Call Queue", icon: Phone },
      { href: "/tasks", label: "Tasks", icon: ListTodo },
      { href: "/pipeline", label: "Pipeline", icon: Columns3 },
      { href: "/imports", label: "Imports", icon: Download },
    ],
  },
  {
    label: "Delivery",
    items: [
      { href: "/clients", label: "Clients", icon: Building2 },
      { href: "/billing", label: "Billing", icon: CreditCard },
    ],
  },
  {
    label: "Enablement",
    items: [{ href: "/scripts", label: "Scripts", icon: BookTemplate }],
  },
  {
    label: "Settings",
    items: [
      { href: "/settings/pipelines", label: "Pipelines", icon: Settings },
      { href: "/settings/fields", label: "Custom Fields", icon: Settings },
      { href: "/settings/task-fields", label: "Task Fields", icon: Settings },
      { href: "/settings/integrations", label: "Integrations", icon: Settings },
      { href: "/settings/stripe", label: "Stripe", icon: CreditCard },
      {
        href: "/settings/script-categories",
        label: "Script Categories",
        icon: Settings,
      },
      { href: "/settings/billing-types", label: "Billing Types", icon: Settings },
    ],
  },
] as const;
