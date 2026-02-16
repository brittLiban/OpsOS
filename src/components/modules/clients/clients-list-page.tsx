"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Search } from "lucide-react";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar } from "@/components/app/filter-bar";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ClientRow = {
  id: string;
  name: string;
  primaryContactName: string | null;
  status: string;
  createdAt: Date;
  mrrEstimate: number;
};

export function ClientsListPage({ clients }: { clients: ClientRow[] }) {
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<string>("all");

  const filtered = clients.filter((client) => {
    const matchesQuery =
      q.length === 0 ||
      client.name.toLowerCase().includes(q.toLowerCase()) ||
      (client.primaryContactName ?? "").toLowerCase().includes(q.toLowerCase());
    const matchesStatus = status === "all" || client.status === status;
    return matchesQuery && matchesStatus;
  });

  const columns: ColumnDef<ClientRow>[] = [
    {
      accessorKey: "name",
      header: "Client",
      cell: ({ row }) => (
        <Link href={`/clients/${row.original.id}`} className="font-medium hover:underline">
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: "primaryContactName",
      header: "Primary Contact",
      cell: ({ row }) => row.original.primaryContactName ?? "-",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge label={row.original.status} />,
    },
    {
      id: "mrr",
      header: "MRR Estimate",
      cell: ({ row }) => `$${row.original.mrrEstimate.toFixed(2)}`,
    },
    {
      id: "createdAt",
      header: "Created",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Clients"
        subtitle="Active client delivery and onboarding."
        actions={
          <Button asChild>
            <Link href="/leads">New Client</Link>
          </Button>
        }
      />
      <FilterBar>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search clients"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["ACTIVE", "ONBOARDING", "PAUSED", "CHURNED"].map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>
      {filtered.length === 0 ? (
        <EmptyState
          title="No clients found"
          description="Convert a lead to client or add one manually."
          ctaLabel="Go to Leads"
          ctaHref="/leads"
        />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}
    </div>
  );
}
