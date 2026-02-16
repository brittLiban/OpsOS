"use client";

import * as React from "react";
import Link from "next/link";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, PhoneCall } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type LeadDetailClientProps = {
  lead: {
    id: string;
    businessName: string;
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
    source: string | null;
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

  const currentPipeline = pipelines.find((pipeline) => pipeline.id === lead.pipeline.id);

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

      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Touchpoints</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lead.touchpoints.length === 0 ? (
                <p className="text-sm text-muted-foreground">No touchpoints logged.</p>
              ) : (
                lead.touchpoints.map((touchpoint) => (
                  <div key={touchpoint.id} className="rounded-lg border p-3">
                    <p className="text-sm font-semibold">{touchpoint.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(touchpoint.happenedAt).toLocaleString()}
                    </p>
                    {touchpoint.summary ? <p className="mt-2 text-sm">{touchpoint.summary}</p> : null}
                    {touchpoint.notes ? (
                      <p className="mt-1 text-sm text-muted-foreground">{touchpoint.notes}</p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lead.touchpoints.filter((touchpoint) => touchpoint.type === "NOTE").length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              ) : (
                lead.touchpoints
                  .filter((touchpoint) => touchpoint.type === "NOTE")
                  .map((note) => (
                    <div key={note.id} className="rounded-lg border p-3 text-sm">
                      <p>{note.notes ?? note.summary ?? "-"}</p>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Lead Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <DetailItem label="Contact" value={lead.contactName} />
              <DetailItem label="Email" value={lead.email} />
              <DetailItem label="Phone" value={lead.phone} />
              <DetailItem label="City" value={lead.city} />
              <DetailItem label="Source" value={lead.source} />
              <DetailItem label="Niche" value={lead.niche} />
              {customFields.map((field) => (
                <DetailItem
                  key={field.id}
                  label={field.label}
                  value={String(lead.customData?.[field.key] ?? "-")}
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
