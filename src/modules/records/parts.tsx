"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { bi, type Bi } from "@/lib/mock/bi"
import { Link } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { isModuleEnabled } from "@/lib/modules"
import { Icon, type IconName } from "@/components/ds/icon"
import { toast } from "@/components/ds/toast"
import { patientHref } from "@/modules/patients/href"
import { StatusBadge, type StatusTone } from "@/components/ds/status-badge"
import { CHART_RED_HOURS, daysBetween, hoursBetween, icdOf, type AccessAction, type AccessFlag, type DocKind, type DocStatus, type Missing, type OrderStatus, type RequestFrom, type RequestStatus, type RecPatient, type Restriction, type RxStatus } from "./data"
import type { NoteStatus } from "./rules"

/* Shared Medical records atoms (Widgets page "Records widgets · components"): status badges, type chips, avatars. */

/** Bilingual mock text for the current locale. */
export function useB() {
  const locale = useLocale()
  return (v: Bi) => bi(v, locale)
}

/** Latin text (ICD-10 codes, MRNs, document / request / claim nos., Seha refs, phones, emails, doses) kept LTR. */
export function Latin({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={className}>
      {children}
    </bdi>
  )
}

/** A Latin run inside a translated string: a Unicode left-to-right isolate, so it never reorders in Arabic. */
export const ltrRun = (s: string) => `⁦${s}⁩`

/** Patient / staff initials (32 round, accent). */
export function InitialsAvatar({ initials, size = 32, className }: { initials: string; size?: 32 | 36 | 40 | 48; className?: string }) {
  return (
    <span
      aria-hidden
      dir="ltr"
      style={{ width: size, height: size }}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground", size === 48 && "text-sm", className)}
    >
      {initials}
    </span>
  )
}

/** Steps not built yet in this round: a "coming soon" toast (removed as each step lands). */
export function useSoon() {
  const t = useTranslations("records.soon")
  return () => toast.info(t("title"), { description: t("text") })
}

/* ------------------------------------------------------------------ durations */

/** "2 h" / "ساعتين" up to 48 h, then calendar days since `since` ("17 Nov" → "6 days" on 23 Nov). */
export function useWaitLabel() {
  const t = useTranslations("records.wait")
  return (hours: number, since?: string) =>
    hours <= 48 ? t("hours", { n: Math.max(hours, 0) }) : t("days", { n: since ? daysBetween(since) : Math.floor(hours / 24) })
}

/* ------------------------------------------------------------------ status badges */

const NOTE_TONE: Record<NoteStatus, StatusTone> = { draft: "warning", overdue: "destructive", signed: "success", addendum: "info" }
const DOC_TONE: Record<DocStatus, StatusTone> = { draft: "neutral", issued: "success", sent: "success", waiting: "info", expired: "neutral" }
const RX_TONE: Record<RxStatus, StatusTone> = { draft: "neutral", sent: "info", dispensed: "success", expired: "neutral" }
const REQUEST_TONE: Record<RequestStatus, StatusTone> = { new: "info", consent: "warning", preparing: "info", ready: "success", released: "neutral", rejected: "destructive" }
const ORDER_TONE: Record<OrderStatus, StatusTone> = { done: "success", inLab: "info", booked: "neutral" }
const FLAG_TONE: Record<AccessFlag, StatusTone> = { breakGlass: "destructive", unusual: "warning", normal: "neutral" }

/** Visit note: Draft · Overdue · Signed · Addendum; with `hours`, "Draft · 2 h" (Notes to sign). */
export function NoteStatusBadge({ status, hours, className }: { status: NoteStatus; hours?: number; className?: string }) {
  const t = useTranslations("records.status.note")
  const wait = useWaitLabel()
  return (
    <StatusBadge tone={NOTE_TONE[status]} className={className}>
      {hours === undefined ? t(status) : `${t(status)} · ${wait(hours)}`}
    </StatusBadge>
  )
}

export function DocStatusBadge({ status, className }: { status: DocStatus; className?: string }) {
  const t = useTranslations("records.status.doc")
  return (
    <StatusBadge tone={DOC_TONE[status]} className={className}>
      {t(status)}
    </StatusBadge>
  )
}

/** Prescription dispensing (comes back from the pharmacy link). */
export function RxStatusBadge({ status, className }: { status: RxStatus; className?: string }) {
  const t = useTranslations("records.status.rx")
  return (
    <StatusBadge tone={RX_TONE[status]} className={className}>
      {t(status)}
    </StatusBadge>
  )
}

export function RequestStatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  const t = useTranslations("records.status.request")
  return (
    <StatusBadge tone={REQUEST_TONE[status]} className={className}>
      {t(status)}
    </StatusBadge>
  )
}

/** Plan › Orders: Done · In lab · Booked. */
export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const t = useTranslations("records.status.order")
  return (
    <StatusBadge tone={ORDER_TONE[status]} className={className}>
      {t(status)}
    </StatusBadge>
  )
}

/** Access log: Break the glass (red) · Unusual (amber) · Normal. */
export function FlagBadge({ flag, className }: { flag: AccessFlag; className?: string }) {
  const t = useTranslations("records.status.flag")
  return (
    <StatusBadge tone={FLAG_TONE[flag]} className={className}>
      {t(flag)}
    </StatusBadge>
  )
}

/** Chart completion "Waiting" since the visit: amber, red over 48 h. */
export function WaitingBadge({ since, className }: { since: string; className?: string }) {
  const wait = useWaitLabel()
  const hours = hoursBetween(since)
  return (
    <StatusBadge tone={hours > CHART_RED_HOURS ? "destructive" : "warning"} className={className}>
      {wait(hours, since)}
    </StatusBadge>
  )
}

/* ------------------------------------------------------------------ chips */

const chip = "inline-flex h-[22px] w-fit shrink-0 items-center rounded-full px-2.5 text-xs leading-4 whitespace-nowrap"
const DOC_CHIP: Record<DocKind, string> = {
  prescription: "bg-accent text-primary",
  report: "bg-accent text-primary",
  sickLeave: "bg-warning-soft text-warning-soft-foreground",
  referral: "border bg-card text-foreground",
  discharge: "border bg-card text-foreground",
}

/** Documents › Type: Prescription · Medical report (blue) · Sick leave (amber) · Referral · Discharge summary. */
export function DocKindChip({ kind, className }: { kind: DocKind; className?: string }) {
  const t = useTranslations("records.kind")
  return <span className={cn(chip, DOC_CHIP[kind], className)}>{t(kind)}</span>
}

/** Requests › From: Patient · Insurer · Hospital (outline) · Court (blue). */
export function FromChip({ from, className }: { from: RequestFrom; className?: string }) {
  const t = useTranslations("records.from")
  return <span className={cn(chip, from === "court" ? "bg-accent text-primary" : "border bg-card text-foreground", className)}>{t(from)}</span>
}

/** "· restricted" after the MRN (VIP, staff and sensitive files). */
export function RestrictedMark({ kind, className }: { kind?: Restriction; className?: string }) {
  const t = useTranslations("records")
  if (!kind) return null
  return <span className={className}>{t("restricted")}</span>
}

/** "I10 · Hypertension" (lists use the short name; `full` for the note): the code stays Latin. */
export function DiagnosisLabel({ code, full, className, codeClassName }: { code: string; full?: boolean; className?: string; codeClassName?: string }) {
  const b = useB()
  const icd = icdOf(code)
  return (
    <span className={className}>
      <Latin className={codeClassName}>{code}</Latin>
      {icd && <> · {b((!full && icd.short) || icd.name)}</>}
    </span>
  )
}

/** Access log › Did ("Opened file", "Printed 18 pages", "Exported results", "Break the glass"). */
export function useDidLabel() {
  const t = useTranslations("records.did")
  return (a: AccessAction, pages?: number) => (a === "print" && pages ? t("printPages", { n: pages }) : t(a))
}

/** Chart completion › What's missing. */
export function useMissingLabel() {
  const t = useTranslations("records.missing")
  return (m: Missing) => t(m)
}

/* ------------------------------------------------------------------ dialog atoms */

/** Info / warning / error strip inside dialogs and cards (never a toast for a validation error). */
export function Strip({ tone, icon, children, className }: { tone: "info" | "success" | "warning" | "destructive"; icon: IconName; children: React.ReactNode; className?: string }) {
  return (
    <p
      role={tone === "warning" || tone === "destructive" ? "alert" : undefined}
      className={cn(
        "flex items-start gap-2 rounded-lg p-3 text-xs",
        tone === "info" && "bg-info-soft text-info-soft-foreground",
        tone === "success" && "bg-success-soft text-success-soft-foreground",
        tone === "warning" && "bg-warning-soft text-warning-soft-foreground",
        tone === "destructive" && "bg-destructive-soft text-destructive-soft-foreground",
        className
      )}
    >
      <Icon name={icon} size={18} className="shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
    </p>
  )
}

/** Bordered label / value box (dialog summaries). */
export function KvBox({ rows }: { rows: [React.ReactNode, React.ReactNode][] }) {
  return (
    <div className="rounded-lg border px-3">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex items-start gap-3 border-b py-2.5 last:border-b-0">
          <span className="w-[140px] shrink-0 pt-px text-xs text-muted-foreground max-sm:w-[130px]">{k}</span>
          <span className="min-w-0 flex-1 text-sm text-foreground">{v}</span>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ patient */

/** The patient's name; opens the patient page when the patient exists in the Patients module (and it's on). */
export function PatientName({ patient, className }: { patient: RecPatient; className?: string }) {
  const b = useB()
  const linked = patient.patientId && isModuleEnabled("patients")
  if (!linked) return <span className={className}>{b(patient.name)}</span>
  return (
    <Link href={patientHref(patient.patientId!)} className={cn("rounded-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50", className)}>
      {b(patient.name)}
    </Link>
  )
}

/** "Today 09:40" / "Yesterday 16:10" / "22 Nov 16:10" relative to the demo clock. */
export function useWhen() {
  const t = useTranslations("records.when")
  const dates = useDates()
  return (iso: string, opts?: { time?: boolean }) => {
    const d = daysBetween(iso)
    const time = iso.slice(11, 16)
    const day = d === 0 ? t("today") : d === 1 ? t("yesterday") : dates.dayMonth(iso)
    return opts?.time === false ? day : t("at", { day, time })
  }
}

/**
 * Show more: the next 20 rows go below the ones already shown (the page doesn't move) and the counter follows.
 * Starts over when the filter or the search changes (`reset`). → `more-loaded`.
 */
export const SHOW_MORE_STEP = 20
export function useShowMore(reset: string) {
  const t = useTranslations("records.showMore")
  const [extra, setExtra] = React.useState(0)
  const [key, setKey] = React.useState(reset)
  if (key !== reset) {
    setKey(reset)
    setExtra(0)
  }
  const more = (left: number) => {
    const n = Math.min(SHOW_MORE_STEP, left)
    if (n <= 0) return
    setExtra((e) => e + SHOW_MORE_STEP)
    toast.info(t("toast", { n }), { description: t("toastText") })
  }
  return { extra, more }
}
