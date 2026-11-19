"use client"

import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { Icon } from "@/components/ds/icon"
import { Widget } from "@/components/ds/widget"
import { Progress } from "@/components/ui/progress"
import { SETUP_STEPS, type SetupStep } from "./data"
import { doctorHref, type DoctorTab } from "./href"

const STEP_TAB: Record<SetupStep, DoctorTab> = { personal: "settings", licence: "settings", clinic: "settings", hours: "schedule", account: "settings" }

/**
 * Widget / New Doctor Checklist — "Before they can be booked": progress, the 5 steps (done = green tick) and the note.
 * On a doctor page (doctorKey set) the open steps link to the tab that finishes them, like the Clinics checklist.
 */
export function SetupChecklist({ done, doctorKey, className }: { done: Record<SetupStep, boolean>; doctorKey?: string; className?: string }) {
  const t = useTranslations("doctors.setup")
  const n = SETUP_STEPS.filter((k) => done[k]).length
  const total = SETUP_STEPS.length
  return (
    <Widget title={t("title")} description={t("done", { n, total })} className={cn("gap-4 p-5", className)}>
      <Progress value={(n / total) * 100} className="h-1.5" aria-label={t("done", { n, total })} />
      <ul className="flex flex-col gap-3">
        {SETUP_STEPS.map((k) => {
          const ok = done[k]
          return (
            <li key={k} className="flex items-center gap-2">
              <Icon name={ok ? "tick-circle" : "record-circle"} size={18} className={ok ? "text-success" : "text-muted-foreground"} />
              {doctorKey && !ok ? (
                <Link href={doctorHref(doctorKey, STEP_TAB[k])} className="text-sm text-primary underline-offset-2 hover:underline">
                  {t(k)}
                </Link>
              ) : (
                <span className={cn("text-sm", ok ? "text-foreground" : "text-muted-foreground")}>{t(k)}</span>
              )}
            </li>
          )
        })}
      </ul>
      <p className="flex items-start gap-2 rounded-lg bg-info-soft p-3 text-xs text-info-soft-foreground">
        <Icon name="info-circle" size={18} className="shrink-0" />
        {t("note")}
      </p>
    </Widget>
  )
}
