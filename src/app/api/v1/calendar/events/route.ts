import { HttpError, ok, parseBody, parseSearchParams, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import {
  createSyncedCalendarEvent,
  getSyncedCalendarEvents,
  parseIntegrationProviderSlug,
} from "@/lib/server/integrations";
import { calendarEventCreateSchema, calendarEventsQuerySchema } from "@/lib/validation";

function getMonthWindow(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

export async function GET(request: Request) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const query = parseSearchParams(request, calendarEventsQuerySchema);

    const fallback = getMonthWindow();
    const start = query.start ? new Date(query.start) : fallback.start;
    const end = query.end ? new Date(query.end) : fallback.end;

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid calendar date range");
    }

    const result = await getSyncedCalendarEvents({
      workspaceId: session.workspaceId,
      start,
      end,
    });

    return ok(result);
  });
}

export async function POST(request: Request) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const body = await parseBody(request, calendarEventCreateSchema);
    const provider = parseIntegrationProviderSlug(body.provider);

    const created = await createSyncedCalendarEvent({
      workspaceId: session.workspaceId,
      provider,
      title: body.title,
      description: body.description,
      location: body.location,
      isAllDay: body.isAllDay,
      startAt: body.startAt,
      endAt: body.endAt,
    });

    return ok(created);
  });
}
