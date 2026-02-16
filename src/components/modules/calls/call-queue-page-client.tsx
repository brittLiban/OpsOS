"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  PhoneCall,
  Plus,
  RefreshCcw,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar } from "@/components/app/filter-bar";
import { PageHeader } from "@/components/app/page-header";
import { StageBadge, StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

type CustomFieldDefinition = {
  id: string;
  key: string;
  label: string;
  fieldType: "TEXT" | "TEXTAREA" | "NUMBER" | "SELECT" | "MULTI_SELECT" | "DATE" | "BOOLEAN";
  isRequired: boolean;
  options: { label: string; value: string }[];
};

type LeadQueueItem = {
  id: string;
  businessName: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  customData: Record<string, unknown>;
  nextFollowUpAt: string | null;
  stage: {
    name: string;
    color: string;
  };
  lastTouchpoint: {
    happenedAt: string | Date;
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
  status: "ACTIVE" | "ONBOARDING" | "PAUSED" | "CHURNED";
  customData: Record<string, unknown>;
  lastNote: {
    body: string;
    createdAt: string | Date;
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
  leadCustomFields,
  clientCustomFields,
}: {
  leads: LeadQueueItem[];
  clients: ClientQueueItem[];
  leadCustomFields: CustomFieldDefinition[];
  clientCustomFields: CustomFieldDefinition[];
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<QueueMode>(clients.length > 0 ? "CLIENT" : "LEAD");
  const [leadQueue, setLeadQueue] = React.useState(leads);
  const [clientQueue, setClientQueue] = React.useState(clients);
  const [leadIndex, setLeadIndex] = React.useState(0);
  const [clientIndex, setClientIndex] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [savingRecord, setSavingRecord] = React.useState(false);
  const [newCustomKey, setNewCustomKey] = React.useState("");
  const [newCustomValue, setNewCustomValue] = React.useState("");

  const form = useForm<CallLogValues>({
    resolver: zodResolver(callLogSchema),
    defaultValues: FORM_DEFAULTS,
  });

  const queue = mode === "CLIENT" ? clientQueue : leadQueue;
  const activeIndex = mode === "CLIENT" ? clientIndex : leadIndex;
  const currentItem = queue[activeIndex] ?? null;
  const followUpPreset = form.watch("followUpPreset");
  const currentCustomFields = mode === "CLIENT" ? clientCustomFields : leadCustomFields;
  const definedCustomKeys = React.useMemo(
    () => new Set(currentCustomFields.map((field) => field.key)),
    [currentCustomFields],
  );
  const currentCustomData = (currentItem?.customData ?? {}) as Record<string, unknown>;
  const adHocCustomEntries = Object.entries(currentCustomData).filter(
    ([key]) => !definedCustomKeys.has(key),
  );

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

  function updateLeadCurrent(partial: Partial<LeadQueueItem>) {
    setLeadQueue((current) =>
      current.map((item, index) => (index === leadIndex ? { ...item, ...partial } : item)),
    );
  }

  function updateClientCurrent(partial: Partial<ClientQueueItem>) {
    setClientQueue((current) =>
      current.map((item, index) => (index === clientIndex ? { ...item, ...partial } : item)),
    );
  }

  function updateCurrentCustomField(key: string, value: unknown) {
    if (mode === "LEAD") {
      const lead = leadQueue[leadIndex];
      if (!lead) {
        return;
      }
      updateLeadCurrent({
        customData: {
          ...(lead.customData ?? {}),
          [key]: value,
        },
      });
      return;
    }

    const client = clientQueue[clientIndex];
    if (!client) {
      return;
    }
    updateClientCurrent({
      customData: {
        ...(client.customData ?? {}),
        [key]: value,
      },
    });
  }

  function removeCurrentCustomField(key: string) {
    if (mode === "LEAD") {
      const lead = leadQueue[leadIndex];
      if (!lead) {
        return;
      }
      const nextCustomData = { ...(lead.customData ?? {}) };
      delete nextCustomData[key];
      updateLeadCurrent({ customData: nextCustomData });
      return;
    }

    const client = clientQueue[clientIndex];
    if (!client) {
      return;
    }
    const nextCustomData = { ...(client.customData ?? {}) };
    delete nextCustomData[key];
    updateClientCurrent({ customData: nextCustomData });
  }

  function addAdHocCustomField() {
    const normalizedKey = toCustomKey(newCustomKey);
    if (normalizedKey.length === 0) {
      toast.error("Custom field key is required");
      return;
    }
    if (Object.prototype.hasOwnProperty.call(currentCustomData, normalizedKey)) {
      toast.error("Custom field key already exists on this record");
      return;
    }
    updateCurrentCustomField(normalizedKey, newCustomValue.trim());
    setNewCustomKey("");
    setNewCustomValue("");
  }

  async function saveCurrentRecord() {
    if (!currentItem) {
      return;
    }

    setSavingRecord(true);
    try {
      if (mode === "LEAD") {
        const lead = currentItem as LeadQueueItem;
        if (lead.businessName.trim().length === 0) {
          toast.error("Business name is required");
          return;
        }

        const response = await fetch(`/api/v1/leads/${lead.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            businessName: lead.businessName.trim(),
            contactName: emptyToNull(lead.contactName),
            phone: emptyToNull(lead.phone),
            email: emptyToNull(lead.email),
            city: emptyToNull(lead.city),
            nextFollowUpAt: lead.nextFollowUpAt ? toIsoStringOrNull(lead.nextFollowUpAt) : null,
            customData: cleanCustomData(lead.customData),
          }),
        });

        await assertSuccess(response, "Could not update lead details");
      } else {
        const client = currentItem as ClientQueueItem;
        if (client.name.trim().length === 0) {
          toast.error("Client name is required");
          return;
        }

        const response = await fetch(`/api/v1/clients/${client.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: client.name.trim(),
            primaryContactName: emptyToNull(client.primaryContactName),
            phone: emptyToNull(client.phone),
            email: emptyToNull(client.email),
            status: client.status,
            customData: cleanCustomData(client.customData),
          }),
        });

        await assertSuccess(response, "Could not update client details");
      }

      toast.success("Record details saved");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save record details";
      toast.error(message);
    } finally {
      setSavingRecord(false);
    }
  }

  async function submitCall(values: CallLogValues) {
    if (!currentItem) {
      return;
    }

    const followUpAt = resolveFollowUpAt(values.followUpPreset, values.customFollowUpAt);
    const meetingAt = values.meetingAt && values.meetingAt.trim().length > 0
      ? toIsoStringOrNull(values.meetingAt)
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
                <Button variant="secondary" onClick={() => void saveCurrentRecord()} disabled={savingRecord}>
                  <Save className="mr-2 h-4 w-4" />
                  {savingRecord ? "Saving..." : "Save Details"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {mode === "LEAD" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <EditableInput
                    label="Business Name"
                    value={(currentItem as LeadQueueItem).businessName}
                    onChange={(value) => updateLeadCurrent({ businessName: value })}
                  />
                  <EditableInput
                    label="Contact"
                    value={(currentItem as LeadQueueItem).contactName ?? ""}
                    onChange={(value) => updateLeadCurrent({ contactName: value })}
                  />
                  <EditableInput
                    label="Phone"
                    value={(currentItem as LeadQueueItem).phone ?? ""}
                    onChange={(value) => updateLeadCurrent({ phone: value })}
                  />
                  <EditableInput
                    label="Email"
                    value={(currentItem as LeadQueueItem).email ?? ""}
                    onChange={(value) => updateLeadCurrent({ email: value })}
                  />
                  <EditableInput
                    label="City"
                    value={(currentItem as LeadQueueItem).city ?? ""}
                    onChange={(value) => updateLeadCurrent({ city: value })}
                  />
                  <EditableDateTime
                    label="Next Follow-up"
                    value={toDateTimeLocalValue((currentItem as LeadQueueItem).nextFollowUpAt)}
                    onChange={(value) =>
                      updateLeadCurrent({
                        nextFollowUpAt: value.trim().length > 0 ? toIsoStringOrNull(value) : null,
                      })
                    }
                  />
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <EditableInput
                    label="Client Name"
                    value={(currentItem as ClientQueueItem).name}
                    onChange={(value) => updateClientCurrent({ name: value })}
                  />
                  <EditableInput
                    label="Primary Contact"
                    value={(currentItem as ClientQueueItem).primaryContactName ?? ""}
                    onChange={(value) => updateClientCurrent({ primaryContactName: value })}
                  />
                  <EditableInput
                    label="Phone"
                    value={(currentItem as ClientQueueItem).phone ?? ""}
                    onChange={(value) => updateClientCurrent({ phone: value })}
                  />
                  <EditableInput
                    label="Email"
                    value={(currentItem as ClientQueueItem).email ?? ""}
                    onChange={(value) => updateClientCurrent({ email: value })}
                  />
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Select
                      value={(currentItem as ClientQueueItem).status}
                      onValueChange={(value) =>
                        updateClientCurrent({
                          status: value as ClientQueueItem["status"],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                        <SelectItem value="ONBOARDING">ONBOARDING</SelectItem>
                        <SelectItem value="PAUSED">PAUSED</SelectItem>
                        <SelectItem value="CHURNED">CHURNED</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">Custom Fields</p>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href="/settings/fields">Manage Definitions</Link>
                  </Button>
                </div>
                <div className="mt-3 space-y-3">
                  {currentCustomFields.map((field) => (
                    <EditableConfiguredCustomField
                      key={field.id}
                      field={field}
                      value={currentCustomData[field.key]}
                      onChange={(value) => updateCurrentCustomField(field.key, value)}
                    />
                  ))}

                  {adHocCustomEntries.map(([key, value]) => (
                    <div key={key} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{toTitle(key)}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCurrentCustomField(key)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                      <Input
                        className="mt-2"
                        value={stringifyUnknown(value)}
                        onChange={(event) => updateCurrentCustomField(key, event.target.value)}
                      />
                    </div>
                  ))}

                  <div className="rounded-lg border p-3">
                    <p className="mb-2 text-sm font-medium">Add Custom Field</p>
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <Input
                        placeholder="Field key (ex: roof_pitch)"
                        value={newCustomKey}
                        onChange={(event) => setNewCustomKey(event.target.value)}
                      />
                      <Input
                        placeholder="Value"
                        value={newCustomValue}
                        onChange={(event) => setNewCustomValue(event.target.value)}
                      />
                      <Button type="button" onClick={addAdHocCustomField}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
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

function EditableConfiguredCustomField({
  field,
  value,
  onChange,
}: {
  field: CustomFieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const normalizedString = String(value ?? "");
  const selectValue = normalizedString.length > 0 ? normalizedString : "__none";

  return (
    <div className="rounded-lg border p-3">
      <p className="mb-2 text-sm font-medium">
        {field.label}
        {field.isRequired ? " *" : ""}
      </p>
      {field.fieldType === "TEXTAREA" ? (
        <Textarea value={normalizedString} onChange={(event) => onChange(event.target.value)} rows={3} />
      ) : null}
      {field.fieldType === "SELECT" ? (
        <Select value={selectValue} onValueChange={(nextValue) => onChange(nextValue === "__none" ? "" : nextValue)}>
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
          value={field.fieldType === "DATE" ? toDateInputValue(value) : normalizedString}
          onChange={(event) => {
            if (field.fieldType === "NUMBER") {
              onChange(event.target.value.trim().length === 0 ? null : Number(event.target.value));
              return;
            }
            onChange(event.target.value);
          }}
        />
      ) : null}
      {field.fieldType === "MULTI_SELECT" ? (
        <div className="grid gap-2">
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

function EditableInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function EditableDateTime({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <Input type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} />
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

function emptyToNull(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toDateInputValue(value: unknown) {
  if (!value) {
    return "";
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

function toIsoStringOrNull(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function stringifyUnknown(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function toCustomKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toTitle(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function truncate(value: string, max: number) {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}...`;
}
