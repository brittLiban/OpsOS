"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ClientDetail = {
  id: string;
  name: string;
  status: string;
  onboardingItems: {
    id: string;
    title: string;
    sortOrder: number;
    status: "TODO" | "DONE" | "SKIPPED";
  }[];
  notes: {
    id: string;
    body: string;
    createdAt: Date;
  }[];
  tasks: {
    id: string;
    title: string;
    status: string;
    dueAt: Date | null;
  }[];
  billingRecords: {
    id: string;
    amount: unknown;
    status: string;
    dueDate: Date;
    billingType: { name: string };
  }[];
};

export function ClientDetailPage({ client }: { client: ClientDetail }) {
  const router = useRouter();
  const [items, setItems] = React.useState(client.onboardingItems);
  const [notes, setNotes] = React.useState(client.notes);
  const [noteBody, setNoteBody] = React.useState("");
  const [newTaskTitle, setNewTaskTitle] = React.useState("");
  const [newTaskDueDate, setNewTaskDueDate] = React.useState("");

  async function deleteClient() {
    const response = await fetch(`/api/v1/clients/${client.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("Failed to delete client");
      return;
    }
    toast.success("Client deleted");
    router.push("/clients");
    router.refresh();
  }

  async function toggleOnboarding(itemId: string, checked: boolean) {
    const previous = items;
    setItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, status: checked ? "DONE" : "TODO" } : item,
      ),
    );

    const response = await fetch(`/api/v1/onboarding-items/${itemId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status: checked ? "DONE" : "TODO",
      }),
    });

    if (!response.ok) {
      setItems(previous);
      toast.error("Could not update onboarding item");
      return;
    }
    toast.success("Onboarding item updated");
  }

  async function reorderItem(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) {
      return;
    }

    const copy = [...items];
    [copy[index], copy[targetIndex]] = [copy[targetIndex], copy[index]];
    const withSort = copy.map((item, idx) => ({ ...item, sortOrder: idx }));
    setItems(withSort);

    await Promise.all(
      withSort.map((item) =>
        fetch(`/api/v1/onboarding-items/${item.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sortOrder: item.sortOrder }),
        }),
      ),
    );
  }

  async function addNote() {
    if (noteBody.trim().length === 0) {
      return;
    }
    const response = await fetch(`/api/v1/clients/${client.id}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: noteBody }),
    });
    if (!response.ok) {
      toast.error("Failed to add note");
      return;
    }
    const json = (await response.json()) as { data: { id: string; body: string; createdAt: string } };
    setNotes((current) => [
      {
        id: json.data.id,
        body: json.data.body,
        createdAt: new Date(json.data.createdAt),
      },
      ...current,
    ]);
    setNoteBody("");
    toast.success("Note added");
  }

  async function addTask() {
    if (newTaskTitle.trim().length === 0) {
      return;
    }
    const response = await fetch("/api/v1/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: client.id,
        title: newTaskTitle,
        dueAt: newTaskDueDate ? new Date(newTaskDueDate).toISOString() : null,
      }),
    });
    if (!response.ok) {
      toast.error("Failed to create task");
      return;
    }
    toast.success("Task created");
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.name}
        subtitle="Client Detail"
        actions={
          <>
            <StatusBadge label={client.status} />
            <ConfirmDialog
              trigger={<Button variant="destructive">Delete Client</Button>}
              title="Delete Client"
              description="This will delete the client and all related data. This action cannot be undone."
              confirmLabel="Delete"
              onConfirm={deleteClient}
            />
            <Button asChild>
              <Link href="/billing">Add Billing</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Onboarding Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map((item, index) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={item.status === "DONE"}
                    onCheckedChange={(checked) => toggleOnboarding(item.id, Boolean(checked))}
                  />
                  <span className={item.status === "DONE" ? "line-through text-muted-foreground" : ""}>
                    {item.title}
                  </span>
                </label>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => reorderItem(index, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => reorderItem(index, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Textarea
                value={noteBody}
                onChange={(event) => setNoteBody(event.target.value)}
                placeholder="Append a note..."
              />
              <Button size="sm" onClick={addNote}>
                Add Note
              </Button>
            </div>
            <div className="space-y-2">
              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="rounded-lg border p-3 text-sm">
                    <p>{note.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(note.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Client Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium">Add Task</p>
              <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
                <Input
                  value={newTaskTitle}
                  onChange={(event) => setNewTaskTitle(event.target.value)}
                  placeholder="Task title"
                />
                <Input
                  type="date"
                  value={newTaskDueDate}
                  onChange={(event) => setNewTaskDueDate(event.target.value)}
                />
                <Button onClick={addTask}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>
            {client.tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks yet.</p>
            ) : (
              client.tasks.map((task) => (
                <div key={task.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{task.title}</p>
                    <StatusBadge label={task.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Due {task.dueAt ? new Date(task.dueAt).toLocaleDateString() : "unscheduled"}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing Records</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {client.billingRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground">No billing records yet.</p>
            ) : (
              client.billingRecords.map((record) => (
                <div key={record.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{record.billingType.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Due {new Date(record.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">${Number(record.amount).toFixed(2)}</p>
                    <StatusBadge label={record.status} />
                  </div>
                </div>
              ))
            )}
            <Button variant="secondary" asChild>
              <Link href="/billing">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Manage Billing
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
