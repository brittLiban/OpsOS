"use client";

import * as React from "react";
import Link from "next/link";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, CheckCircle2, PhoneCall, Plus, RotateCcw, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { PageHeader } from "@/components/app/page-header";
import { StageBadge, StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type LeadDetailClientProps = {
  lead: {
    id: string;
    businessName: string;
    createdAt: Date;
    stage: { id: string; name: string; color: string };
    pipeline: { id: string; name: string };
    nextFollowUpAt: Date | null;
    lastContactedAt: Date | null;
    customData: Record<string, unknown>;
    touchpoints: {
      id: string;
      type: string;
      summary: string | null;
      notes: string | null;
      happenedAt: Date;
      nextFollowUpAt: Date | null;
    }[];
    tasks: {
      id: string;
      title: string;
      status: string;
      dueAt: Date | null;
    }[];
    email: string | null;
    phone: string | null;
    city: string | null;
    niche: string | null;
    contactName: string | null;
  };
  pipelines: {
    id: string;
    name: string;
    stages: { id: string; name: string; color: string }[];
  }[];
  customFields: {
    id: string;
    key: string;
    label: string;
    fieldType: string;
  }[];
};

const touchpointSchema = z.object({
  type: z.enum(["CALL", "EMAIL", "SMS", "MEETING", "NOTE", "OTHER"]),
  outcome: z.string().optional(),
  summary: z.string().optional(),
  notes: z.string().optional(),
  nextFollowUpAt: z.string().optional(),
});

const followUpSchema = z.object({
  nextFollowUpAt: z.string().min(1),
});

export function LeadDetailClient({
  lead,
  pipelines,
  customFields,
}: LeadDetailClientProps) {
  const router = useRouter();
  const [touchpointOpen, setTouchpointOpen] = React.useState(false);
  const [followUpOpen, setFollowUpOpen] = React.useState(false);
  const [moveStageOpen, setMoveStageOpen] = React.useState(false);
  const [converting, setConverting] = React.useState(false);
  const [quickNote, setQuickNote] = React.useState("");
  const [savingQuickNote, setSavingQuickNote] = React.useState(false);
  const [newTaskTitle, setNewTaskTitle] = React.useState("");
  const [newTaskDueDate, setNewTaskDueDate] = React.useState("");
  const [savingTask, setSavingTask] = React.useState(false);

  const currentPipeline = pipelines.find((pipeline) => pipeline.id === lead.pipeline.id);
  const configuredFieldKeys = React.useMemo(
    () => new Set(customFields.map((field) => field.key)),
    [customFields],
  );
  const adHocFields = React.useMemo(
    () =>
      Object.entries(lead.customData ?? {}).filter(
        ([key, value]) => !configuredFieldKeys.has(key) && hasDisplayValue(value),
      ),
    [configuredFieldKeys, lead.customData],
  );
  const noteTouchpoints = React.useMemo(
    () => lead.touchpoints.filter((touchpoint) => touchpoint.type === "NOTE"),
    [lead.touchpoints],
  );
  const timelineItems = React.useMemo(() => {
    const createdAt = toDateValue(lead.createdAt);
    const createdEvent: TimelineItem = {
      id: `lead-created-${lead.id}`,
      label: "Lead created",
      description: `${lead.businessName} was added to Ops OS.`,
      at: createdAt,
    };

    const touchpointEvents: TimelineItem[] = lead.touchpoints.map((touchpoint) => {
      const details: string[] = [];
      if (touchpoint.summary && touchpoint.summary.trim().length > 0) {
        details.push(touchpoint.summary.trim());
      }
      if (touchpoint.notes && touchpoint.notes.trim().length > 0) {
        details.push(touchpoint.notes.trim());
      }
      if (touchpoint.nextFollowUpAt) {
        const formattedFollowUp = formatDateTime(touchpoint.nextFollowUpAt);
        if (formattedFollowUp) {
          details.push(`Next follow-up: ${formattedFollowUp}`);
        }
      }

      return {
        id: touchpoint.id,
        label: touchpoint.type === "NOTE" ? "Note added" : `${touchpoint.type} touchpoint`,
        description: details.length > 0 ? details.join(" • ") : null,
        at: toDateValue(touchpoint.happenedAt),
      };
    });

    return [createdEvent, ...touchpointEvents].sort((a, b) => b.at.getTime() - a.at.getTime());
  }, [lead.businessName, lead.createdAt, lead.id, lead.touchpoints]);

  const touchpointForm = useForm<z.infer<typeof touchpointSchema>>({
    resolver: zodResolver(touchpointSchema),
    defaultValues: {
      type: "CALL",
      outcome: "",
      summary: "",
      notes: "",
      nextFollowUpAt: lead.nextFollowUpAt
        ? new Date(lead.nextFollowUpAt).toISOString().slice(0, 16)
        : "",
    },
  });

  const followUpForm = useForm<z.infer<typeof followUpSchema>>({
    resolver: zodResolver(followUpSchema),
    defaultValues: {
      nextFollowUpAt: lead.nextFollowUpAt
        ? new Date(lead.nextFollowUpAt).toISOString().slice(0, 16)
        : "",
    },
  });

  const moveStageForm = useForm<{ stageId: string }>({
    defaultValues: {
      stageId: lead.stage.id,
    },
  });

  async function logTouchpoint(values: z.infer<typeof touchpointSchema>) {
    try {
      const response = await fetch(`/api/v1/leads/${lead.id}/touchpoints`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...values,
          nextFollowUpAt: values.nextFollowUpAt
            ? new Date(values.nextFollowUpAt).toISOString()
            : null,
        }),
      });
      if (!response.ok) {
        throw new Error();
      }
      toast.success("Touchpoint logged");
      setTouchpointOpen(false);
      router.refresh();
    } catch {
      toast.error("Could not log touchpoint");
    }
  }

  async function setFollowUp(values: z.infer<typeof followUpSchema>) {
    try {
      const response = await fetch(`/api/v1/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nextFollowUpAt: new Date(values.nextFollowUpAt).toISOString(),
        }),
      });
      if (!response.ok) {
        throw new Error();
      }
      toast.success("Follow-up updated");
      setFollowUpOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to update follow-up");
    }
  }

  async function moveStage(values: { stageId: string }) {
    try {
      const response = await fetch(`/api/v1/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stageId: values.stageId }),
      });
      if (!response.ok) {
        throw new Error();
      }
      toast.success("Stage updated");
      setMoveStageOpen(false);
      router.refresh();
    } catch {
      toast.error("Could not move stage");
    }
  }

  async function convertToClient() {
    setConverting(true);
    try {
      const response = await fetch(`/api/v1/leads/${lead.id}/convert-client`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ createInitialBilling: false }),
      });
      if (!response.ok) {
        throw new Error();
      }
      const json = (await response.json()) as { data: { client: { id: string } } };
      toast.success("Converted to client");
      window.location.href = `/clients/${json.data.client.id}`;
    } catch {
      toast.error("Failed to convert lead");
    } finally {
      setConverting(false);
    }
  }

  async function deleteLead() {
    try {
      const response = await fetch(`/api/v1/leads/${lead.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error();
      }
      toast.success("Lead deleted");
      router.push("/leads");
      router.refresh();
    } catch {
      toast.error("Failed to delete lead");
    }
  }

  async function addQuickNote() {
    const note = quickNote.trim();
    if (!note) {
      return;
    }
    setSavingQuickNote(true);
    try {
      const response = await fetch(`/api/v1/leads/${lead.id}/touchpoints`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "NOTE",
          notes: note,
          summary: "Comment",
        }),
      });
      if (!response.ok) {
        throw new Error();
      }
      setQuickNote("");
      toast.success("Note added");
      router.refresh();
    } catch {
      toast.error("Failed to add note");
    } finally {
      setSavingQuickNote(false);
    }
  }

  async function addTask() {
    if (newTaskTitle.trim().length === 0) {
      return;
    }
    setSavingTask(true);
    try {
      const response = await fetch("/api/v1/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          title: newTaskTitle.trim(),
          dueAt: newTaskDueDate ? new Date(newTaskDueDate).toISOString() : null,
        }),
      });
      if (!response.ok) {
        throw new Error();
      }
      setNewTaskTitle("");
      setNewTaskDueDate("");
      toast.success("Task created");
      router.refresh();
    } catch {
      toast.error("Failed to create task");
    } finally {
      setSavingTask(false);
    }
  }

  async function setTaskStatus(taskId: string, status: "TODO" | "DONE") {
    try {
      const response = await fetch(`/api/v1/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error();
      }
      toast.success(status === "DONE" ? "Task marked done" : "Task reopened");
      router.refresh();
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
      toast.success("Task deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete task");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={lead.businessName}
        subtitle={`Pipeline: ${lead.pipeline.name}`}
        actions={
          <>
            <Dialog open={touchpointOpen} onOpenChange={setTouchpointOpen}>
              <DialogTrigger asChild>
                <Button>
                  <PhoneCall className="mr-2 h-4 w-4" />
                  Log Touchpoint
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Log Touchpoint</DialogTitle>
                  <DialogDescription>
                    Capture call outcome and optionally schedule the next follow-up.
                  </DialogDescription>
                </DialogHeader>
                <Form {...touchpointForm}>
                  <form
                    className="space-y-4"
                    onSubmit={touchpointForm.handleSubmit(logTouchpoint)}
                  >
                    <FormField
                      control={touchpointForm.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {["CALL", "EMAIL", "SMS", "MEETING", "NOTE", "OTHER"].map((value) => (
                                <SelectItem key={value} value={value}>
                                  {value}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={touchpointForm.control}
                      name="outcome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Outcome</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={touchpointForm.control}
                      name="summary"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Summary</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={touchpointForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={touchpointForm.control}
                      name="nextFollowUpAt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Next Follow-up</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full">
                      Save Touchpoint
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <Dialog open={followUpOpen} onOpenChange={setFollowUpOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Set Follow-up
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Set Follow-up</DialogTitle>
                </DialogHeader>
                <Form {...followUpForm}>
                  <form
                    className="space-y-4"
                    onSubmit={followUpForm.handleSubmit(setFollowUp)}
                  >
                    <FormField
                      control={followUpForm.control}
                      name="nextFollowUpAt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Follow-up date/time</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full">
                      Update Follow-up
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <Dialog open={moveStageOpen} onOpenChange={setMoveStageOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary">Move Stage</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Move Stage</DialogTitle>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={moveStageForm.handleSubmit(moveStage)}
                >
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">Stage</span>
                    <Select
                      value={moveStageForm.watch("stageId")}
                      onValueChange={(value) => moveStageForm.setValue("stageId", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currentPipeline?.stages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <Button type="submit" className="w-full">
                    Move
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Button variant="outline" onClick={convertToClient} disabled={converting}>
              {converting ? "Converting..." : "Convert to Client"}
            </Button>
            <ConfirmDialog
              trigger={<Button variant="destructive">Delete Lead</Button>}
              title="Delete Lead"
              description="This will delete the lead and related lead activity. This action cannot be undone."
              confirmLabel="Delete"
              onConfirm={deleteLead}
            />
          </>
        }
      />

      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StageBadge label={lead.stage.name} color={lead.stage.color} />
          <StatusBadge
            label={
              lead.nextFollowUpAt
                ? `Next Follow-up: ${new Date(lead.nextFollowUpAt).toLocaleString()}`
                : "No follow-up set"
            }
          />
          <StatusBadge
            variant="outline"
            label={
              lead.lastContactedAt
                ? `Last Contact: ${new Date(lead.lastContactedAt).toLocaleString()}`
                : "No touchpoints yet"
            }
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {timelineItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No timeline events yet.</p>
            ) : (
              timelineItems.map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(item.at)}
                  </p>
                  {item.description ? <p className="mt-2 text-sm">{item.description}</p> : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                void addQuickNote();
              }}
            >
              <Textarea
                value={quickNote}
                onChange={(event) => setQuickNote(event.target.value)}
                placeholder="Add a note or comment for this lead"
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={savingQuickNote || quickNote.trim().length === 0}>
                  {savingQuickNote ? "Saving..." : "Add Note"}
                </Button>
              </div>
            </form>
            {noteTouchpoints.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            ) : (
              noteTouchpoints.map((note) => (
                <div key={note.id} className="rounded-lg border p-3 text-sm">
                  <p className="text-xs text-muted-foreground">
                    {new Date(note.happenedAt).toLocaleString()}
                  </p>
                  <p className="mt-2">{note.notes ?? note.summary ?? "-"}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Tasks</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/tasks">Open Tasks Tab</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium">Add Task</p>
              <form
                className="grid gap-2 sm:grid-cols-[1fr_180px_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  void addTask();
                }}
              >
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
                <Button type="submit" disabled={savingTask || newTaskTitle.trim().length === 0}>
                  <Plus className="mr-2 h-4 w-4" />
                  {savingTask ? "Adding..." : "Add"}
                </Button>
              </form>
            </div>
            {lead.tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks attached to this lead.</p>
            ) : (
              lead.tasks.map((task) => (
                <div key={task.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{task.title}</p>
                    <StatusBadge label={task.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Due {task.dueAt ? new Date(task.dueAt).toLocaleDateString() : "unscheduled"}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    {task.status !== "DONE" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          void setTaskStatus(task.id, "DONE");
                        }}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Mark Done
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void setTaskStatus(task.id, "TODO");
                        }}
                      >
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
                      onConfirm={() => deleteTask(task.id)}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lead Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <DetailItem label="Contact" value={lead.contactName} />
            <DetailItem label="Email" value={lead.email} />
            <DetailItem label="Phone" value={lead.phone} />
            <DetailItem label="City" value={lead.city} />
            <DetailItem label="Niche" value={lead.niche} />
            <DetailItem label="Created" value={formatDateTime(lead.createdAt)} />
            {customFields.map((field) => (
              <DetailItem
                key={field.id}
                label={field.label}
                value={formatFieldValue(lead.customData?.[field.key])}
              />
            ))}
            {adHocFields.map(([key, value]) => (
              <DetailItem
                key={key}
                label={toFieldLabel(key)}
                value={formatFieldValue(value)}
              />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="text-sm">
        <Button variant="ghost" asChild>
          <Link href="/today">Back to Today</Link>
        </Button>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value && value.length > 0 ? value : "-"}</p>
    </div>
  );
}

function hasDisplayValue(value: unknown) {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return true;
}

function formatFieldValue(value: unknown) {
  if (!hasDisplayValue(value)) {
    return "-";
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function toFieldLabel(key: string) {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

type TimelineItem = {
  id: string;
  label: string;
  description: string | null;
  at: Date;
};

function toDateValue(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }
  const date = toDateValue(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString();
}
