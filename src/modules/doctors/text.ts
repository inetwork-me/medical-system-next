"use client"

import { useLocale, useTranslations } from "next-intl"

import { bi, type Bi } from "@/lib/mock/bi"
import { useDates } from "@/i18n/dates"
import { useClinics } from "@/modules/clinics/store"
import { credStatus, daysUntil, type Credential, type Doctor } from "./data"

/** Locale helpers shared by the Doctors screens. */
export function useDoctorText() {
  const locale = useLocale()
  const t = useTranslations("doctors")
  const dates = useDates()
  const clinics = useClinics()
  const b = (v: Bi) => bi(v, locale)
  const clinicName = (key: string) => {
    const c = clinics.find((x) => x.key === key)
    return c ? b(c.name) : ""
  }
  return {
    locale,
    t,
    dates,
    b,
    clinicName,
    /** "Pediatrics · Room 101" */
    place: (d: Doctor) => t("place", { clinic: clinicName(d.clinic), room: d.room }),
    /** Next free slot: a time, or the day they're back ("Sun 22 Nov"). */
    nextFree: (d: Doctor) => (d.today.nextFree.includes(":") ? d.today.nextFree : `${dates.weekdayShort(d.today.nextFree)} ${dates.dayMonth(d.today.nextFree)}`),
    /** "PALS expires in 38 days" / "BLS expired 6 days ago" */
    credAlert: (c: Credential) => {
      const n = daysUntil(c.expires)
      const name = t(`cred.short.${c.type}`)
      return credStatus(c) === "expired" ? t("cred.expiredAgo", { name, n: -n }) : t("cred.expiresIn", { name, n })
    },
  }
}

export const STATUS_TONE = { in: "success", late: "warning", later: "info", off: "neutral", leave: "neutral" } as const

/**
 * Keep Latin numbers, ranges, times and percentages left-to-right inside Arabic text ("22–26", "20:00–22:00", "5.8%",
 * "+5%"): each run is wrapped in LRI … PDI so the bidi algorithm can't flip it. All-Latin text ("4.8 / 5") is wrapped whole.
 */
export const ltr = (s: string) =>
  !/[\u0600-\u06ff]/.test(s)
    ? `\u2066${s}\u2069`
    : s.replace(/[+\u2212]?[A-Za-z0-9][A-Za-z0-9.,:%\u2013-]*/g, (m) => (/\d/.test(m) ? `\u2066${m}\u2069` : m))
