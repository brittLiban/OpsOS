"use client";

import * as React from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Plus,
  RefreshCcw,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type CalendarProvider = "GOOGLE" | "MICROSOFT";
type CalendarProviderSlug = "google" | "microsoft";

type CalendarProviderStatus = {
  provider: CalendarProvider;
  slug: CalendarProviderSlug;
  label: string;
  connected: boolean;
  synced: boolean;
  lastError: string | null;
};

type CalendarEvent = {
  id: string;
  provider: CalendarProvider;
  providerSlug: CalendarProviderSlug;
  title: string;
  startAt: string;
  endAt: string | null;
  isAllDay: boolean;
  link: string | null;
};

type CalendarData = {
  windowStart: string;
  windowEnd: string;
  hasConnectedProviders: boolean;
  providers: CalendarProviderStatus[];
  events: CalendarEvent[];
};

type CalendarEventsApiResponse =
  | { data: CalendarData }
  | {
      error?: {
        message?: string;
      };
    };

type CalendarEventCreateApiResponse =
  | { data: CalendarEvent }
  | {
      error?: {
        message?: string;
      };
    };

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PROVIDER_STYLE: Record<CalendarProvider, { dot: string; badge: "default" | "secondary" }> = {
  GOOGLE: { dot: "bg-emerald-500", badge: "default" },
  MICROSOFT: { dot: "bg-blue-500", badge: "secondary" },
};

export function CalendarPageClient({ initialData }: { initialData: CalendarData }) {
  const initialMonth = React.useMemo(
    () => startOfMonth(new Date(initialData.windowStart)),
    [initialData.windowStart],
  );

  const [viewMonth, setViewMonth] = React.useState(initialMonth);
  const [selectedDayKey, setSelectedDayKey] = React.useState(() =>
    defaultSelectedDayKey(initialMonth),
  );
  const [data, setData] = React.useState(initialData);
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const requestCounter = React.useRef(0);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [createProvider, setCreateProvider] = React.useState<CalendarProviderSlug>("google");
  const [createTitle, setCreateTitle] = React.useState("");
  const [createDescription, setCreateDescription] = React.useState("");
  const [createLocation, setCreateLocation] = React.useState("");
  const [createAllDay, setCreateAllDay] = React.useState(false);
  const [createStartDateTime, setCreateStartDateTime] = React.useState("");
  const [createEndDateTime, setCreateEndDateTime] = React.useState("");
  const [createStartDate, setCreateStartDate] = React.useState("");
  const [createEndDate, setCreateEndDate] = React.useState("");

  const eventsByDay = React.useMemo(() => groupEventsByDay(data.events), [data.events]);
  const monthDays = React.useMemo(() => buildMonthGridDays(viewMonth), [viewMonth]);
  const selectedDayEvents = eventsByDay.get(selectedDayKey) ?? [];

  const connectedProviders = React.useMemo(
    () => data.providers.filter((provider) => provider.connected),
    [data.providers],
  );
  const hasConnectedProviders = connectedProviders.length > 0;

  const fetchMonth = React.useCallback(async (month: Date) => {
    const currentRequest = ++requestCounter.current;
    setLoading(true);
    setErrorMessage(null);

    const start = startOfMonth(month);
    const end = startOfNextMonth(month);
    const query = new URLSearchParams({
      start: start.toISOString(),
      end: end.toISOString(),
    });

    try {
      const response = await fetch(`/api/v1/calendar/events?${query.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as CalendarEventsApiResponse;
      if (!response.ok || !("data" in payload)) {
        const message = "error" in payload ? payload.error?.message : undefined;
        throw new Error(message ?? "Failed to load calendar events");
      }
      if (currentRequest !== requestCounter.current) {
        return;
      }

      setData(payload.data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load calendar events";
      if (currentRequest !== requestCounter.current) {
        return;
      }
      setErrorMessage(message);
      toast.error(message);
    } finally {
      if (currentRequest === requestCounter.current) {
        setLoading(false);
      }
    }
  }, []);

  React.useEffect(() => {
    if (connectedProviders.length === 0) {
      return;
    }
    setCreateProvider((current) => {
      if (connectedProviders.some((provider) => provider.slug === current)) {
        return current;
      }
      return connectedProviders[0].slug;
    });
  }, [connectedProviders]);

  function goToMonth(nextMonth: Date) {
    const normalized = startOfMonth(nextMonth);
    setViewMonth(normalized);
    setSelectedDayKey((current) =>
      isDateKeyInMonth(current, normalized) ? current : defaultSelectedDayKey(normalized),
    );
    void fetchMonth(normalized);
  }

  function goToToday() {
    const now = new Date();
    const month = startOfMonth(now);
    setViewMonth(month);
    setSelectedDayKey(toDateKey(now));
    void fetchMonth(month);
  }

  function refreshMonth() {
    void fetchMonth(viewMonth);
  }

  function resetCreateForm(dayKey = selectedDayKey) {
    const defaults = createFormDefaults(dayKey);
    setCreateTitle("");
    setCreateDescription("");
    setCreateLocation("");
    setCreateAllDay(false);
    setCreateStartDateTime(defaults.startDateTime);
    setCreateEndDateTime(defaults.endDateTime);
    setCreateStartDate(defaults.startDate);
    setCreateEndDate("");
  }

  async function createAppointment() {
    if (!hasConnectedProviders) {
      toast.error("Connect a calendar provider first");
      return;
    }
    if (!createTitle.trim()) {
      toast.error("Appointment title is required");
      return;
    }

    let startAt: Date | null = null;
    let endAt: Date | null = null;

    if (createAllDay) {
      startAt = parseDateInputValue(createStartDate);
      endAt = createEndDate ? parseDateInputValue(createEndDate) : null;
    } else {
      startAt = parseDateTimeInputValue(createStartDateTime);
      endAt = createEndDateTime ? parseDateTimeInputValue(createEndDateTime) : null;
    }

    if (!startAt) {
      toast.error("Start date/time is invalid");
      return;
    }

    if (endAt && endAt.getTime() <= startAt.getTime()) {
      toast.error("End date/time must be after start date/time");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/v1/calendar/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: createProvider,
          title: createTitle.trim(),
          description: createDescription.trim() || null,
          location: createLocation.trim() || null,
          isAllDay: createAllDay,
          startAt: startAt.toISOString(),
          endAt: endAt ? endAt.toISOString() : null,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as CalendarEventCreateApiResponse;
      if (!response.ok || !("data" in payload)) {
        const message = "error" in payload ? payload.error?.message : undefined;
        throw new Error(message ?? "Failed to create appointment");
      }

      const createdDayKey = toEventDateKey(payload.data);
      if (createdDayKey) {
        setSelectedDayKey(createdDayKey);
      }

      setCreateOpen(false);
      resetCreateForm();
      await fetchMonth(viewMonth);
      toast.success("Appointment created and synced");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create appointment");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        subtitle="Visual monthly schedule synced from connected Google and Outlook calendars."
        actions={
          <>
            <Dialog
              open={createOpen}
              onOpenChange={(open) => {
                setCreateOpen(open);
                if (open) {
                  resetCreateForm(selectedDayKey);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button disabled={!hasConnectedProviders}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Appointment
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>Create Appointment</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select value={createProvider} onValueChange={(value) => setCreateProvider(value as CalendarProviderSlug)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {connectedProviders.map((provider) => (
                          <SelectItem key={provider.slug} value={provider.slug}>
                            {provider.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="appointment-title">Title</Label>
                    <Input
                      id="appointment-title"
                      value={createTitle}
                      onChange={(event) => setCreateTitle(event.target.value)}
                      placeholder="Discovery call with Acme Roofing"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={createAllDay}
                      onCheckedChange={(checked) => setCreateAllDay(Boolean(checked))}
                    />
                    All-day appointment
                  </label>
                  {createAllDay ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Start date</Label>
                        <Input
                          type="date"
                          value={createStartDate}
                          onChange={(event) => setCreateStartDate(event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>End date (optional)</Label>
                        <Input
                          type="date"
                          value={createEndDate}
                          onChange={(event) => setCreateEndDate(event.target.value)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Start</Label>
                        <Input
                          type="datetime-local"
                          value={createStartDateTime}
                          onChange={(event) => setCreateStartDateTime(event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>End (optional)</Label>
                        <Input
                          type="datetime-local"
                          value={createEndDateTime}
                          onChange={(event) => setCreateEndDateTime(event.target.value)}
                        />
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="appointment-location">Location (optional)</Label>
                    <Input
                      id="appointment-location"
                      value={createLocation}
                      onChange={(event) => setCreateLocation(event.target.value)}
                      placeholder="Zoom / Office / Customer Site"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="appointment-description">Notes (optional)</Label>
                    <Textarea
                      id="appointment-description"
                      rows={4}
                      value={createDescription}
                      onChange={(event) => setCreateDescription(event.target.value)}
                      placeholder="Agenda, talking points, prep notes..."
                    />
                  </div>
                  <Button className="w-full" onClick={() => void createAppointment()} disabled={creating}>
                    {creating ? "Creating..." : "Create + Sync"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="secondary" onClick={() => goToMonth(addMonths(viewMonth, -1))}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Prev
            </Button>
            <Button variant="secondary" onClick={goToToday}>
              Today
            </Button>
            <Button variant="secondary" onClick={() => goToMonth(addMonths(viewMonth, 1))}>
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
            <Button onClick={refreshMonth} disabled={loading}>
              <RefreshCcw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={formatMonthLabel(viewMonth)} variant="outline" />
        {data.providers.map((provider) => (
          <StatusBadge
            key={provider.provider}
            label={`${provider.slug}: ${!provider.connected ? "not connected" : provider.synced ? "synced" : "sync error"}`}
            variant={!provider.connected ? "outline" : provider.synced ? "default" : "destructive"}
          />
        ))}
      </div>

      {!data.hasConnectedProviders ? (
        <EmptyState
          title="No calendar connected"
          description="Connect Google or Microsoft in Settings to sync events into this visual calendar."
          ctaLabel="Open Integrations"
          ctaHref="/settings/integrations"
          icon={<CalendarDays className="h-8 w-8 text-muted-foreground" />}
        />
      ) : null}

      {data.hasConnectedProviders ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>{formatMonthLabel(viewMonth)}</CardTitle>
            </CardHeader>
            <CardContent>
              {errorMessage ? (
                <div className="rounded-lg border border-destructive/40 p-4">
                  <p className="text-sm text-destructive">
                    Couldn&apos;t load synced events for this month.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{errorMessage}</p>
                  <Button className="mt-3" size="sm" onClick={refreshMonth}>
                    Retry
                  </Button>
                </div>
              ) : loading ? (
                <CalendarGridSkeleton />
              ) : (
                <div className="rounded-lg border">
                  <div className="grid grid-cols-7 border-b bg-muted/30">
                    {WEEKDAY_LABELS.map((label) => (
                      <div key={label} className="px-2 py-2 text-xs font-medium text-muted-foreground">
                        {label}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {monthDays.map((day) => {
                      const key = toDateKey(day);
                      const dayEvents = eventsByDay.get(key) ?? [];
                      const inCurrentMonth = day.getMonth() === viewMonth.getMonth();
                      const selected = key === selectedDayKey;
                      const preview = dayEvents.slice(0, 3);
                      const moreCount = dayEvents.length - preview.length;

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedDayKey(key)}
                          className={cn(
                            "min-h-28 border-b border-r p-2 text-left transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            !inCurrentMonth && "bg-muted/20 text-muted-foreground",
                            selected && "bg-primary/10",
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">{day.getDate()}</span>
                            {dayEvents.length > 0 ? (
                              <span className="text-[10px] text-muted-foreground">
                                {dayEvents.length}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-2 space-y-1">
                            {preview.map((event) => (
                              <div
                                key={event.id}
                                className="flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]"
                              >
                                <span
                                  className={cn(
                                    "h-1.5 w-1.5 shrink-0 rounded-full",
                                    PROVIDER_STYLE[event.provider].dot,
                                  )}
                                />
                                <span className="truncate">{event.title}</span>
                              </div>
                            ))}
                            {moreCount > 0 ? (
                              <p className="text-[10px] text-muted-foreground">+{moreCount} more</p>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{formatSelectedDayHeading(selectedDayKey)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedDayEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No synced events for this day.
                </p>
              ) : (
                selectedDayEvents.map((event) => (
                  <div key={event.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{event.title}</p>
                      <StatusBadge
                        label={event.providerSlug}
                        variant={PROVIDER_STYLE[event.provider].badge}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatEventWindow(event)}
                    </p>
                    {event.link ? (
                      <a
                        href={event.link}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Open in provider calendar
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function CalendarGridSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-full" />
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
    </div>
  );
}

function createFormDefaults(dayKey: string) {
  const day = parseDateKey(dayKey) ?? new Date();
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return {
    startDateTime: toDateTimeInputValue(start),
    endDateTime: toDateTimeInputValue(end),
    startDate: toDateInputValue(day),
  };
}

function groupEventsByDay(events: CalendarEvent[]) {
  const grouped = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = toEventDateKey(event);
    if (!key) {
      continue;
    }
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)?.push(event);
  }
  for (const values of grouped.values()) {
    values.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }
  return grouped;
}

function toEventDateKey(event: CalendarEvent) {
  const date = new Date(event.startAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  if (event.isAllDay) {
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }
  return toDateKey(date);
}

function defaultSelectedDayKey(month: Date) {
  const today = new Date();
  if (today.getFullYear() === month.getFullYear() && today.getMonth() === month.getMonth()) {
    return toDateKey(today);
  }
  return toDateKey(month);
}

function isDateKeyInMonth(dateKey: string, month: Date) {
  const parsed = parseDateKey(dateKey);
  if (!parsed) {
    return false;
  }
  return parsed.getFullYear() === month.getFullYear() && parsed.getMonth() === month.getMonth();
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function startOfNextMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 1);
}

function addMonths(value: Date, count: number) {
  return new Date(value.getFullYear(), value.getMonth() + count, 1);
}

function buildMonthGridDays(month: Date) {
  const firstDay = startOfMonth(month);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());

  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  end.setDate(end.getDate() + (6 - end.getDay()));

  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateKey(dateKey: string) {
  const [yearText, monthText, dayText] = dateKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!year || !month || !day) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateInputValue(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function toDateTimeInputValue(value: Date) {
  return `${toDateInputValue(value)}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function parseDateInputValue(value: string) {
  if (!value) {
    return null;
  }
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateTimeInputValue(value: string) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatSelectedDayHeading(selectedDayKey: string) {
  const day = parseDateKey(selectedDayKey);
  if (!day) {
    return "Selected day";
  }
  return day.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatEventWindow(event: CalendarEvent) {
  if (event.isAllDay) {
    return "All day";
  }
  const start = new Date(event.startAt);
  const end = event.endAt ? new Date(event.endAt) : null;
  if (Number.isNaN(start.getTime())) {
    return "-";
  }

  const startLabel = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (!end || Number.isNaN(end.getTime())) {
    return startLabel;
  }
  const endLabel = end.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${startLabel} - ${endLabel}`;
}
