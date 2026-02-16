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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "CANCELED";
  dueAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  completedAt: Date | string | null;
  taskTypeId: string | null;
  customData: Record<string, unknown>;
  leadId: string | null;
  clientId: string | null;
  lead: { id: string; businessName: string } | null;
  client: { id: string; name: string } | null;
  taskType: { id: string; name: string } | null;
};

type TaskTargetOption = {
  id: string;
  label: string;
};

type TaskTypeOption = {
  id: string;
  label: string;
};

type TaskCustomField = {
  id: string;
  key: string;
  label: string;
  fieldType: "TEXT" | "TEXTAREA" | "NUMBER" | "SELECT" | "MULTI_SELECT" | "DATE" | "BOOLEAN";
  isRequired: boolean;
  options: { label: string; value: string }[];
};

export function TasksPageClient({
  initialTasks,
  leadOptions,
  clientOptions,
  taskTypeOptions,
  customFields,
}: {
  initialTasks: TaskRow[];
  leadOptions: TaskTargetOption[];
  clientOptions: TaskTargetOption[];
  taskTypeOptions: TaskTypeOption[];
  customFields: TaskCustomField[];
}) {
  const [rows, setRows] = React.useState(initialTasks);
  const [q, setQ] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [scopeFilter, setScopeFilter] = React.useState("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [dueAt, setDueAt] = React.useState("");
  const [scopeType, setScopeType] = React.useState<"GENERAL" | "LEAD" | "CLIENT">("GENERAL");
  const [targetId, setTargetId] = React.useState("");
  const [taskTypeId, setTaskTypeId] = React.useState(taskTypeOptions[0]?.id ?? "");
  const [status, setStatus] = React.useState<TaskRow["status"]>("TODO");
  const [customData, setCustomData] = React.useState<Record<string, unknown>>({});

  React.useEffect(() => {
    if (scopeType === "GENERAL") {
      setTargetId("");
      return;
    }
    if (scopeType === "LEAD") {
      setTargetId((current) => current || leadOptions[0]?.id || "");
    } else {
      setTargetId((current) => current || clientOptions[0]?.id || "");
    }
  }, [scopeType, leadOptions, clientOptions]);

  const filtered = rows.filter((task) => {
    const relatedLabel = task.lead?.businessName ?? task.client?.name ?? "General";
    const matchesQuery =
      q.trim().length === 0 ||
      task.title.toLowerCase().includes(q.toLowerCase()) ||
      relatedLabel.toLowerCase().includes(q.toLowerCase()) ||
      (task.taskType?.name ?? "").toLowerCase().includes(q.toLowerCase()) ||
      (task.description ?? "").toLowerCase().includes(q.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesScope =
      scopeFilter === "all" ||
      (scopeFilter === "lead" && Boolean(task.leadId)) ||
      (scopeFilter === "client" && Boolean(task.clientId)) ||
      (scopeFilter === "general" && !task.leadId && !task.clientId);
    return matchesQuery && matchesStatus && matchesScope;
  });

  async function createTask() {
    if (title.trim().length === 0) {
      return;
    }
    if (scopeType !== "GENERAL" && !targetId) {
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
          description: description.trim().length > 0 ? description.trim() : null,
          taskTypeId: taskTypeId || null,
          customData: cleanCustomData(customData),
          status,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          ...(scopeType === "LEAD"
            ? { leadId: targetId }
            : scopeType === "CLIENT"
              ? { clientId: targetId }
              : {}),
        }),
      });
      if (!response.ok) {
        throw new Error();
      }

      const json = (await response.json()) as {
        data: {
          id: string;
          title: string;
          description: string | null;
          status: TaskRow["status"];
          dueAt: string | null;
          createdAt: string;
          updatedAt: string;
          completedAt: string | null;
          taskTypeId: string | null;
          customData: Record<string, unknown>;
          leadId: string | null;
          clientId: string | null;
          taskType: { id: string; name: string } | null;
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
        description: json.data.description,
        status: json.data.status,
        dueAt: json.data.dueAt ? new Date(json.data.dueAt) : null,
        createdAt: json.data.createdAt,
        updatedAt: json.data.updatedAt,
        completedAt: json.data.completedAt,
        taskTypeId: json.data.taskTypeId,
        customData: (json.data.customData ?? {}) as Record<string, unknown>,
        leadId: json.data.leadId,
        clientId: json.data.clientId,
        lead: lead ? { id: lead.id, businessName: lead.label } : null,
        client: client ? { id: client.id, name: client.label } : null,
        taskType: json.data.taskType,
      };

      setRows((current) => [createdRow, ...current]);
      setTitle("");
      setDescription("");
      setDueAt("");
      setStatus("TODO");
      setScopeType("GENERAL");
      setTargetId("");
      setCustomData({});
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
      const json = (await response.json()) as {
        data: {
          status: TaskRow["status"];
          updatedAt: string;
          completedAt: string | null;
        };
      };
      setRows((current) =>
        current.map((task) =>
          task.id === taskId
            ? {
                ...task,
                status: json.data.status,
                updatedAt: json.data.updatedAt,
                completedAt: json.data.completedAt,
              }
            : task,
        ),
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
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.title}</p>
          {row.original.description ? (
            <p className="text-xs text-muted-foreground">{row.original.description}</p>
          ) : null}
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: ({ row }) => (
        <StatusBadge label={row.original.taskType?.name ?? "General"} variant="outline" />
      ),
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
        return "General";
      },
    },
    {
      id: "scope",
      header: "Scope",
      cell: ({ row }) =>
        row.original.leadId ? "Lead" : row.original.clientId ? "Client" : "General",
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
        row.original.dueAt ? new Date(row.original.dueAt).toLocaleString() : "Unscheduled",
    },
    {
      id: "activity",
      header: "Activity",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.completedAt
            ? `Completed ${new Date(row.original.completedAt).toLocaleString()}`
            : `Updated ${new Date(row.original.updatedAt).toLocaleString()}`}
        </span>
      ),
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
  const recentActivity = React.useMemo(
    () =>
      [...rows]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 6),
    [rows],
  );

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
                  <Label>Details (optional)</Label>
                  <Textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="What needs to happen?"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Scope</Label>
                  <Select value={scopeType} onValueChange={(value) => setScopeType(value as "GENERAL" | "LEAD" | "CLIENT")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GENERAL">General Task</SelectItem>
                      <SelectItem value="LEAD">Lead Task</SelectItem>
                      <SelectItem value="CLIENT">Client Task</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {scopeType !== "GENERAL" ? (
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
                ) : (
                  <p className="text-xs text-muted-foreground">
                    General tasks are not linked to a specific lead or client.
                  </p>
                )}
                <div className="space-y-2">
                  <Label>Task Type</Label>
                  <Select value={taskTypeId || "__none"} onValueChange={(value) => setTaskTypeId(value === "__none" ? "" : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select task type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">None</SelectItem>
                      {taskTypeOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
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
                    <Label>Due At</Label>
                    <Input
                      type="datetime-local"
                      value={dueAt}
                      onChange={(event) => setDueAt(event.target.value)}
                    />
                  </div>
                </div>
                {customFields.length > 0 ? (
                  <div className="space-y-3 rounded-lg border p-3">
                    <p className="text-sm font-medium">Task Custom Fields</p>
                    {customFields.map((field) => (
                      <TaskDynamicCustomField
                        key={field.id}
                        field={field}
                        value={customData[field.key]}
                        onChange={(value) =>
                          setCustomData((current) => ({
                            ...current,
                            [field.key]: value,
                          }))
                        }
                      />
                    ))}
                  </div>
                ) : null}
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
            <SelectItem value="general">General tasks</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" asChild>
          <Link href="/settings/task-fields">Task Fields Settings</Link>
        </Button>
      </FilterBar>
      {recentActivity.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Task Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentActivity.map((task) => (
              <div key={task.id} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  {task.completedAt
                    ? `Completed ${new Date(task.completedAt).toLocaleString()}`
                    : `Updated ${new Date(task.updatedAt).toLocaleString()}`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {task.lead ? task.lead.businessName : task.client ? task.client.name : "General"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
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

function TaskDynamicCustomField({
  field,
  value,
  onChange,
}: {
  field: TaskCustomField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{field.label}</Label>
      {field.fieldType === "TEXTAREA" ? (
        <Textarea value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />
      ) : null}
      {field.fieldType === "SELECT" ? (
        <Select
          value={String(value ?? "__none")}
          onValueChange={(selected) => onChange(selected === "__none" ? "" : selected)}
        >
          <SelectTrigger>
            <SelectValue placeholder={`Select ${field.label}`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">None</SelectItem>
            {field.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {field.fieldType === "BOOLEAN" ? (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={Boolean(value)} onCheckedChange={(checked) => onChange(Boolean(checked))} />
          <span>Enabled</span>
        </label>
      ) : null}
      {["TEXT", "NUMBER", "DATE"].includes(field.fieldType) ? (
        <Input
          type={field.fieldType === "NUMBER" ? "number" : field.fieldType === "DATE" ? "date" : "text"}
          value={field.fieldType === "DATE" ? toDateValue(value) : String(value ?? "")}
          onChange={(event) =>
            onChange(
              field.fieldType === "NUMBER"
                ? event.target.value.trim().length === 0
                  ? null
                  : Number(event.target.value)
                : event.target.value,
            )
          }
        />
      ) : null}
      {field.fieldType === "MULTI_SELECT" ? (
        <div className="grid grid-cols-1 gap-2">
          {field.options.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={Array.isArray(value) ? value.includes(option.value) : false}
                onCheckedChange={(checked) => {
                  const current = Array.isArray(value) ? value : [];
                  onChange(
                    checked
                      ? [...current, option.value]
                      : current.filter((item) => item !== option.value),
                  );
                }}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function cleanCustomData(customData: Record<string, unknown>) {
  return Object.entries(customData).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (value === undefined || value === null) {
      return acc;
    }
    if (typeof value === "string" && value.trim().length === 0) {
      return acc;
    }
    if (Array.isArray(value) && value.length === 0) {
      return acc;
    }
    acc[key] = value;
    return acc;
  }, {});
}

function toDateValue(value: unknown) {
  if (!value) {
    return "";
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}
