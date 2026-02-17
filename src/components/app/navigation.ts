import {
  AlarmClock,
  BookTemplate,
  Building2,
  CalendarDays,
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
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
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
    items: [{ href: "/scripts", label: "Templates", icon: BookTemplate }],
  },
  {
    label: "Settings",
    items: [
      { href: "/settings", label: "Workspace Settings", icon: Settings },
    ],
  },
] as const;
