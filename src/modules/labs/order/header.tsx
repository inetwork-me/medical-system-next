"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { isModuleEnabled } from "@/lib/modules"
import { StatusBadge } from "@/components/ds/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useClinics } from "@/modules/clinics/store"
import { patientHref } from "@/modules/patients/href"
import { timeOf, type LabOrder } from "../data"
import { criticals, statusOf, stepper } from "../machine"
import { LabStatusBadge, PriorityChip } from "../parts"
import { useLabText } from "../text"

/**
 * Widget / Lab Order Header: avatar, patient (link to the patient file), "13 y · male · MRN · payer",
 * "LAB-no · ordered by … · clinic · time"; tags STAT · status · n critical; the 6-step stepper (Ordered → Collected →
 * Received → Resulted → Validated → Released). Wide (from 896px): labels and times under every step; compact: dots,
 * the current step's label, then "Step n of 6 · …".
 */
export function OrderHeader({ order: o }: { order: LabOrder }) {
  const t = useTranslations("labs.order")
  const ts = useTranslations("labs.step")
  const { b, age, doctorName } = useLabText()
  const clinics = useClinics()
  const steps = stepper(o)
  const nowIdx = steps.findIndex((s) => s.state === "now")
  const crit = criticals(o).length
  const clinic = clinics.find((c) => c.key === o.clinicId)
  const linked = o.patient.patientId && isModuleEnabled("patients")
  const name = b(o.patient.name)
  const sub = { age: age(o.patient), sex: t(`sex.${o.patient.sex}`), mrn: o.patient.mrn }

  return (
    <section className="@container/oh flex flex-col gap-4 rounded-xl border bg-card p-5 @4xl/oh:gap-5">
      <div className="flex flex-col gap-4 @4xl/oh:flex-row @4xl/oh:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <Avatar className="size-10 @4xl/oh:size-12">
            <AvatarFallback className="@4xl/oh:text-sm">{o.patient.initials}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-1">
            {linked ? (
              <Link href={patientHref(o.patient.patientId!)} className="w-fit rounded-sm text-lg font-semibold outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 @4xl/oh:text-xl">
                {name}
              </Link>
            ) : (
              <span className="text-lg font-semibold @4xl/oh:text-xl">{name}</span>
            )}
            <span className="text-sm text-muted-foreground tabular-nums">{o.patient.payer ? t("header.subPayer", { ...sub, payer: b(o.patient.payer) }) : t("header.sub", sub)}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {t("header.line", { no: o.no, doctor: doctorName(o.doctorId), clinic: clinic ? b(clinic.name) : "", time: timeOf(o.createdAt) })}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <PriorityChip priority={o.priority} statOnly />
          <LabStatusBadge status={statusOf(o)} />
          {crit > 0 && <StatusBadge tone="destructive">{t("header.critical", { n: crit })}</StatusBadge>}
        </div>
      </div>

      <ol className="flex">
        {steps.map((s, i) => (
          <li key={s.key} className={cn("flex min-w-0 flex-col gap-1.5", i < steps.length - 1 ? "flex-1" : "shrink-0 items-end text-end")} aria-current={s.state === "now" ? "step" : undefined}>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full",
                  s.state === "done" && "bg-success text-primary-foreground",
                  s.state === "now" && "bg-primary",
                  s.state === "todo" && "border bg-muted"
                )}
              >
                {s.state === "done" && (
                  <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
                    <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {s.state === "now" && <span className="size-2 rounded-full bg-primary-foreground" />}
              </span>
              {i < steps.length - 1 && <span className={cn("h-0.5 flex-1 rounded-full", s.state === "done" ? "bg-success" : "bg-border")} />}
            </div>
            <span className={cn("text-xs font-medium", s.state === "todo" ? "text-muted-foreground" : "text-foreground", s.state !== "now" && "hidden @4xl/oh:block")}>
              {ts(s.key)}
              <span className="sr-only">{s.state === "done" ? " ✓" : ""}</span>
            </span>
            {s.at && <span className="hidden text-xs text-muted-foreground tabular-nums @4xl/oh:block">{timeOf(s.at)}</span>}
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground @4xl/oh:hidden">
        {t("header.stepOf", { n: nowIdx === -1 ? 6 : nowIdx + 1, text: t(`header.now.${nowIdx === -1 ? "done" : steps[nowIdx].key}`) })}
      </p>
    </section>
  )
}
