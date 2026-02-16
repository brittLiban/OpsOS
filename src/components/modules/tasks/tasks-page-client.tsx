"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar } from "@/components/app/filter-bar";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type TaskRow = {
  id: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "CANCELED";
  dueAt: Date | null;
  leadId: string | null;
  clientId: string | null;
  lead: { id: string; businessName: string } | null;
  client: { id: string; name: string } | null;
};

type TaskTargetOption = {
  id: string;
  label: string;
};

export function TasksPageClient({
  initialTasks,
  leadOptions,
  clientOptions,
}: {
  initialTasks: TaskRow[];
  leadOptions: TaskTargetOption[];
  clientOptions: TaskTargetOption[];
}) {
  const [rows, setRows] = React.useState(initialTasks);
  const [q, setQ] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [scopeFilter, setScopeFilter] = React.useState("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [title, setTitle] = React.useState("");
  const [dueAt, setDueAt] = React.useState("");
  const [scopeType, setScopeType] = React.useState<"LEAD" | "CLIENT">("LEAD");
  const [targetId, setTargetId] = React.useState(leadOptions[0]?.id ?? "");
  const [status, setStatus] = React.useState<TaskRow["status"]>("TODO");

  React.useEffect(() => {
    if (scopeType === "LEAD") {
      setTargetId((current) => current || leadOptions[0]?.id || "");
    } else {
      setTargetId((current) => current || clientOptions[0]?.id || "");
    }
  }, [scopeType, leadOptions, clientOptions]);

  const filtered = rows.filter((task) => {
    const relatedLabel = task.lead?.businessName ?? task.client?.name ?? "";
    const matchesQuery =
      q.trim().length === 0 ||
      task.title.toLowerCase().includes(q.toLowerCase()) ||
      relatedLabel.toLowerCase().includes(q.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesScope =
      scopeFilter === "all" ||
      (scopeFilter === "lead" && Boolean(task.leadId)) ||
      (scopeFilter === "client" && Boolean(task.clientId));
    return matchesQuery && matchesStatus && matchesScope;
  });

  async function createTask() {
    if (title.trim().length === 0) {
      return;
    }
    if (!targetId) {
      toast.error(scopeType === "LEAD" ? "Select a lead first" : "Select a client first");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/v1/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          status,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          ...(scopeType === "LEAD" ? { leadId: targetId } : { clientId: targetId }),
        }),
      });
      if (!response.ok) {
        throw new Error();
      }

      const json = (await response.json()) as {
        data: {
          id: string;
          title: string;
          status: TaskRow["status"];
          dueAt: string | null;
          leadId: string | null;
          clientId: string | null;
        };
      };

      const lead = json.data.leadId
        ? leadOptions.find((option) => option.id === json.data.leadId)
        : null;
      const client = json.data.clientId
        ? clientOptions.find((option) => option.id === json.data.clientId)
        : null;

      const createdRow: TaskRow = {
        id: json.data.id,
        title: json.data.title,
        status: json.data.status,
        dueAt: json.data.dueAt ? new Date(json.data.dueAt) : null,
        leadId: json.data.leadId,
        clientId: json.data.clientId,
        lead: lead ? { id: lead.id, businessName: lead.label } : null,
        client: client ? { id: client.id, name: client.label } : null,
      };

      setRows((current) => [createdRow, ...current]);
      setTitle("");
      setDueAt("");
      setStatus("TODO");
      setCreateOpen(false);
      toast.success("Task created");
    } catch {
      toast.error("Failed to create task");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(taskId: string, nextStatus: TaskRow["status"]) {
    try {
      const response = await fetch(`/api/v1/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        throw new Error();
      }
      setRows((current) =>
        current.map((task) => (task.id === taskId ? { ...task, status: nextStatus } : task)),
      );
      toast.success(nextStatus === "DONE" ? "Task completed" : "Task reopened");
    } catch {
      toast.error("Failed to update task");
    }
  }

  async function deleteTask(taskId: string) {
    try {
      const response = await fetch(`/api/v1/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error();
      }
      setRows((current) => current.filter((task) => task.id !== taskId));
      toast.success("Task deleted");
    } catch {
      toast.error("Failed to delete task");
    }
  }

  const columns: ColumnDef<TaskRow>[] = [
    {
      id: "title",
      header: "Task",
      cell: ({ row }) => <p className="font-medium">{row.original.title}</p>,
    },
    {
      id: "related",
      header: "Related To",
      cell: ({ row }) => {
        if (row.original.lead) {
          return (
            <Link href={`/leads/${row.original.lead.id}`} className="hover:underline">
              {row.original.lead.businessName}
            </Link>
          );
        }
        if (row.original.client) {
          return (
            <Link href={`/clients/${row.original.client.id}`} className="hover:underline">
              {row.original.client.name}
            </Link>
          );
        }
        return "-";
      },
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge label={row.original.status} />,
    },
    {
      id: "dueAt",
      header: "Due",
      cell: ({ row }) =>
        row.original.dueAt ? new Date(row.original.dueAt).toLocaleDateString() : "Unscheduled",
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.status !== "DONE" ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => updateStatus(row.original.id, "DONE")}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Done
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => updateStatus(row.original.id, "TODO")}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reopen
            </Button>
          )}
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="ghost">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            }
            title="Delete Task"
            description="This task will be permanently deleted."
            confirmLabel="Delete"
            onConfirm={() => deleteTask(row.original.id)}
          />
        </div>
      ),
    },
  ];

  const targetOptions = scopeType === "LEAD" ? leadOptions : clientOptions;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tasks"
        subtitle="Track follow-up and delivery work in one place."
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Task</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Call back lead" />
                </div>
                <div className="space-y-2">
                  <Label>Scope</Label>
                  <Select value={scopeType} onValueChange={(value) => setScopeType(value as "LEAD" | "CLIENT")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LEAD">Lead Task</SelectItem>
                      <SelectItem value="CLIENT">Client Task</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{scopeType === "LEAD" ? "Lead" : "Client"}</Label>
                  <Select value={targetId} onValueChange={setTargetId}>
                    <SelectTrigger>
                      <SelectValue placeholder={scopeType === "LEAD" ? "Select lead" : "Select client"} />
                    </SelectTrigger>
                    <SelectContent>
                      {targetOptions.length === 0 ? (
                        <SelectItem value="__none" disabled>
                          No options available
                        </SelectItem>
                      ) : (
                        targetOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={(value) => setStatus(value as TaskRow["status"])}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODO">TODO</SelectItem>
                        <SelectItem value="IN_PROGRESS">IN_PROGRESS</SelectItem>
                        <SelectItem value="DONE">DONE</SelectItem>
                        <SelectItem value="CANCELED">CANCELED</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
                  </div>
                </div>
                <Button className="w-full" onClick={createTask} disabled={saving}>
                  {saving ? "Saving..." : "Create Task"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />
      <FilterBar>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search tasks"
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["TODO", "IN_PROGRESS", "DONE", "CANCELED"].map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={scopeFilter} onValueChange={setScopeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Scope" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All scopes</SelectItem>
            <SelectItem value="lead">Lead tasks</SelectItem>
            <SelectItem value="client">Client tasks</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>
      {filtered.length === 0 ? (
        <EmptyState
          title="No tasks found"
          description="Create your first task and track work from this tab."
          ctaLabel="New Task"
          onCta={() => setCreateOpen(true)}
        />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}
    </div>
  );
}
