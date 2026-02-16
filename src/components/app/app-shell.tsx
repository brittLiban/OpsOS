"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { NAV_GROUPS } from "@/components/app/navigation";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[264px_1fr]">
        <aside className="hidden border-r border-border bg-card lg:flex lg:flex-col">
          <div className="flex h-16 items-center px-6">
            <Link href="/today" className="font-semibold tracking-tight">
              Ops OS
            </Link>
          </div>
          <Separator />
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="mb-6">
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const isActive =
                      pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>
        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border bg-background/95 px-4 backdrop-blur lg:px-8">
            <div className="relative w-full max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Global search"
                placeholder="Search leads, clients, scripts..."
                className="pl-9"
              />
            </div>
            <ThemeToggle />
            <Button size="sm">+ New</Button>
          </header>
          <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
