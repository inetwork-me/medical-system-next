"use client"

import { useLocale, useTranslations } from "next-intl"

import { bi, type Bi } from "@/lib/mock/bi"
import { useDoctors } from "@/modules/doctors/store"
import { testOf, type LabPatient } from "./data"

/** Latin runs (codes, units, abbreviations) start with a Latin letter or digit. */
const isLatin = (s: string) => /^[A-Za-z0-9+<>\-–.%]/.test(s.trim())

/** Locale helpers shared by the Labs screens. */
export function useLabText() {
  const locale = useLocale()
  const t = useTranslations("labs")
  const ar = locale === "ar"
  const b = (v: Bi) => bi(v, locale)
  // Core doctors (shared entity; the roster exists even when the Doctors screens are off for the branch).
  const doctors = useDoctors()
  const doctorName = (key: string) => {
    const d = doctors.find((x) => x.key === key)
    return d ? b(d.name) : key
  }
  /** "13 y" / "5 m" — "13 سنة" / "5 شهور". */
  const age = (p: Pick<LabPatient, "ageMonths">) => (p.ageMonths < 24 ? t("age.months", { n: p.ageMonths }) : t("age.years", { n: Math.floor(p.ageMonths / 12) }))
  /** A test's name inside a list (lower-case words, abbreviations kept). */
  const short = (key: string) => {
    const x = testOf(key)
    if (!x) return key
    if (x.short) return b(x.short)
    const n = b(x.name)
    return ar || /[A-Z].*[A-Z0-9]/.test(n) ? n : n.toLowerCase()
  }
  /** "kidney, electrolytes, lipids" — "الكلى والأملاح والدهون" (و joins Arabic words, " و " before Latin ones). */
  const list = (items: string[]) => {
    if (!ar) return items.join(", ")
    return items.reduce((s, x, i) => (i === 0 ? x : isLatin(x) ? `${s} و ${x}` : `${s} و${x}`), "")
  }
  return { locale, ar, t, b, doctorName, age, short, list }
}
