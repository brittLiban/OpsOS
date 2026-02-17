import { CalendarPageClient } from "@/components/modules/calendar/calendar-page-client";
import { getSessionContext } from "@/lib/server/auth";
import { getSyncedCalendarEvents } from "@/lib/server/integrations";

function getMonthWindow(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

export default async function CalendarPage() {
  const session = await getSessionContext();
  const { start, end } = getMonthWindow();

  const initial = await getSyncedCalendarEvents({
    workspaceId: session.workspaceId,
    start,
    end,
  });

  return <CalendarPageClient initialData={initial} />;
}
