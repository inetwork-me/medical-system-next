import { TODAY, toDate } from "../data"

export type CalendarView = "day" | "week" | "month"

/** Server pages pass raw search params; anything unexpected falls back to today's Day view. (Plain module: callable on the server.) */
export function parseCalendarParams(sp: { view?: string; date?: string }): { view: CalendarView; date: string } {
  const view = sp.view === "week" || sp.view === "month" ? sp.view : "day"
  const ok = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && !Number.isNaN(toDate(sp.date).getTime())
  return { view, date: ok ? sp.date! : TODAY }
}
