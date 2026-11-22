"use client"

import { useLocale, useTranslations } from "next-intl"

import { bi, type Bi } from "@/lib/mock/bi"
import { useDoctors } from "@/modules/doctors/store"
import { PATIENTS, insurerOf, type Invoice, type PatientKey } from "./data"

/** Locale helpers shared by the Billing screens. */
export function useBillText() {
  const locale = useLocale()
  const t = useTranslations("billing")
  const ar = locale === "ar"
  const b = (v: Bi) => bi(v, locale)
  // Core doctors (shared entity; the roster exists even when the Doctors screens are off for the branch).
  const doctors = useDoctors()
  const doctorName = (key: string) => {
    const d = doctors.find((x) => x.key === key)
    return d ? b(d.name) : key
  }
  const patient = (k: PatientKey) => PATIENTS[k]
  /** "Bupa Arabia" or "Cash" — who pays the rest of the invoice. */
  const payerName = (inv: Pick<Invoice, "payer">) => (inv.payer === "cash" ? t("cash") : b(insurerOf(inv.payer)?.name ?? { en: inv.payer, ar: inv.payer }))
  /** Short insurer name in sentences ("Bupa pays · 80%", "Sent to Bupa through NPHIES"). */
  const insurerShort = (id: string) => b(insurerOf(id)?.short ?? { en: id, ar: id })
  return { locale, ar, t, b, doctorName, patient, payerName, insurerShort }
}
