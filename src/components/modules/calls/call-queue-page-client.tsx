"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ArrowLeft, ArrowRight, CalendarClock, PhoneCall, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar } from "@/components/app/filter-bar";
import { PageHeader } from "@/components/app/page-header";
import { StageBadge, StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type LeadQueueItem = {
  id: string;
  businessName: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  nextFollowUpAt: Date | null;
  stage: {
    name: string;
    color: string;
  };
  lastTouchpoint: {
    happenedAt: Date;
    summary: string | null;
    notes: string | null;
    outcome: string | null;
  } | null;
};

type ClientQueueItem = {
  id: string;
  name: string;
  primaryContactName: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  lastNote: {
    body: string;
    createdAt: Date;
  } | null;
};

const followUpPresetSchema = z.enum(["none", "tomorrow", "threeDays", "oneWeek", "custom"]);

const callLogSchema = z
  .object({
    outcome: z.string().trim().min(1, "Select how the call went"),
    summary: z.string().trim().min(1, "Add a quick summary"),
    notes: z.string().trim().optional(),
    followUpPreset: followUpPresetSchema,
    customFollowUpAt: z.string().optional(),
    meetingAt: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.followUpPreset === "custom" && (!value.customFollowUpAt || value.customFollowUpAt.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customFollowUpAt"],
        message: "Pick a custom follow-up date/time",
      });
    }
    if (value.followUpPreset === "custom" && value.customFollowUpAt && Number.isNaN(new Date(value.customFollowUpAt).getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customFollowUpAt"],
        message: "Custom follow-up date is invalid",
      });
    }
    if (value.meetingAt && value.meetingAt.trim().length > 0 && Number.isNaN(new Date(value.meetingAt).getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["meetingAt"],
        message: "Meeting date is invalid",
      });
    }
  });

type CallLogValues = z.infer<typeof callLogSchema>;
type QueueMode = "CLIENT" | "LEAD";

const CALL_OUTCOME_OPTIONS = [
  { value: "Reached - Positive", label: "Reached - Positive" },
  { value: "No answer", label: "No answer" },
  { value: "Left voicemail", label: "Left voicemail" },
  { value: "Wrong number", label: "Wrong number" },
  { value: "Requested call back", label: "Requested call back" },
  { value: "Scheduled meeting", label: "Scheduled meeting" },
];

const FOLLOW_UP_OPTIONS: { value: z.infer<typeof followUpPresetSchema>; label: string }[] = [
  { value: "none", label: "No follow-up" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "threeDays", label: "In 3 days" },
  { value: "oneWeek", label: "In 1 week" },
  { value: "custom", label: "Custom date/time" },
];

const FORM_DEFAULTS: CallLogValues = {
  outcome: "Reached - Positive",
  summary: "",
  notes: "",
  followUpPreset: "none",
  customFollowUpAt: "",
  meetingAt: "",
};

export function CallQueuePageClient({
  leads,
  clients,
}: {
  leads: LeadQueueItem[];
  clients: ClientQueueItem[];
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<QueueMode>(clients.length > 0 ? "CLIENT" : "LEAD");
  const [leadQueue, setLeadQueue] = React.useState(leads);
  const [clientQueue, setClientQueue] = React.useState(clients);
  const [leadIndex, setLeadIndex] = React.useState(0);
  const [clientIndex, setClientIndex] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);

  const form = useForm<CallLogValues>({
    resolver: zodResolver(callLogSchema),
    defaultValues: FORM_DEFAULTS,
  });

  const queue = mode === "CLIENT" ? clientQueue : leadQueue;
  const activeIndex = mode === "CLIENT" ? clientIndex : leadIndex;
  const currentItem = queue[activeIndex] ?? null;
  const followUpPreset = form.watch("followUpPreset");

  React.useEffect(() => {
    if (mode === "CLIENT" && clientQueue.length === 0 && leadQueue.length > 0) {
      setMode("LEAD");
    }
    if (mode === "LEAD" && leadQueue.length === 0 && clientQueue.length > 0) {
      setMode("CLIENT");
    }
  }, [clientQueue.length, leadQueue.length, mode]);

  React.useEffect(() => {
    if (clientIndex >= clientQueue.length && clientQueue.length > 0) {
      setClientIndex(clientQueue.length - 1);
    }
  }, [clientIndex, clientQueue.length]);

  React.useEffect(() => {
    if (leadIndex >= leadQueue.length && leadQueue.length > 0) {
      setLeadIndex(leadQueue.length - 1);
    }
  }, [leadIndex, leadQueue.length]);

  React.useEffect(() => {
    form.reset(FORM_DEFAULTS);
  }, [currentItem?.id, form, mode]);

  function refreshQueue() {
    router.refresh();
  }

  function goPrevious() {
    if (mode === "CLIENT") {
      setClientIndex((current) => Math.max(0, current - 1));
      return;
    }
    setLeadIndex((current) => Math.max(0, current - 1));
  }

  function goNext() {
    if (mode === "CLIENT") {
      setClientIndex((current) => Math.min(clientQueue.length - 1, current + 1));
      return;
    }
    setLeadIndex((current) => Math.min(leadQueue.length - 1, current + 1));
  }

  function setQueueIndex(index: number) {
    if (mode === "CLIENT") {
      setClientIndex(index);
      return;
    }
    setLeadIndex(index);
  }

  function removeCurrentFromQueue() {
    if (!currentItem) {
      return;
    }
    if (mode === "CLIENT") {
      setClientQueue((current) => current.filter((item) => item.id !== currentItem.id));
      return;
    }
    setLeadQueue((current) => current.filter((item) => item.id !== currentItem.id));
  }

  async function submitCall(values: CallLogValues) {
    if (!currentItem) {
      return;
    }

    const followUpAt = resolveFollowUpAt(values.followUpPreset, values.customFollowUpAt);
    const meetingAt = values.meetingAt && values.meetingAt.trim().length > 0
      ? new Date(values.meetingAt).toISOString()
      : null;

    setSubmitting(true);
    try {
      if (mode === "LEAD") {
        const lead = currentItem as LeadQueueItem;
        await logLeadCall({ lead, values, followUpAt, meetingAt });
      } else {
        const client = currentItem as ClientQueueItem;
        await logClientCall({ client, values, followUpAt, meetingAt });
      }

      toast.success("Call activity saved");
      removeCurrentFromQueue();
      form.reset(FORM_DEFAULTS);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save call activity";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Call Queue"
        subtitle="Move from one contact to the next, log the outcome, and keep activity clean."
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              refreshQueue();
            }}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh Queue
          </Button>
        }
      />

      <FilterBar>
        <Tabs value={mode} onValueChange={(value) => setMode(value as QueueMode)}>
          <TabsList>
            <TabsTrigger value="CLIENT">Clients</TabsTrigger>
            <TabsTrigger value="LEAD">Leads</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="ml-auto flex items-center gap-2">
          <StatusBadge label={`Remaining ${queue.length}`} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={goPrevious}
            disabled={activeIndex <= 0 || queue.length === 0}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={goNext}
            disabled={queue.length === 0 || activeIndex >= queue.length - 1}
          >
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </FilterBar>

      {!currentItem ? (
        <EmptyState
          title={mode === "CLIENT" ? "No clients in call queue" : "No leads in call queue"}
          description="Add phone numbers to records or refresh your queue after importing/updating contacts."
          ctaLabel="Refresh Queue"
          onCta={() => {
            refreshQueue();
          }}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-xl">
                  {mode === "CLIENT"
                    ? (currentItem as ClientQueueItem).name
                    : (currentItem as LeadQueueItem).businessName}
                </CardTitle>
                {mode === "CLIENT" ? (
                  <StatusBadge label={(currentItem as ClientQueueItem).status} />
                ) : (
                  <StageBadge
                    label={(currentItem as LeadQueueItem).stage.name}
                    color={(currentItem as LeadQueueItem).stage.color}
                  />
                )}
                <StatusBadge label={`${activeIndex + 1} of ${queue.length}`} variant="outline" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <a href={`tel:${currentItem.phone ?? ""}`}>
                    <PhoneCall className="mr-2 h-4 w-4" />
                    Call {currentItem.phone ?? "-"}
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={mode === "CLIENT" ? `/clients/${currentItem.id}` : `/leads/${currentItem.id}`}>
                    Open Detail
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <DataItem
                  label="Contact"
                  value={
                    mode === "CLIENT"
                      ? (currentItem as ClientQueueItem).primaryContactName
                      : (currentItem as LeadQueueItem).contactName
                  }
                />
                <DataItem label="Phone" value={currentItem.phone} />
                <DataItem label="Email" value={currentItem.email} />
                <DataItem
                  label={mode === "CLIENT" ? "Status" : "City"}
                  value={
                    mode === "CLIENT"
                      ? (currentItem as ClientQueueItem).status
                      : (currentItem as LeadQueueItem).city
                  }
                />
                {mode === "LEAD" ? (
                  <DataItem
                    label="Next Follow-up"
                    value={formatDateTime((currentItem as LeadQueueItem).nextFollowUpAt)}
                  />
                ) : null}
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium">Latest activity</p>
                {mode === "CLIENT" ? (
                  (currentItem as ClientQueueItem).lastNote ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime((currentItem as ClientQueueItem).lastNote?.createdAt ?? null)}
                      </p>
                      <p className="text-sm">
                        {truncate((currentItem as ClientQueueItem).lastNote?.body ?? "-", 220)}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">No activity logged yet.</p>
                  )
                ) : (currentItem as LeadQueueItem).lastTouchpoint ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime((currentItem as LeadQueueItem).lastTouchpoint?.happenedAt ?? null)}
                    </p>
                    <p className="text-sm">
                      {truncate(
                        [
                          (currentItem as LeadQueueItem).lastTouchpoint?.outcome ?? "",
                          (currentItem as LeadQueueItem).lastTouchpoint?.summary ?? "",
                          (currentItem as LeadQueueItem).lastTouchpoint?.notes ?? "",
                        ]
                          .filter((part) => part.trim().length > 0)
                          .join(" - "),
                        220,
                      )}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">No activity logged yet.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How did the call go?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                {mode === "LEAD"
                  ? "Saved as a lead CALL touchpoint. This updates lead activity and follow-up."
                  : "Saved as a client activity note. Follow-up and meeting tasks are created when selected."}
              </div>
              <Form {...form}>
                <form className="space-y-4" onSubmit={form.handleSubmit((values) => void submitCall(values))}>
                  <FormField
                    control={form.control}
                    name="outcome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Call outcome</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CALL_OUTCOME_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="summary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Summary</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: Wants quote for 2 locations next month" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="followUpPreset"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reach out again?</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {FOLLOW_UP_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {followUpPreset === "custom" ? (
                    <FormField
                      control={form.control}
                      name="customFollowUpAt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Custom follow-up date/time</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : null}

                  <FormField
                    control={form.control}
                    name="meetingAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Scheduled meeting (optional)</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            value={field.value ?? ""}
                            rows={4}
                            placeholder="Anything relevant from the call..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={submitting}>
                    <CalendarClock className="mr-2 h-4 w-4" />
                    {submitting ? "Saving..." : "Save Activity + Next"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Queue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {queue.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setQueueIndex(index)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    index === activeIndex ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {mode === "CLIENT" ? (item as ClientQueueItem).name : (item as LeadQueueItem).businessName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.phone ?? "-"} {item.email ? `- ${item.email}` : ""}
                      </p>
                    </div>
                    <StatusBadge label={`#${index + 1}`} variant="outline" />
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function resolveFollowUpAt(
  preset: z.infer<typeof followUpPresetSchema>,
  customFollowUpAt: string | undefined,
) {
  const now = new Date();
  if (preset === "none") {
    return null;
  }
  if (preset === "custom") {
    if (!customFollowUpAt || customFollowUpAt.trim().length === 0) {
      return null;
    }
    const parsed = new Date(customFollowUpAt);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toISOString();
  }

  const base = new Date(now);
  if (preset === "tomorrow") {
    base.setDate(base.getDate() + 1);
  } else if (preset === "threeDays") {
    base.setDate(base.getDate() + 3);
  } else {
    base.setDate(base.getDate() + 7);
  }
  return base.toISOString();
}

async function logLeadCall({
  lead,
  values,
  followUpAt,
  meetingAt,
}: {
  lead: LeadQueueItem;
  values: CallLogValues;
  followUpAt: string | null;
  meetingAt: string | null;
}) {
  const notes = [values.notes?.trim(), meetingAt ? `Meeting scheduled: ${formatDateTime(meetingAt)}` : ""]
    .filter((line) => line && line.length > 0)
    .join("\n");

  const touchpointResponse = await fetch(`/api/v1/leads/${lead.id}/touchpoints`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type: "CALL",
      outcome: values.outcome,
      summary: values.summary,
      notes: notes.length > 0 ? notes : null,
      nextFollowUpAt: followUpAt,
    }),
  });

  await assertSuccess(touchpointResponse, "Could not save lead call activity");

  if (meetingAt) {
    const meetingTaskResponse = await fetch("/api/v1/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        leadId: lead.id,
        title: `Meeting with ${lead.businessName}`,
        description: values.summary,
        dueAt: meetingAt,
      }),
    });
    if (!meetingTaskResponse.ok) {
      toast.error("Call logged, but meeting task could not be created");
    }
  }
}

async function logClientCall({
  client,
  values,
  followUpAt,
  meetingAt,
}: {
  client: ClientQueueItem;
  values: CallLogValues;
  followUpAt: string | null;
  meetingAt: string | null;
}) {
  const bodyLines = [
    `Call outcome: ${values.outcome}`,
    `Summary: ${values.summary}`,
    values.notes?.trim() ? `Notes: ${values.notes.trim()}` : "",
    followUpAt ? `Reach out again: ${formatDateTime(followUpAt)}` : "",
    meetingAt ? `Meeting scheduled: ${formatDateTime(meetingAt)}` : "",
  ].filter((line) => line.length > 0);

  const noteResponse = await fetch(`/api/v1/clients/${client.id}/notes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      body: bodyLines.join("\n"),
    }),
  });

  await assertSuccess(noteResponse, "Could not save client call activity");

  const taskRequests: Promise<Response>[] = [];
  if (followUpAt) {
    taskRequests.push(
      fetch("/api/v1/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          title: `Call back ${client.name}`,
          description: values.summary,
          dueAt: followUpAt,
        }),
      }),
    );
  }
  if (meetingAt) {
    taskRequests.push(
      fetch("/api/v1/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          title: `Meeting with ${client.name}`,
          description: values.summary,
          dueAt: meetingAt,
        }),
      }),
    );
  }

  if (taskRequests.length > 0) {
    const taskResponses = await Promise.all(taskRequests);
    if (taskResponses.some((response) => !response.ok)) {
      toast.error("Call logged, but one or more follow-up tasks failed to create");
    }
  }
}

async function assertSuccess(response: Response, fallbackMessage: string) {
  if (response.ok) {
    return;
  }
  let message = fallbackMessage;
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    if (payload.error?.message) {
      message = payload.error.message;
    }
  } catch {
    // Ignore JSON parse failures and use fallback.
  }
  throw new Error(message);
}

function DataItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value && value.trim().length > 0 ? value : "-"}</p>
    </div>
  );
}

function formatDateTime(value: Date | string | null) {
  if (!value) {
    return "-";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
}

function truncate(value: string, max: number) {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}...`;
}
