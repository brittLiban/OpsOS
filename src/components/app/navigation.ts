import {
  BookTemplate,
  Building2,
  Columns3,
  CreditCard,
  Download,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";

export const NAV_GROUPS = [
  {
    label: "Operations",
    items: [
      { href: "/today", label: "Today", icon: LayoutDashboard },
      { href: "/leads", label: "Leads", icon: Users },
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
      {
        href: "/settings/script-categories",
        label: "Script Categories",
        icon: Settings,
      },
      { href: "/settings/billing-types", label: "Billing Types", icon: Settings },
    ],
  },
] as const;
