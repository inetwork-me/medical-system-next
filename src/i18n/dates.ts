"use client"

import { useLocale } from "next-intl"

/**
 * Date display used by the design: day-first in English ("15 Nov 2026", like en-GB) and Arabic month names in
 * Arabic ("15 نوفمبر 2026"), always Gregorian with Latin digits (brief §5.2). next-intl's formatter can't change
 * the English field order, so dates go through this helper.
 */
const TAG = (locale: string) => (locale === "ar" ? "ar" : "en-GB")
const BASE: Intl.DateTimeFormatOptions = { numberingSystem: "latn", calendar: "gregory", timeZone: "Asia/Riyadh" }

/** "2026-11-15" → Date at noon UTC (safe in every time zone). */
export const parseDay = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`)

export function dateFormatter(locale: string) {
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(TAG(locale), { ...BASE, ...o })
  const toDate = (d: Date | string) => (typeof d === "string" ? parseDay(d) : d)
  return {
    /** 15 Nov 2026 */
    short: (d: Date | string) => fmt({ day: "numeric", month: "short", year: "numeric" }).format(toDate(d)),
    /** 15 November 2026 */
    long: (d: Date | string) => fmt({ day: "numeric", month: "long", year: "numeric" }).format(toDate(d)),
    /** 15 Nov */
    dayMonth: (d: Date | string) => fmt({ day: "numeric", month: "short" }).format(toDate(d)),
    /** Wednesday, 18 November */
    weekday: (d: Date | string) => fmt({ weekday: "long", day: "numeric", month: "long" }).format(toDate(d)),
    /** 1 – 15 Nov 2026 */
    range: (a: Date | string, b: Date | string) => fmt({ day: "numeric", month: "short", year: "numeric" }).formatRange(toDate(a), toDate(b)),
    /** Nov (chart axes) */
    month: (d: Date | string) => fmt({ month: "short" }).format(toDate(d)),
  }
}

export function useDates() {
  return dateFormatter(useLocale())
}
