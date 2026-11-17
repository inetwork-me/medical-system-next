"use client"

import { usePatientId } from "@/modules/patients/href"
import * as React from "react"
import { useTranslations } from "next-intl"

import { useDates } from "@/i18n/dates"
import { useIsMobile } from "@/hooks/use-media-query"
import { Icon } from "@/components/ds/icon"
import { notify } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { usePatient, useText } from "../profile/use-patient"
import { printArea } from "../payments/overlays"
import { markChartSaved } from "./dental-store"

/**
 * Prints only the given area (the page's other print areas are switched off for this print), e.g. "Print advice
 * for the patient" prints just the gum health card.
 */
export function printOnly(el: HTMLElement | null) {
  if (!el) return
  const others = [...document.querySelectorAll<HTMLElement>("[data-print-area]")].filter((x) => x !== el)
  others.forEach((o) => o.removeAttribute("data-print-area"))
  const had = el.hasAttribute("data-print-area")
  el.setAttribute("data-print-area", "")
  const restore = () => {
    others.forEach((o) => o.setAttribute("data-print-area", ""))
    if (!had) el.removeAttribute("data-print-area")
    window.removeEventListener("afterprint", restore)
  }
  window.addEventListener("afterprint", restore)
  printArea()
}

/** Dental workspace bar actions: Print (icon on tablet) + Save chart ("Save" on tablet). Hidden on phones (view-only). */
export function DentalActions() {
  const t = useTranslations("specialties.chartWs")
  const id = usePatientId()
  const mobile = useIsMobile()
  const data = usePatient()
  const { b } = useText()
  const dates = useDates()
  if (mobile) return null
  const save = () => {
    markChartSaved(id)
    notify.success(t("saved"), { description: data ? `${b(data.patient.name)} · ${dates.short(new Date())}` : undefined })
  }
  return (
    <>
      <Button variant="outline" size="icon" onClick={printArea} aria-label={t("print")} className="xl:hidden">
        <Icon name="printer" size={20} />
      </Button>
      <Button variant="outline" onClick={printArea} className="max-xl:hidden">
        <Icon name="printer" size={20} />
        {t("print")}
      </Button>
      <Button onClick={save}>
        <Icon name="tick-circle" size={20} />
        <span className="xl:hidden">{t("saveShort")}</span>
        <span className="max-xl:hidden">{t("save")}</span>
      </Button>
    </>
  )
}
