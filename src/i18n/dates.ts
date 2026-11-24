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
  const make = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(TAG(locale), { ...BASE, ...o })
  // en-GB abbreviates September as "Sept"; the design uses three letters everywhere.
  const fix = (s: string) => (locale === "ar" ? s : s.replace(/\bSept\b/g, "Sep"))
  const fmt = (o: Intl.DateTimeFormatOptions) => {
    const f = make(o)
    return { format: (d: Date) => fix(f.format(d)), formatRange: (a: Date, b: Date) => fix(f.formatRange(a, b)) }
  }
  const toDate = (d: Date | string) => (typeof d === "string" ? parseDay(d) : d)
  return {
    /** 02 Nov 2026 (design: two-digit day) */
    short: (d: Date | string) => fmt({ day: "2-digit", month: "short", year: "numeric" }).format(toDate(d)),
    /** 04/07/1988 — date fields (DS date picker value), same in both languages */
    numeric: (d: Date | string) => {
      const x = toDate(d)
      return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`
    },
    /** 15 November 2026 */
    long: (d: Date | string) => fmt({ day: "2-digit", month: "long", year: "numeric" }).format(toDate(d)),
    /** 15 Nov */
    dayMonth: (d: Date | string) => fmt({ day: "numeric", month: "short" }).format(toDate(d)),
    /** Wednesday, 18 November */
    weekday: (d: Date | string) => fmt({ weekday: "long", day: "numeric", month: "long" }).format(toDate(d)),
    /** Monday, 16 November 2026 */
    full: (d: Date | string) => fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(toDate(d)),
    /**
     * 15 – 19 Nov 2026 (AR: 15–19 نوفمبر 2026). Built by hand: Intl formatRange separators differ between the
     * server's and the browser's ICU, which breaks hydration.
     */
    dayRange: (a: Date | string, b: Date | string) => {
      const x = toDate(a)
      const y = toDate(b)
      const month = (d: Date) => fmt(locale === "ar" ? { month: "long", year: "numeric" } : { month: "short", year: "numeric" }).format(d)
      const sep = locale === "ar" ? "–" : " – "
      if (x.getUTCFullYear() === y.getUTCFullYear() && x.getUTCMonth() === y.getUTCMonth()) return `${x.getUTCDate()}${sep}${y.getUTCDate()} ${month(y)}`
      const dm = (d: Date) => fmt({ day: "numeric", month: locale === "ar" ? "long" : "short" }).format(d)
      return `${dm(x)}${sep}${dm(y)} ${y.getUTCFullYear()}`
    },
    /** Mon (week strips, column heads) */
    weekdayShort: (d: Date | string) => fmt({ weekday: "short" }).format(toDate(d)),
    /** 1 – 15 Nov 2026 */
    range: (a: Date | string, b: Date | string) => fmt({ day: "numeric", month: "short", year: "numeric" }).formatRange(toDate(a), toDate(b)),
    /** Jan 2024 */
    monthYear: (d: Date | string) => fmt({ month: "short", year: "numeric" }).format(toDate(d)),
    /** November 2026 */
    monthLong: (d: Date | string) => fmt({ month: "long", year: "numeric" }).format(toDate(d)),
    /** Nov (chart axes) */
    month: (d: Date | string) => fmt({ month: "short" }).format(toDate(d)),
    /** "November" / "نوفمبر". */
    monthName: (d: Date | string) => fmt({ month: "long" }).format(toDate(d)),
  }
}

export function useDates() {
  return dateFormatter(useLocale())
}
