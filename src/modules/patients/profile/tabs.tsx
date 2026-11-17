"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { IfModule } from "@/lib/modules"
import { useDates } from "@/i18n/dates"
import { Icon } from "@/components/ds/icon"
import { FilterChip } from "@/components/ds/module-controls"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge, type StatusTone } from "@/components/ds/status-badge"
import { DropZone } from "@/components/ds/upload"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FILE_GROUP, type ActivityKind, type Invoice, type PatientFile, type FileGroup, type InvoiceStatus, type VisitStatus, type When } from "./record"
import { MiniBars } from "./overview"
import { useOverlay } from "./overlays"
import { useFileDownloads, type DownloadState } from "./download"
import { Progress } from "@/components/ui/progress"
import { toMb } from "@/components/ds/upload"
import { CollectFlow, ReceiptDialog, StatementDialog } from "../payments/overlays"
import { usePatientExports } from "./exports"
import { PCard, PersonalInfo, ProfileCard } from "./side"
import { usePatient, useText } from "./use-patient"

/* ================================================================== layout */

/**
 * Tab pages: profile card + personal info in a 280px column from xl; side by side above the content on tablet;
 * on mobile the profile card is already above the tabs, so only the content shows.
 * Content switches from list (Compact) to table (Wide) at 720px of its own width.
 */
export function TabLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid items-start gap-4 md:gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
      <div className="hidden gap-4 md:grid md:grid-cols-2 xl:flex xl:flex-col xl:gap-6">
        <ProfileCard />
        <PersonalInfo />
      </div>
      <div className="@container/tab flex min-w-0 flex-col gap-4 md:gap-6">{children}</div>
    </div>
  )
}

const VISIT_TONE: Record<VisitStatus, StatusTone> = {
  upcoming: "info",
  completed: "success",
  cancelled: "destructive",
}
const INVOICE_TONE: Record<InvoiceStatus, StatusTone> = {
  pending: "warning",
  paid: "success",
  void: "neutral",
}
const ACT_TONE: Record<ActivityKind, StatusTone> = {
  added: "success",
  edited: "info",
  flagged: "warning",
}

function useWhen() {
  const t = useTranslations("patients.page.medical")
  const dates = useDates()
  return (w: When) =>
    w.kind === "since"
      ? t("since", { date: dates.monthYear(w.date) })
      : w.kind === "sinceDay"
        ? t("since", { date: dates.short(w.date) })
        : w.kind === "day"
          ? dates.short(w.date)
          : dates.monthYear(w.date)
}

function Sar({ amount, className }: { amount: number; className?: string }) {
  const t = useTranslations("patients.page")
  const { n } = useText()
  return <span className={cn("tabular-nums whitespace-nowrap", className)}>{t("sar", { amount: n(amount) })}</span>
}

/** Filter row: select + chips (one line on wide cards, stacked on compact). */
function Filters({ select, chips }: { select: React.ReactNode; chips: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 @min-[45rem]/tab:flex-row @min-[45rem]/tab:flex-wrap @min-[45rem]/tab:items-center">
      {select}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] @min-[45rem]/tab:mx-0 @min-[45rem]/tab:px-0">{chips}</div>
    </div>
  )
}

/** Table shell used by the wide layouts (header row muted, rows divided). */
function Table({ head, cols, children }: { head: React.ReactNode[]; cols: string; children: React.ReactNode }) {
  return (
    <div className="hidden overflow-hidden rounded-lg border @min-[45rem]/tab:block" role="table">
      <div role="row" className={cn("grid items-center gap-3 border-b bg-muted px-4 py-2.5 text-xs font-medium text-muted-foreground", cols)}>
        {head.map((h, i) => (
          <span key={i} role="columnheader">
            {h}
          </span>
        ))}
      </div>
      {children}
    </div>
  )
}

function TRow({ cols, className, children }: { cols: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="row" className={cn("grid items-center gap-3 border-b px-4 py-3 text-sm last:border-0", cols, className)}>
      {React.Children.map(children, (c) => (
        <div role="cell" className="min-w-0">
          {c}
        </div>
      ))}
    </div>
  )
}

/* ================================================================== visits */

const VCOLS = "grid-cols-[8.5rem_minmax(0,1fr)_12rem_6.5rem_5.5rem_2rem]"

export function VisitsTab() {
  const t = useTranslations("patients.page")
  const dates = useDates()
  const { b } = useText()
  const overlay = useOverlay()
  const [status, setStatus] = React.useState<"all" | VisitStatus>("all")
  const [clinic, setClinic] = React.useState("all")
  const data = usePatient()
  if (!data) return null
  const { patient, record } = data
  const visits = record.visits
  const clinics = [...new Map(visits.map((v) => [v.clinic.en, v.clinic])).values()]
  const shown = visits.filter((v) => (status === "all" || v.status === status) && (clinic === "all" || v.clinic.en === clinic))
  const count = (s: VisitStatus) => visits.filter((v) => v.status === s).length

  return (
    <PCard
      className="@min-[45rem]/tab:p-6"
      title={t("visits.title")}
      description={t("visits.description", {
        count: visits.length,
        date: dates.monthYear(patient.registered),
      })}
      action={
        <IfModule id="appointments">
          <Button variant="ghost" size="sm" onClick={() => overlay.open({ kind: "book" })}>
            <Icon name="calendar-add" size={16} />
            {t("visits.book")}
          </Button>
        </IfModule>
      }
    >
      <Filters
        select={
          <Select value={clinic} onValueChange={setClinic}>
            <SelectTrigger className="w-full @min-[45rem]/tab:w-50" aria-label={t("visits.allClinics")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("visits.filter")}</SelectItem>
              {clinics.map((c) => (
                <SelectItem key={c.en} value={c.en}>
                  {b(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        chips={(["all", "upcoming", "completed", "cancelled"] as const).map((s) => (
          <FilterChip key={s} selected={status === s} count={s === "all" ? visits.length : count(s)} onClick={() => setStatus(s)}>
            {s === "all" ? t("visits.all") : t(`status.${s}`)}
          </FilterChip>
        ))}
      />
      {shown.length === 0 ? (
        <EmptyState
          icon="calendar-2"
          title={visits.length ? t("visits.empty") : t("visits.description", { count: 0, date: "" })}
          description={visits.length ? t("visits.emptyText") : undefined}
        />
      ) : (
        <>
          <Table
            cols={VCOLS}
            head={[
              t("visits.date"),
              t("visits.clinic"),
              t("visits.reason"),
              t("visits.status"),
              t("visits.amount"),
              <span key="a" className="sr-only">
                {t("visits.view")}
              </span>,
            ]}
          >
            {shown.map((v) => (
              <TRow key={v.id} cols={VCOLS}>
                <div className="flex flex-col tabular-nums">
                  <span>{dates.short(v.date)}</span>
                  <span className="text-xs text-muted-foreground">{v.time}</span>
                </div>
                <div className="flex flex-col">
                  <span className="truncate font-medium">{b(v.clinic)}</span>
                  <span className="truncate text-xs text-muted-foreground">{b(v.doctor)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="truncate">{b(v.reason)}</span>
                  {v.dx && <span className="truncate text-xs text-muted-foreground">{b(v.dx)}</span>}
                </div>
                <StatusBadge tone={VISIT_TONE[v.status]}>{t(`status.${v.status}`)}</StatusBadge>
                <Sar amount={v.amount} className="font-medium" />
                <Button variant="ghost" size="icon-sm" aria-label={t("visits.view")} onClick={() => overlay.open({ kind: "visit", id: v.id })}>
                  <Icon name="eye" size={16} />
                </Button>
              </TRow>
            ))}
          </Table>
          <ul className="@min-[45rem]/tab:hidden">
            {shown.map((v) => (
              <li key={v.id} className="border-b last:border-0">
                <button
                  type="button"
                  onClick={() => overlay.open({ kind: "visit", id: v.id })}
                  className="flex w-full cursor-pointer items-start gap-3 py-3 text-start"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {b(v.clinic)} · {b(v.doctor)}
                    </span>
                    <span className="text-xs">{b(v.reason)}</span>
                    {v.dx && <span className="text-xs text-muted-foreground">{b(v.dx)}</span>}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {dates.short(v.date)} · {v.time}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Sar amount={v.amount} className="text-sm font-medium" />
                    <StatusBadge tone={VISIT_TONE[v.status]}>{t(`status.${v.status}`)}</StatusBadge>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </PCard>
  )
}

/* ================================================================== payments */

const PCOLS = "grid-cols-[7.5rem_minmax(0,1fr)_5.25rem_6rem_5.5rem_2rem]"

export function PaymentsTab() {
  const t = useTranslations("patients.page")
  const dates = useDates()
  const { b } = useText()
  const [dialog, setDialog] = React.useState<null | "collect" | "statement" | { receipt: Invoice }>(null)
  // Snapshot of the invoice being collected: the flow stays mounted for "Payment received" after the balance hits 0.
  const [collecting, setCollecting] = React.useState<{ invoice: Invoice; due: number } | null>(null)
  const data = usePatient()
  if (!data) return null
  const { patient, record, summary } = data
  const { money } = summary
  const pending = record.invoices.find((i) => i.status === "pending")
  const tiles: [string, number, boolean?][] = [
    [t("payments.billed"), money.total],
    [t("payments.covered"), money.insurance],
    [t("payments.paid"), money.paid],
    [t("payments.due"), money.due, true],
  ]
  return (
    <>
      <div className="grid grid-cols-2 gap-3 @min-[45rem]/tab:grid-cols-4 @min-[45rem]/tab:gap-4">
        {tiles.map(([label, v, warn]) => (
          <div key={label} className="flex flex-col gap-1 rounded-xl border bg-card p-4">
            <span className="text-xs text-muted-foreground">{label}</span>
            <Sar amount={v} className={cn("text-xl font-semibold", warn && v > 0 && "text-warning-soft-foreground")} />
          </div>
        ))}
      </div>
      {pending && money.due > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-warning-soft p-3.5 text-warning-soft-foreground">
          <Icon name="wallet-money" size={20} className="shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-sm font-medium">
              {t("payments.dueTitle", {
                amount: money.due,
                date: dates.dayMonth(pending.date),
              })}
            </p>
            <p className="text-xs tabular-nums">
              {t("payments.dueText", {
                covered: pending.insurance,
                invoice: pending.no,
              })}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setCollecting({ invoice: pending, due: money.due })
              setDialog("collect")
            }}
          >
            {t("payments.collect")}
          </Button>
        </div>
      )}
      <PCard
        className="@min-[45rem]/tab:p-6"
        title={t("payments.invoices")}
        description={t("payments.invoicesCount", {
          count: record.invoices.length,
          date: dates.monthYear(patient.registered),
        })}
        action={
          <Button variant="ghost" size="sm" onClick={() => setDialog("statement")}>
            <Icon name="printer" size={16} />
            {t("payments.statement")}
          </Button>
        }
      >
        {record.invoices.length > 0 && (
          <>
            <Table
              cols={PCOLS}
              head={[
                t("payments.dateInvoice"),
                t("payments.service"),
                t("payments.insurance"),
                t("payments.share"),
                t("payments.status"),
                <span key="a" className="sr-only">
                  {t("payments.receipt")}
                </span>,
              ]}
            >
              {record.invoices.map((inv) => (
                <TRow key={inv.no} cols={PCOLS}>
                  <div className="flex flex-col tabular-nums">
                    <span>{dates.short(inv.date)}</span>
                    <bdi dir="ltr" className="text-xs text-muted-foreground rtl:text-right">
                      {inv.no}
                    </bdi>
                  </div>
                  <div className="flex flex-col">
                    <span className="truncate">{b(inv.service)}</span>
                    <span className="truncate text-xs text-muted-foreground">{inv.method ? b(inv.method) : "—"}</span>
                  </div>
                  <Sar amount={inv.insurance} />
                  <Sar amount={inv.share} className="font-medium" />
                  <StatusBadge tone={INVOICE_TONE[inv.status]}>{t(`status.${inv.status}`)}</StatusBadge>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("payments.receipt")}
                    onClick={() => setDialog({ receipt: inv })}
                    disabled={inv.status === "void"}
                  >
                    <Icon name="receipt-2" size={16} />
                  </Button>
                </TRow>
              ))}
            </Table>
            <ul className="@min-[45rem]/tab:hidden">
              {record.invoices.map((inv) => (
                <li key={inv.no} className="border-b last:border-0">
                  <button
                    type="button"
                    disabled={inv.status === "void"}
                    onClick={() => setDialog({ receipt: inv })}
                    className="flex w-full cursor-pointer items-start gap-3 py-3 text-start disabled:cursor-default"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-sm font-medium">{b(inv.service)}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {dates.short(inv.date)} · {inv.method ? b(inv.method) : "—"}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {t("payments.insuranceLine", {
                          invoice: inv.no,
                          amount: inv.insurance,
                        })}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Sar amount={inv.share} className="text-sm font-medium" />
                      <StatusBadge tone={INVOICE_TONE[inv.status]}>{t(`status.${inv.status}`)}</StatusBadge>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </PCard>
      {collecting && (
        <CollectFlow
          patient={patient}
          invoice={collecting.invoice}
          due={collecting.due}
          open={dialog === "collect"}
          onOpenChange={(o) => setDialog(o ? "collect" : null)}
        />
      )}
      <StatementDialog patient={patient} record={record} open={dialog === "statement"} onOpenChange={(o) => setDialog(o ? "statement" : null)} />
      {dialog && typeof dialog === "object" && (
        <ReceiptDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          data={{
            no: dialog.receipt.no,
            date: dialog.receipt.date,
            status: dialog.receipt.status,
            method: dialog.receipt.method,
            patient,
            service: dialog.receipt.service,
            doctor: record.visits.find((v) => v.date === dialog.receipt.date)?.doctor ?? null,
            subtotal: dialog.receipt.total,
            insurance: dialog.receipt.insurance,
            paid: dialog.receipt.status === "paid" ? dialog.receipt.share : 0,
            due: dialog.receipt.status === "pending" ? Math.min(dialog.receipt.share, money.due) : 0,
          }}
        />
      )}
    </>
  )
}

/* ================================================================== medical */

const MCOLS = "grid-cols-[minmax(0,1fr)_10.5rem_8rem_7.5rem_5.5rem]"

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-muted p-4 text-center text-xs text-muted-foreground">{children}</p>
}

export function MedicalTab() {
  const t = useTranslations("patients.page")
  const dates = useDates()
  const when = useWhen()
  const { b } = useText()
  const overlay = useOverlay()
  const data = usePatient()
  if (!data) return null
  const r = data.record
  const active = r.medications.filter((m) => m.status === "active").length
  const pair = "grid gap-4 @min-[45rem]/tab:grid-cols-2 @min-[45rem]/tab:gap-6"
  const vit: [string, string][] = [
    [t("medical.weight"), r.vitals.weight ? t("medical.kg", { v: r.vitals.weight }) : "—"],
    [t("medical.height"), r.vitals.height ? t("medical.cm", { v: r.vitals.height }) : "—"],
    [t("medical.bmi"), r.vitals.bmi ? String(r.vitals.bmi) : "—"],
    [t("medical.spo2"), r.vitals.spo2 ? `${r.vitals.spo2}%` : "—"],
  ]
  const hist = r.vitals.history
  return (
    <>
      <div className={pair}>
        <PCard title={t("medical.allergies")} description={t("medical.allergiesText")}>
          {r.allergies.length ? (
            <ul className="flex flex-col gap-2">
              {r.allergies.map((a) => (
                <li
                  key={a.name.en}
                  className={cn(
                    "flex items-center gap-3 rounded-lg p-3",
                    a.severity === "severe" ? "bg-destructive-soft text-destructive-soft-foreground" : "bg-warning-soft text-warning-soft-foreground",
                  )}
                >
                  <Icon name="danger" size={20} className="shrink-0" />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium">{b(a.name)}</span>
                    <span className="text-xs">{b(a.detail)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{t("medical.noAllergies")}</Empty>
          )}
        </PCard>
        <PCard title={t("medical.diagnoses")} description="ICD-10">
          {r.diagnoses.length ? (
            <ul>
              {r.diagnoses.map((d) => (
                <li key={d.name.en} className="flex items-center gap-3 border-b py-2.5 last:border-0">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-medium">{b(d.name)}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{when(d.when)}</span>
                  </div>
                  <StatusBadge tone={d.status === "active" ? "warning" : d.status === "treated" ? "success" : "neutral"}>{t(`status.${d.status}`)}</StatusBadge>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{t("medical.noDiagnoses")}</Empty>
          )}
        </PCard>
      </div>

      <PCard
        className="@min-[45rem]/tab:p-6"
        title={t("medical.medications")}
        description={
          r.medications.length
            ? t("medical.medsCount", {
                active,
                stopped: r.medications.length - active,
              })
            : undefined
        }
        action={
          <Button variant="ghost" size="sm" onClick={() => overlay.open({ kind: "rx" })}>
            <Icon name="note-2" size={16} />
            {t("medical.prescribe")}
          </Button>
        }
      >
        {r.medications.length ? (
          <>
            <Table cols={MCOLS} head={[t("medical.medication"), t("medical.dose"), t("medical.started"), t("medical.by"), t("medical.status")]}>
              {r.medications.map((m) => (
                <TRow key={m.name.en} cols={MCOLS}>
                  <span className="font-medium">{b(m.name)}</span>
                  <span>{b(m.dose)}</span>
                  <span className="tabular-nums">{when(m.when)}</span>
                  <span className="truncate">{b(m.by)}</span>
                  <StatusBadge tone={m.status === "active" ? "success" : "destructive"}>{t(`status.${m.status}`)}</StatusBadge>
                </TRow>
              ))}
            </Table>
            <ul className="@min-[45rem]/tab:hidden">
              {r.medications.map((m) => (
                <li key={m.name.en} className="flex items-center gap-3 border-b py-2.5 last:border-0">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-medium">{b(m.name)}</span>
                    <span className="text-xs">{b(m.dose)}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {when(m.when)} · {b(m.by)}
                    </span>
                  </div>
                  <StatusBadge tone={m.status === "active" ? "success" : "destructive"}>{t(`status.${m.status}`)}</StatusBadge>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <Empty>{t("medical.noMeds")}</Empty>
        )}
      </PCard>

      <div className={pair}>
        <PCard title={t("medical.vitals")} description={hist.length ? t("medical.vitalsText", { count: hist.length }) : undefined}>
          <dl className="grid grid-cols-2 gap-2 @min-[24rem]/tab:grid-cols-4">
            {vit.map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5 rounded-lg bg-muted p-2.5">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="text-sm font-medium tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          {hist.length > 0 && (
            <MiniBars
              values={hist.map((h) => h.kg)}
              labels={hist.map((h) => dates.month(h.date))}
              vmax={Math.ceil(Math.max(...hist.map((h) => h.kg)) / 20) * 20}
              highlight={hist.length - 1}
              height={110}
              ariaLabel={hist.map((h) => `${dates.month(h.date)}: ${h.kg}`).join(", ")}
            />
          )}
        </PCard>
        <PCard
          title={t("medical.labs")}
          description={
            r.labs
              ? t("medical.labsText", {
                  date: dates.short(r.labs.date),
                  panel: b(r.labs.panel),
                })
              : undefined
          }
          action={
            r.labs && (
              <Button variant="ghost" size="sm" onClick={() => overlay.open({ kind: "viewer", file: "__labs" })}>
                <Icon name="document-download" size={16} />
                PDF
              </Button>
            )
          }
        >
          {r.labs ? (
            <ul>
              {r.labs.results.map((l) => (
                <li key={l.name.en} className="flex items-center gap-3 border-b py-2.5 last:border-0">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-medium">{b(l.name)}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{t("medical.range", { range: l.range })}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <bdi dir="ltr" className="text-sm font-medium tabular-nums">
                      {l.value}
                    </bdi>
                    <StatusBadge tone={l.flag === "normal" ? "success" : l.flag === "high" ? "warning" : "destructive"}>{t(`status.${l.flag}`)}</StatusBadge>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{t("medical.noLabs")}</Empty>
          )}
        </PCard>
      </div>
    </>
  )
}

/* ================================================================== files */

const fmtSize = (bytes: number) => (bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1e3)} KB`)

export function FilesTab() {
  const t = useTranslations("patients.page.files")
  const dates = useDates()
  const { b, locale } = useText()
  const [group, setGroup] = React.useState<"all" | FileGroup>("all")
  const overlay = useOverlay()
  const { downloads, startDownload } = useFileDownloads()
  const data = usePatient()
  if (!data) return null
  const { record, summary } = data
  const files = record.files
  const onFiles = (list: File[]) => overlay.open({ kind: "upload", files: list })

  if (!files.length) {
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState
          icon="document-text"
          title={t("emptyTitle")}
          description={t("emptyText")}
          className="py-16"
          actions={
            <Button onClick={() => overlay.open({ kind: "upload" })}>
              <Icon name="document-upload" size={20} />
              {t("upload")}
            </Button>
          }
        />
      </div>
    )
  }
  const groups: ("all" | FileGroup)[] = ["all", "lab", "imaging", "prescriptions", "documents"]
  const count = (g: "all" | FileGroup) => (g === "all" ? files.length : files.filter((f) => FILE_GROUP[f.category] === g).length)
  const shown = files.filter((f) => group === "all" || FILE_GROUP[f.category] === group)
  return (
    <>
      <DropZone onFiles={onFiles} />
      <PCard
        className="@min-[45rem]/tab:p-6"
        title={t("title")}
        description={t("count", {
          count: files.length,
          size: fmtSize(summary.filesBytes),
        })}
      >
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none]">
          {groups.map((g) => (
            <FilterChip key={g} selected={group === g} count={count(g)} onClick={() => setGroup(g)}>
              {t(g)}
            </FilterChip>
          ))}
        </div>
        <ul className="grid gap-3 @min-[45rem]/tab:grid-cols-2">
          {shown.map((f) => (
            <li key={f.name} className="flex items-center gap-3 rounded-xl border bg-card p-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
                <Icon name={f.icon} size={20} />
              </span>
              <button
                type="button"
                onClick={() => overlay.open({ kind: "viewer", file: f.name })}
                className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded-sm"
              >
                <bdi dir="ltr" className="truncate text-sm font-medium rtl:text-right">
                  {f.name}
                </bdi>
                {downloads[f.name] ? (
                  <FileDownloadLine file={f} state={downloads[f.name]} />
                ) : (
                  <>
                    {/* Design (Widget / Patient Tab · Files): EN "Category · PDF · 412 KB · date" / "Uploaded by …";
                    AR "التصنيف · التاريخ" / "PDF · 412 KB · رفعه …". */}
                    <span className="truncate text-xs text-muted-foreground tabular-nums">
                      {locale === "ar" ? (
                        <>
                          {t(`category.${f.category}`)} · {dates.short(f.date)}
                        </>
                      ) : (
                        <>
                          {t(`category.${f.category}`)} · {f.ext} · {f.size} · {dates.short(f.date)}
                        </>
                      )}
                    </span>
                    <span className="truncate text-xs text-muted-foreground tabular-nums">
                      {locale === "ar" ? (
                        <>
                          <bdi dir="ltr">
                            {f.ext} · {f.size}
                          </bdi>{" "}
                          · {t("uploadedBy", { by: b(f.by) })}
                        </>
                      ) : (
                        t("uploadedBy", { by: b(f.by) })
                      )}
                    </span>
                  </>
                )}
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("download", { name: f.name })}
                disabled={!!downloads[f.name] && !downloads[f.name].done}
                onClick={() => startDownload(f)}
              >
                <Icon
                  name={downloads[f.name]?.done ? "tick-circle" : "document-download"}
                  size={16}
                  className={downloads[f.name]?.done ? "text-success" : undefined}
                />
              </Button>
            </li>
          ))}
        </ul>
      </PCard>
    </>
  )
}

/** Download progress inside the file card (DS Upload Item pattern): bar + "x of y MB", then "Downloaded". */
function FileDownloadLine({ file, state }: { file: PatientFile; state: DownloadState }) {
  const t = useTranslations("common.upload")
  const tf = useTranslations("patients.page.files")
  const total = toMb(file.bytes)
  if (state.done) {
    return (
      <span className="text-xs text-muted-foreground tabular-nums" role="status">
        {tf("downloaded", { size: total })}
      </span>
    )
  }
  return (
    <span className="flex flex-col gap-1.5 pt-1" role="status" aria-live="polite">
      <span className="flex items-center gap-2">
        <Progress value={state.progress} aria-label={tf("downloading", { name: file.name })} className="flex-1" />
        <span className="text-xs font-medium text-muted-foreground tabular-nums">{state.progress}%</span>
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">{t("progress", { done: toMb((file.bytes * state.progress) / 100), total })}</span>
    </span>
  )
}

/* ================================================================== activity */

export function ActivityTab() {
  const t = useTranslations("patients.page")
  const dates = useDates()
  const { b } = useText()
  const exports = usePatientExports()
  const [kind, setKind] = React.useState<"all" | ActivityKind>("all")
  const [staff, setStaff] = React.useState("all")
  const data = usePatient()
  if (!data) return null
  const { patient, record } = data
  const items = record.activity
  const people = [...new Map(items.map((a) => [a.by.en, a.by])).values()]
  const shown = items.filter((a) => (kind === "all" || a.kind === kind) && (staff === "all" || a.by.en === staff))
  const days = [...new Set(shown.map((a) => a.date))]
  const count = (k: "all" | ActivityKind) => (k === "all" ? items.length : items.filter((a) => a.kind === k).length)

  return (
    <PCard
      className="@min-[45rem]/tab:p-6"
      title={t("activity.title")}
      description={t("activity.description", {
        name: b(patient.name).split(" ")[0],
      })}
      action={
        <Button variant="ghost" size="sm" loading={exports.busy} onClick={() => exports.activityCsv(patient, shown, (k) => t(`status.${k}`))}>
          {!exports.busy && <Icon name="export" size={16} />}
          {t("activity.export")}
        </Button>
      }
    >
      <Filters
        select={
          <Select value={staff} onValueChange={setStaff}>
            <SelectTrigger className="w-full @min-[45rem]/tab:w-50" aria-label={t("activity.allStaff")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("activity.filter")}</SelectItem>
              {people.map((p) => (
                <SelectItem key={p.en} value={p.en}>
                  {b(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        chips={(["all", "added", "edited", "flagged"] as const).map((k) => (
          <FilterChip key={k} selected={kind === k} count={count(k)} onClick={() => setKind(k)}>
            {k === "all" ? t("activity.all") : t(`status.${k}`)}
          </FilterChip>
        ))}
      />
      {days.map((day) => (
        <section key={day} className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-muted-foreground tabular-nums">{dates.short(day)}</h3>
          <ul className="overflow-hidden rounded-xl border">
            {shown
              .filter((a) => a.date === day)
              .map((a) => (
                <li key={a.date + a.time + a.text.en} className="flex items-start gap-3 border-b px-4 py-3 last:border-0">
                  <Avatar size="sm">
                    <AvatarFallback>{a.initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{b(a.by)}</span>
                      <StatusBadge tone={ACT_TONE[a.kind]}>{t(`status.${a.kind}`)}</StatusBadge>
                    </div>
                    <p className="text-xs">{b(a.text)}</p>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">{a.time}</span>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </PCard>
  )
}
