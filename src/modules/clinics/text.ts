"use client"

import { useLocale, useTranslations } from "next-intl"

import { bi, type Bi } from "@/lib/mock/bi"
import { useDates } from "@/i18n/dates"
import { CHECKLIST, checklistOf, isSettingUp, type Clinic } from "./data"

/** "22:00" → "10 PM" / "10 م"; minutes only when not on the hour ("1:30 PM"). */
export function clock12(hhmm: string, locale: string) {
  const [h, m] = hhmm.split(":").map(Number)
  const hour = h % 12 || 12
  const time = m ? `${hour}:${String(m).padStart(2, "0")}` : String(hour)
  return `${time} ${locale === "ar" ? (h < 12 ? "ص" : "م") : h < 12 ? "AM" : "PM"}`
}

/** Locale helpers shared by the Clinics screens. */
export function useClinicText() {
  const locale = useLocale()
  const t = useTranslations("clinics")
  const tc = useTranslations("clinics.checklist")
  const dates = useDates()
  const b = (v: Bi) => bi(v, locale)
  return {
    locale,
    t,
    dates,
    b,
    /** "11 min" / "11 د" */
    min: (n: number) => t("min", { n }),
    /** "Floor 1 · Wing A" */
    place: (c: Clinic) => (c.floor ? t("place", { floor: c.floor, wing: c.wing }) : bi(c.branch, locale)),
    /** "Open · until 10 PM" · "Busy · long wait" · "Paused · back 20 Nov" */
    status: (c: Clinic) =>
      isSettingUp(c)
        ? tc("setup", { n: Object.values(checklistOf(c)).filter(Boolean).length, total: CHECKLIST.length })
        : c.status === "paused"
        ? t("status.paused", { date: c.pausedUntil ? dates.dayMonth(c.pausedUntil) : "" })
        : c.status === "busy"
          ? t("status.busy")
          : t("status.open", { time: clock12(c.closesAt, locale) }),
  }
}

export const STATUS_TONE = { open: "success", busy: "warning", paused: "neutral" } as const
/** Status badge tone (a clinic still setting up shows neutral). */
export const statusTone = (c: Clinic) => (isSettingUp(c) ? "neutral" : STATUS_TONE[c.status])
