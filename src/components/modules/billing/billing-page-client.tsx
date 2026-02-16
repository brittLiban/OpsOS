"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar } from "@/components/app/filter-bar";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type BillingRecord = {
  id: string;
  clientId: string;
  billingTypeId: string;
  amount: unknown;
  currency: string;
  dueDate: Date;
  status: "DUE" | "PAID" | "OVERDUE" | "VOID";
  paidAt: Date | null;
  stripePaymentStatus: string | null;
  notes: string | null;
  client: { id: string; name: string };
  billingType: { id: string; name: string };
};

type Client = {
  id: string;
  name: string;
};

type BillingType = {
  id: string;
  name: string;
};

export function BillingPageClient({
  initialRecords,
  clients,
  billingTypes,
}: {
  initialRecords: BillingRecord[];
  clients: Client[];
  billingTypes: BillingType[];
}) {
  const [records, setRecords] = React.useState(initialRecords);
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [openCreate, setOpenCreate] = React.useState(false);

  const [newClientId, setNewClientId] = React.useState(clients[0]?.id ?? "");
  const [newTypeId, setNewTypeId] = React.useState(billingTypes[0]?.id ?? "");
  const [newAmount, setNewAmount] = React.useState("");
  const [newDueDate, setNewDueDate] = React.useState("");
  const [newNotes, setNewNotes] = React.useState("");

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutState = params.get("checkout");
    if (!checkoutState) {
      return;
    }
    if (checkoutState === "success") {
      toast.success("Stripe payment completed");
    }
    if (checkoutState === "cancel") {
      toast.error("Stripe checkout canceled");
    }
  }, []);

  const filtered = records.filter((record) => {
    const matchesStatus = statusFilter === "all" || record.status === statusFilter;
    const matchesType = typeFilter === "all" || record.billingTypeId === typeFilter;
    const dueDate = new Date(record.dueDate);
    const matchesFrom = !dateFrom || dueDate >= new Date(dateFrom);
    const matchesTo = !dateTo || dueDate <= new Date(dateTo);
    return matchesStatus && matchesType && matchesFrom && matchesTo;
  });

  async function markPaid(recordId: string) {
    const response = await fetch(`/api/v1/billing/${recordId}/mark-paid`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      toast.error("Failed to mark paid");
      return;
    }
    const json = (await response.json()) as { data: BillingRecord };
    setRecords((current) =>
      current.map((record) => (record.id === recordId ? { ...record, ...json.data } : record)),
    );
    toast.success("Marked as paid");
  }

  async function payWithStripe(recordId: string) {
    const response = await fetch(`/api/v1/billing/${recordId}/checkout`, {
      method: "POST",
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      toast.error(payload?.error?.message ?? "Failed to start Stripe checkout");
      return;
    }
    const json = (await response.json()) as {
      data: { checkoutUrl: string | null };
    };
    if (!json.data.checkoutUrl) {
      toast.error("Stripe did not return a checkout URL");
      return;
    }
    window.location.href = json.data.checkoutUrl;
  }

  async function deleteRecord(recordId: string) {
    const response = await fetch(`/api/v1/billing/${recordId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("Failed to delete record");
      return;
    }
    setRecords((current) => current.filter((record) => record.id !== recordId));
    toast.success("Billing record deleted");
  }

  async function createRecord() {
    const response = await fetch("/api/v1/billing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: newClientId,
        billingTypeId: newTypeId,
        amount: Number(newAmount),
        dueDate: newDueDate,
        notes: newNotes,
      }),
    });
    if (!response.ok) {
      toast.error("Failed to create billing record");
      return;
    }
    const json = (await response.json()) as { data: BillingRecord };
    const client = clients.find((item) => item.id === json.data.clientId);
    const type = billingTypes.find((item) => item.id === json.data.billingTypeId);
    setRecords((current) => [
      {
        ...json.data,
        client: { id: client?.id ?? "", name: client?.name ?? "Unknown" },
        billingType: { id: type?.id ?? "", name: type?.name ?? "Unknown" },
      },
      ...current,
    ]);
    setOpenCreate(false);
    setNewAmount("");
    setNewDueDate("");
    setNewNotes("");
    toast.success("Billing record created");
  }

  const columns: ColumnDef<BillingRecord>[] = [
    {
      id: "client",
      header: "Client",
      cell: ({ row }) => row.original.client.name,
    },
    {
      id: "type",
      header: "Type",
      cell: ({ row }) => row.original.billingType.name,
    },
    {
      id: "amount",
      header: "Amount",
      cell: ({ row }) => `$${Number(row.original.amount).toFixed(2)}`,
    },
    {
      id: "dueDate",
      header: "Due Date",
      cell: ({ row }) => new Date(row.original.dueDate).toLocaleDateString(),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge label={row.original.status} />,
    },
    {
      id: "stripe",
      header: "Stripe",
      cell: ({ row }) => row.original.stripePaymentStatus ?? "-",
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.status !== "PAID" ? (
            <Button size="sm" variant="outline" onClick={() => payWithStripe(row.original.id)}>
              Pay with Stripe
            </Button>
          ) : null}
          {row.original.status !== "PAID" ? (
            <Button size="sm" variant="secondary" onClick={() => markPaid(row.original.id)}>
              Mark Paid
            </Button>
          ) : null}
          <ConfirmDialog
            trigger={<Button size="sm" variant="ghost">Delete</Button>}
            title="Delete Billing Record"
            description="This action cannot be undone."
            confirmLabel="Delete"
            onConfirm={() => deleteRecord(row.original.id)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Billing"
        subtitle="Track invoices and collect payments with Stripe."
        actions={
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button>New Billing Record</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Billing Record</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Select value={newClientId} onValueChange={setNewClientId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={newTypeId} onValueChange={setNewTypeId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {billingTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    value={newAmount}
                    onChange={(event) => setNewAmount(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={newDueDate}
                    onChange={(event) => setNewDueDate(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={newNotes}
                    onChange={(event) => setNewNotes(event.target.value)}
                  />
                </div>
                <Button className="w-full" onClick={createRecord}>
                  Save Billing Record
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <FilterBar>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["DUE", "PAID", "OVERDUE", "VOID"].map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {billingTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          title="No billing records"
          description="Create your first billing record to track due and paid amounts."
          ctaLabel="Add Billing Record"
          onCta={() => setOpenCreate(true)}
        />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}
    </div>
  );
}
