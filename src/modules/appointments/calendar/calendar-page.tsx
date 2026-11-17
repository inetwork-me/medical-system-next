"use client"

import { useSearchParams } from "next/navigation"

import { CalendarScreen } from "./calendar"
import { parseCalendarParams } from "./params"

/** Calendar route: ?view= / ?date= read in the browser (works on static hosting). */
export function CalendarPage() {
  const sp = useSearchParams()
  const { view, date } = parseCalendarParams({ view: sp.get("view") ?? undefined, date: sp.get("date") ?? undefined })
  return <CalendarScreen key={`${view}-${date}`} initialView={view} initialDate={date} />
}
