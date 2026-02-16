"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar } from "@/components/app/filter-bar";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
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
  const [rows, setRows] = React.useState(clients);
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<string>("all");

  const filtered = rows.filter((client) => {
    const matchesQuery =
      q.length === 0 ||
      client.name.toLowerCase().includes(q.toLowerCase()) ||
      (client.primaryContactName ?? "").toLowerCase().includes(q.toLowerCase());
    const matchesStatus = status === "all" || client.status === status;
    return matchesQuery && matchesStatus;
  });

  async function deleteClient(clientId: string) {
    const response = await fetch(`/api/v1/clients/${clientId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("Failed to delete client");
      return;
    }
    setRows((current) => current.filter((client) => client.id !== clientId));
    toast.success("Client deleted");
  }

  async function deleteAllClients() {
    const response = await fetch("/api/v1/clients", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        deleteAll: true,
      }),
    });
    if (!response.ok) {
      toast.error("Failed to delete clients");
      return;
    }
    setRows([]);
    toast.success("All clients deleted");
  }

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
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" asChild>
            <Link href={`/clients/${row.original.id}`}>View</Link>
          </Button>
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="ghost">
                Delete
              </Button>
            }
            title="Delete Client"
            description={`Delete ${row.original.name} and all related onboarding, notes, tasks, and billing records?`}
            confirmLabel="Delete"
            onConfirm={() => deleteClient(row.original.id)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Clients"
        subtitle="Active client delivery and onboarding."
        actions={
          <div className="flex items-center gap-2">
            {rows.length > 0 ? (
              <ConfirmDialog
                trigger={<Button variant="destructive">Delete All Clients</Button>}
                title="Delete All Clients"
                description="This will delete every client in your workspace and all related client data. This action cannot be undone."
                confirmLabel="Delete All"
                onConfirm={deleteAllClients}
              />
            ) : null}
            <Button asChild>
              <Link href="/leads">New Client</Link>
            </Button>
          </div>
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
