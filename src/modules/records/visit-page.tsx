"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { isModuleEnabled, isTabEnabled } from "@/lib/modules"
import { pdfDocument, type PdfBlock } from "@/lib/export/pdf"
import { saveBlob } from "@/lib/export/files"
import { ActionMenu } from "@/components/ds/action-menu"
import { Icon, type IconName } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge, type StatusTone } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { PageTitle } from "@/components/shell/page-title"
import { PageContainer, PageHeader } from "@/components/shell/page"
import { Button } from "@/components/ui/button"
import { claimsHref, invoiceHref } from "@/modules/billing/href"
import { REC_NOW, USERS, icdOf, type VisitNote } from "./data"
import { VISITS_HREF, noteHref, prescriptionHref, reportHref } from "./href"
import { patientOf } from "./lookup"
import { PatientBanner } from "./note-page"
import { AddNationalityDialog } from "./nationality-dialog"
import { DocKindChip, Latin, NoteStatusBadge, RxStatusBadge, useB } from "./parts"
import { RestrictedFileDialog } from "./access-dialogs"
import { recCan, recTabs } from "./roles"
import { needsBreakGlass, noteStatus } from "./rules"
import { ME } from "./session"
import { logAccess, logAccessOnce, useDocuments, useGrants, useNotes, usePrescriptions, useRecRole } from "./store"
import { lastDigits, missingOf } from "./visit-rules"
import { VisitStatusBadge, useClinicScope, useVisitCtx } from "./visits"
import { BRANCH_NAMES, CLINICS, NATIONALITIES, PAYERS, PAYER_SHORT, VISIT_DX, mainDx, visitById, visitStatus, type IdType, type Visit } from "./visits-data"

const mins = (a: string, b: string) => Math.max(0, Math.round((new Date(`${b}:00Z`).getTime() - new Date(`${a}:00Z`).getTime()) / 60000))

/** "I10 · hypertension": the note's ICD-10 short name, or the visit's own code list. */
function useDxText() {
  const b = useB()
  const locale = useLocale()
  return (code: string) => {
    const icd = icdOf(code)
    const name = icd ? b(icd.short ?? icd.name) : VISIT_DX[code] ? b(VISIT_DX[code]) : ""
    return name ? `${code} · ${name.toLocaleLowerCase(locale === "ar" ? "ar" : "en")}` : code
  }
}

/** "National ID · ends in 482" / "Passport only" / "Not recorded". */
export function useIdText() {
  const t = useTranslations("records.visits.id")
  return (ids: { idType?: string; idNumber?: string }) => {
    if (!ids.idType || !ids.idNumber) return t("none")
    if (ids.idType === "passport") return t("passport")
    return t("endsIn", { type: t(`type.${ids.idType as IdType}`), last: lastDigits(ids.idNumber) })
  }
}

/* ------------------------------------------------------------------ cards */

function Card({ id, title, subtitle, children, className }: { id: string; title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn("flex flex-col gap-5 rounded-xl border bg-card p-4 md:p-6", className)}>
      <header className="flex flex-col gap-1">
        <h2 id={id} className="text-lg font-semibold text-foreground">
          {title}
        </h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </header>
      {children}
    </section>
  )
}

type Step = { key: "booked" | "checkedIn" | "vitals" | "doctor" | "checkedOut"; done: boolean; sub: string }

/** Widget / Rec Visit Record · How the visit went: booked → checked in → vitals → with doctor (from–to) → checked out. */
function useSteps(v: Visit): { steps: Step[]; subtitle: string } {
  const t = useTranslations("records.visit.went")
  const b = useB()
  const dates = useDates()
  const time = (iso?: string) => iso?.slice(11, 16) ?? ""
  const lab = v.clinic === "lab"
  const status = visitStatus(v)
  const steps: Step[] = [
    { key: "booked", done: true, sub: v.booked_at ? t("bookedSub", { date: dates.dayMonth(v.booked_at), via: t(`via.${v.booked_via ?? "reception"}`) }) : t("walkIn") },
    { key: "checkedIn", done: true, sub: t("checkedInSub", { time: time(v.checked_in_at) }) },
    {
      key: "vitals",
      done: !!v.vitals_at,
      sub: v.vitals_at ? t("vitalsSub", { time: time(v.vitals_at), name: b(v.vitals_by ?? { en: "", ar: "" }) }) : lab ? t("notNeeded") : t("pending"),
    },
    {
      key: "doctor",
      done: !!v.seen_from,
      sub: v.seen_from ? (v.seen_to ? t("fromTo", { from: time(v.seen_from), to: time(v.seen_to) }) : t("since", { time: time(v.seen_from) })) : t("pending"),
    },
    {
      key: "checkedOut",
      done: !!v.checked_out_at,
      sub: v.checked_out_at ? t(v.paid_by ? "checkedOutSub" : "checkedOutOnly", { time: time(v.checked_out_at) }) : status === "notCheckedOut" ? t("notOut") : t("pending"),
    },
  ]
  const end = v.checked_out_at ?? (status === "notCheckedOut" ? v.seen_to : undefined)
  const subtitle = v.seen_from
    ? end
      ? t("waitedTotal", { wait: mins(v.checked_in_at, v.seen_from), total: mins(v.checked_in_at, end) })
      : t("waited", { wait: mins(v.checked_in_at, v.seen_from) })
    : t("waiting", { wait: mins(v.checked_in_at, REC_NOW) })
  return { steps, subtitle }
}

function HowItWent({ v }: { v: Visit }) {
  const t = useTranslations("records.visit.went")
  const { steps, subtitle } = useSteps(v)
  const label = (k: Step["key"]) => (k === "doctor" && v.clinic === "lab" ? t("step.lab") : t(`step.${k}`))
  return (
    <Card id="visit-went" title={t("title")} subtitle={subtitle} className="@container/went">
      {/* Wide: a row of five steps joined by a line; narrow: a list. */}
      <ol className="hidden grid-cols-5 @lg/went:grid">
        {steps.map((s, i) => (
          <li key={s.key} className="flex min-w-0 flex-col gap-2">
            <span className="flex items-center">
              <StepDot done={s.done} />
              {i < steps.length - 1 && <span aria-hidden className={cn("mx-2 h-0.5 flex-1 rounded-full", steps[i + 1].done ? "bg-success" : "bg-border")} />}
              {i === steps.length - 1 && <span aria-hidden className={cn("ms-2 h-0.5 flex-1 rounded-full", s.done ? "bg-success" : "bg-border")} />}
            </span>
            <span className="flex flex-col gap-1 pe-2">
              <span className={cn("text-sm", s.done ? "text-foreground" : "text-muted-foreground")}>{label(s.key)}</span>
              <span className="text-xs text-muted-foreground">{s.sub}</span>
            </span>
          </li>
        ))}
      </ol>
      <ol className="flex flex-col gap-3 @lg/went:hidden">
        {steps.map((s) => (
          <li key={s.key} className="flex items-start gap-2.5">
            <StepDot done={s.done} />
            <span className="flex flex-col gap-0.5">
              <span className={cn("text-sm", s.done ? "text-foreground" : "text-muted-foreground")}>{label(s.key)}</span>
              <span className="text-xs text-muted-foreground">{s.sub}</span>
            </span>
          </li>
        ))}
      </ol>
    </Card>
  )
}

function StepDot({ done }: { done: boolean }) {
  return done ? (
    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
      <Icon name="tick-circle" size={20} />
    </span>
  ) : (
    <span aria-hidden className="inline-flex size-6 shrink-0 rounded-full border-2 border-border bg-card" />
  )
}

/** Widget / Rec Visit Record · Visit details: no., date, branch, clinic + room, doctor, type, payer, approval, diagnosis. */
function VisitDetails({ v, note }: { v: Visit; note?: VisitNote }) {
  const t = useTranslations("records.visit.details")
  const ty = useTranslations("records.visits.type")
  const b = useB()
  const dates = useDates()
  const dxText = useDxText()
  const dx = mainDx(v, note)
  const status = visitStatus(v)
  const rows: [string, React.ReactNode][] = [
    [t("no"), <Latin key="no">{v.id}</Latin>],
    [t("date"), dates.short(v.checked_in_at)],
    [t("branch"), b(BRANCH_NAMES[v.branch] ?? { en: v.branch, ar: v.branch })],
    [t("clinic"), v.room ? t("clinicRoom", { clinic: b(CLINICS[v.clinic]), room: v.room }) : b(CLINICS[v.clinic])],
    [t("doctor"), b(v.doctorName)],
    [t("type"), t("typeValue", { type: ty(v.type), how: t(v.booked_at ? "booked" : "walkIn") })],
    [t("payer"), v.payerClass ? t("payerClass", { payer: b(PAYERS[v.payer]), cls: v.payerClass }) : b(PAYERS[v.payer])],
    [t("approval"), v.approval ? <Latin key="ap">{v.approval}</Latin> : t("notNeeded")],
    [
      t("dx"),
      dx ? (
        <bdi key="dx">{dxText(dx)}</bdi>
      ) : (
        <span key="dx" className={cn(status === "checkedOut" || status === "notCheckedOut" ? "text-warning-soft-foreground" : "text-muted-foreground")}>
          {status === "checkedOut" || status === "notCheckedOut" ? t("dxMissing") : t("dxLater")}
        </span>
      ),
    ],
  ]
  return (
    <Card id="visit-details" title={t("title")} className="@container/det">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 @lg/det:grid-cols-3">
        {rows.map(([k, val]) => (
          <div key={k} className="flex min-w-0 flex-col gap-1">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="text-sm text-foreground">{val}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

type Linked = { key: string; icon: IconName; tile: string; title: React.ReactNode; sub: string; badge?: React.ReactNode; href?: string }

/** Widget / Rec Visit Record · What happened in this visit: note, orders, prescription, documents, invoice, claim. */
function WhatHappened({ v, note }: { v: Visit; note?: VisitNote }) {
  const t = useTranslations("records.visit.linked")
  const b = useB()
  const dates = useDates()
  const role = useRecRole()
  const rx = usePrescriptions().find((r) => r.encounter === v.id)
  const docs = useDocuments().filter((d) => d.encounter === v.id && d.kind !== "prescription")
  const notesOk = isTabEnabled("records", "notes") && recTabs(role).includes("notes")
  const docsOk = isTabEnabled("records", "documents") && recTabs(role).includes("documents")
  const docHref = (no: string) => reportHref(no)
  const billing = isModuleEnabled("billing")
  const items: Linked[] = []
  if (note) {
    const st = noteStatus(note)
    items.push({
      key: "note",
      icon: "note-2",
      tile: "bg-warning-soft text-warning-soft-foreground",
      title: t("note"),
      sub: note.signedAt ? t("noteSigned", { time: note.signedAt.slice(11, 16), date: dates.dayMonth(note.signedAt) }) : st === "overdue" ? t("noteOverdue") : t("noteDraft"),
      badge: <NoteStatusBadge status={st} />,
      href: notesOk ? noteHref(note.id) : undefined,
    })
    if (note.orders.length) {
      const done = note.orders.filter((o) => o.status === "done")
      const lab = note.orders.filter((o) => o.status === "inLab")
      const booked = note.orders.filter((o) => o.status === "booked")
      const parts = [
        ...done.map((o) => t("orderDone", { name: b(o.short) })),
        ...(lab.length ? [t("ordersInLab", { n: lab.length })] : []),
        ...booked.map((o) => t("orderBooked", { name: b(o.short), date: b(o.detail).replace(/^\D+/, "") })),
      ]
      items.push({
        key: "orders",
        icon: "heart",
        tile: "bg-muted text-foreground",
        title: t("orders", { n: note.orders.length }),
        sub: parts.join(" · "),
        badge: lab.length ? <StatusBadge tone="info">{t("inLab", { n: lab.length })}</StatusBadge> : <StatusBadge tone="success">{t("allDone")}</StatusBadge>,
        href: notesOk ? noteHref(note.id) : undefined,
      })
    }
  }
  if (rx) {
    items.push({
      key: "rx",
      icon: "health",
      tile: "bg-accent text-primary",
      title: (
        <>
          {t("rx")} · <Latin>{rx.no}</Latin>
        </>
      ),
      sub: t(rx.sentAt ? "rxSent" : "rxNotSent", { n: rx.lines.length }),
      badge: <RxStatusBadge status={rx.status} />,
      href: notesOk ? prescriptionHref(v.id, rx.no) : undefined,
    })
  }
  for (const d of docs) {
    items.push({
      key: d.no,
      icon: "document-text",
      tile: "bg-muted text-foreground",
      title: (
        <>
          <DocKindChip kind={d.kind} className="me-1.5" />
          <Latin>{d.no}</Latin>
        </>
      ),
      sub: b(d.details),
      href: docsOk ? docHref(d.no) : undefined,
    })
  }
  if (v.invoice) {
    const inv = v.invoice
    items.push({
      key: "invoice",
      icon: "receipt-2",
      tile: "bg-muted text-foreground",
      title: (
        <>
          {t("invoice")} · <Latin>{inv.no}</Latin>
        </>
      ),
      sub: inv.insurerPct ? t("invoiceInsured", { total: inv.total, payer: b(PAYER_SHORT[v.payer]), pct: inv.insurerPct }) : t("invoiceSelf", { total: inv.total }),
      badge: <StatusBadge tone={inv.status === "paid" ? "success" : "warning"}>{t(`invoiceStatus.${inv.status}`)}</StatusBadge>,
      href: billing && isTabEnabled("billing", "invoices") ? invoiceHref(inv.opens) : undefined,
    })
  }
  if (v.claim) {
    const tone: Record<string, StatusTone> = { waiting: "info", approved: "success", rejected: "destructive" }
    items.push({
      key: "claim",
      icon: "shield-tick",
      tile: "bg-muted text-foreground",
      title: (
        <>
          {t("claim")} · <Latin>{v.claim.no}</Latin>
        </>
      ),
      sub: t("claimSent", { payer: b(PAYER_SHORT[v.payer]) }),
      badge: <StatusBadge tone={tone[v.claim.status]}>{t(`claimStatus.${v.claim.status}`)}</StatusBadge>,
      href: billing && isTabEnabled("billing", "claims") ? claimsHref() : undefined,
    })
  }
  return (
    <Card id="visit-linked" title={t("title")} subtitle={<>{t("subtitle", { no: "" })}<Latin>{v.id}</Latin></>}>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      ) : (
        <ul className="-my-1 flex flex-col">
          {items.map((it) => {
            const body = (
              <>
                <span aria-hidden className={cn("inline-flex size-9 shrink-0 items-center justify-center self-start rounded-lg", it.tile)}>
                  <Icon name={it.icon} size={20} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                  <span className="text-sm text-foreground">{it.title}</span>
                  <span className="text-xs text-muted-foreground">{it.sub}</span>
                  {it.badge}
                </span>
                {it.href && (
                  <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center text-foreground">
                    <Icon name="arrow-right-1" size={24} />
                  </span>
                )}
              </>
            )
            return (
              <li key={it.key} className="border-b last:border-b-0">
                {it.href ? (
                  <Link href={it.href} className="flex items-center gap-3 rounded-sm py-4 outline-none hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50">
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 py-4">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

/** Widget / Rec Visit Side · For official returns: nationality, ID, diagnosis, visit type, payer — each ticked or missing. */
function ForReturns({ v, note, onAdd }: { v: Visit; note?: VisitNote; onAdd?: () => void }) {
  const t = useTranslations("records.visit.returns")
  const ty = useTranslations("records.visits.type")
  const b = useB()
  const ctx = useVisitCtx()
  const idText = useIdText()
  const ids = ctx.ids(v.patient)
  const missing = missingOf(v, ctx)
  const dx = mainDx(v, note)
  const status = visitStatus(v)
  const dxDue = status === "checkedOut" || status === "notCheckedOut"
  const rows: [string, React.ReactNode, boolean][] = [
    [t("nationality"), ids.nationality ? b(NATIONALITIES[ids.nationality] ?? { en: ids.nationality, ar: ids.nationality }) : t("missing"), !!ids.nationality],
    [t("id"), idText(ids), !missing.includes("id")],
    [t("dx"), dx ? <Latin key="dx">{dx}</Latin> : dxDue ? t("missing") : t("later"), !!dx],
    [t("type"), ty(v.type), true],
    [t("payer"), v.payerClass ? t("payerClass", { payer: b(PAYER_SHORT[v.payer]), cls: v.payerClass }) : b(PAYER_SHORT[v.payer]), true],
  ]
  const gaps = missing.length
  return (
    <Card id="visit-returns" title={t("title")} subtitle={t("subtitle")}>
      <dl className="-mt-1 flex flex-col">
        {rows.map(([k, val, ok]) => (
          <div key={k} className="flex items-center gap-3 border-b py-3.5 last:border-b-0">
            <dt className="flex w-[130px] shrink-0 items-center gap-2 text-xs text-muted-foreground">
              <Icon name={ok ? "tick-circle" : "info-circle"} size={18} className={ok ? "text-success" : "text-warning"} />
              {k}
            </dt>
            <dd className={cn("min-w-0 flex-1 text-sm", ok ? "text-foreground" : "text-warning-soft-foreground")}>{val}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        {gaps === 0 ? <StatusBadge tone="success">{t("allFilled")}</StatusBadge> : <StatusBadge tone="warning">{t("missingN", { n: gaps })}</StatusBadge>}
        {onAdd && (missing.includes("nationality") || missing.includes("id")) && (
          <Button size="sm" variant="outline" className="ms-auto" onClick={onAdd}>
            {missing.includes("nationality") ? t("addNationality") : t("addId")}
          </Button>
        )}
      </div>
    </Card>
  )
}

type ActivityRow = { at: string; text: string }

/** Reception and nursing staff on the visit timeline (for the Arabic verb: "سجّلت" / "سجّل"). */
const FEMALE_STAFF = new Set(["Nora Al-Fahad", "Rawan Al-Qarni", "Amal", "Huda", "Joy"])
const staffSex = (name: { en: string }) => (FEMALE_STAFF.has(name.en) ? "f" : "m")
const doctorSex = (v: Visit) => (v.doctor && (USERS[v.doctor] as { female?: boolean }).female ? "f" : "m")

/** Widget / Rec Visit Side · Activity: who did what, with times. */
function useActivity(v: Visit): ActivityRow[] {
  const t = useTranslations("records.visit.activity")
  const b = useB()
  const dates = useDates()
  const p = patientOf(v.patient)
  const rows: ActivityRow[] = []
  if (v.booked_at) rows.push({ at: dates.dayMonth(v.booked_at), text: t(`booked.${v.booked_via ?? "reception"}`) })
  if (v.checked_in_by) rows.push({ at: v.checked_in_at.slice(11, 16), text: t(`checkedIn.${staffSex(v.checked_in_by)}${p.sex}`, { name: b(v.checked_in_by) }) })
  if (v.vitals_at && v.vitals_by) rows.push({ at: v.vitals_at.slice(11, 16), text: t("vitals", { name: b(v.vitals_by) }) })
  if (v.seen_from)
    rows.push({ at: v.seen_from.slice(11, 16), text: v.clinic === "lab" ? t("samples", { name: b(v.doctorName) }) : t(`opened.${doctorSex(v)}`, { name: b(v.doctorName) }) })
  if (v.checked_out_at) rows.push({ at: v.checked_out_at.slice(11, 16), text: v.paid_by ? t("paid", { name: b(v.paid_by) }) : t("out") })
  else if (visitStatus(v) === "notCheckedOut") rows.push({ at: "", text: t("notOut") })
  return rows
}

function Activity({ v }: { v: Visit }) {
  const t = useTranslations("records.visit.activity")
  const rows = useActivity(v)
  return (
    <Card id="visit-activity" title={t("title")}>
      <ol className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <li key={i} className="flex items-start gap-3 text-xs">
            <span className="w-[62px] shrink-0 text-muted-foreground">
              <bdi>{r.at}</bdi>
            </span>
            <span className="min-w-0 flex-1 text-foreground">{r.text}</span>
          </li>
        ))}
      </ol>
    </Card>
  )
}

/* ------------------------------------------------------------------ print */

function usePrintSummary(v: Visit, note?: VisitNote) {
  const t = useTranslations("records.visit")
  const td = useTranslations("records.visit.details")
  const ty = useTranslations("records.visits.type")
  const b = useB()
  const locale = useLocale()
  const dates = useDates()
  const dxText = useDxText()
  const { steps } = useSteps(v)
  const tw = useTranslations("records.visit.went")
  const run = async () => {
    const p = patientOf(v.patient)
    const file = `${v.id}.pdf`
    try {
      const dx = mainDx(v, note)
      const blocks: PdfBlock[] = [
        { kind: "title", text: `${v.id} · ${b(p.name)}` },
        { kind: "meta", text: `${p.mrn} · ${dates.long(v.checked_in_at)} · ${b(CLINICS[v.clinic])}` },
        {
          kind: "kv",
          rows: [
            [td("doctor"), b(v.doctorName)],
            [td("type"), ty(v.type)],
            [td("payer"), b(PAYERS[v.payer])],
            [td("dx"), dx ? dxText(dx) : "—"],
          ],
        },
        { kind: "table", head: [tw("title"), ""], rows: steps.map((s) => [s.key === "doctor" && v.clinic === "lab" ? tw("step.lab") : tw(`step.${s.key}`), s.sub]) },
      ]
      saveBlob(await pdfDocument(blocks, { dir: locale === "ar" ? "rtl" : "ltr", title: file }), file)
      logAccess({ id: `ax-print-${v.id}`, at: REC_NOW, user: ME, patient: v.patient, action: "print", pages: 1, why: { en: `Visit ${v.id} summary`, ar: `ملخص الزيارة ${v.id}` }, flag: "normal" })
      toast.success(t("pdfToast"), { description: t("pdfToastText") })
    } catch {
      toast.error(t("pdfFailed"), { description: t("pdfFailedText"), retry: () => void run() })
    }
  }
  return run
}

/* ------------------------------------------------------------------ page */

/**
 * Visit (inner page of Visits): header Back · "Medical records / Visits" · "V-2611-08412 · Fahad Al-Dosari"; Print
 * summary · Open visit note. Banner; How the visit went; Visit details; What happened in this visit (→ visit note,
 * prescription, Billing invoice and claims); side For official returns + Activity (stacked below under xl). Mobile:
 * Back · "Visit" · ⋯ replaces the app bar. Opening a visit is written to the Access log; doctors only open their own
 * clinic's visits; restricted files go through break the glass.
 */
export function VisitPage() {
  const t = useTranslations("records.visit")
  const tn = useTranslations("shell.nav")
  const tt = useTranslations("shell.tabs.records")
  const b = useB()
  const role = useRecRole()
  const id = useSearchParams().get("id") ?? ""
  const v = visitById(id)
  const notes = useNotes()
  const note = v ? notes.find((n) => n.encounter === v.id) : undefined
  const scope = useClinicScope(role)
  const grants = useGrants()
  const [unlocking, setUnlocking] = React.useState(false)
  const p = v ? patientOf(v.patient) : undefined
  const allowed = recTabs(role).includes("visits") && (!scope || v?.clinic === scope)
  const blocked = !!p && !!v && needsBreakGlass(p, ME, grants[v.patient])
  React.useEffect(() => {
    if (!v || !allowed || blocked) return
    logAccessOnce({ id: `ax-open-${v.id}-${ME}`, at: REC_NOW, user: ME, patient: v.patient, action: "open", why: { en: `Visit ${v.id}`, ar: `الزيارة ${v.id}` }, flag: "normal" })
  }, [v, allowed, blocked])

  const crumbs = [
    { label: tn("records"), href: "/records" },
    { label: tt("visits"), href: VISITS_HREF },
  ]
  const back = (
    <Button variant="outline" asChild>
      <Link href={VISITS_HREF}>
        <Icon name="arrow-left" size={16} />
        {t("backToList")}
      </Link>
    </Button>
  )
  if (!v || !p) {
    return (
      <PageContainer>
        <PageTitle title={t("mobileTitle")} crumbs={crumbs} back={VISITS_HREF} />
        <div className="rounded-xl border bg-card">
          <EmptyState icon="calendar-2" title={t("notFound")} description={t("notFoundText")} className="py-16" actions={back} />
        </div>
      </PageContainer>
    )
  }
  if (!allowed) {
    return (
      <PageContainer>
        <PageTitle title={t("mobileTitle")} crumbs={crumbs} back={VISITS_HREF} />
        <div className="rounded-xl border bg-card">
          <EmptyState icon="lock" title={t("noAccess")} description={t("noAccessText")} className="py-16" actions={back} />
        </div>
      </PageContainer>
    )
  }
  if (blocked) {
    return (
      <PageContainer>
        <PageTitle title={t("mobileTitle")} crumbs={crumbs} back={VISITS_HREF} />
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon="lock"
            title={t("restrictedTitle")}
            description={t("restrictedText", { name: b(p.name) })}
            className="py-16"
            actions={
              <>
                {back}
                <Button onClick={() => setUnlocking(true)}>{t("restrictedOpen")}</Button>
              </>
            }
          />
        </div>
        {unlocking && <RestrictedFileDialog patient={v.patient} onOpenChange={setUnlocking} />}
      </PageContainer>
    )
  }

  return <VisitBody v={v} note={note} crumbs={crumbs} />
}

function VisitBody({ v, note, crumbs }: { v: Visit; note?: VisitNote; crumbs: { label: string; href: string }[] }) {
  const t = useTranslations("records.visit")
  const b = useB()
  const role = useRecRole()
  const [adding, setAdding] = React.useState(false)
  const print = usePrintSummary(v, note)
  const p = patientOf(v.patient)
  const notesOk = !!note && isTabEnabled("records", "notes") && recTabs(role).includes("notes")
  const canAdd = recCan(role, "patientIds")
  const actions = (
    <>
      <Button variant="outline" onClick={print}>
        <Icon name="printer" size={18} />
        {t("print")}
      </Button>
      {notesOk && (
        <Button asChild>
          <Link href={noteHref(note!.id)}>
            <Icon name="note-2" size={18} />
            {t("openNote")}
          </Link>
        </Button>
      )}
    </>
  )
  return (
    <>
      <PageTitle title={t("title", { no: v.id, name: b(p.name) })} crumbs={crumbs} back={VISITS_HREF} />
      <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link href={VISITS_HREF} aria-label={t("back")}>
            <Icon name="arrow-left" size={24} />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{t("mobileTitle")}</h1>
        <ActionMenu
          title={v.id}
          trigger={
            <Button variant="ghost" size="icon" aria-label={t("more")}>
              <Icon name="more" size={20} />
            </Button>
          }
          groups={[[{ key: "print", icon: "printer", label: t("print"), onSelect: print }]]}
        />
      </div>
      <PageContainer>
      <PageHeader actions={<div className="grid w-full grid-cols-2 gap-2 *:w-full md:flex md:w-auto md:*:w-auto">{actions}</div>} />
      <PatientBanner patientKey={v.patient} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start xl:gap-6">
        <div className="flex min-w-0 flex-col gap-4 xl:gap-6">
          <HowItWent v={v} />
          <VisitDetails v={v} note={note} />
          <WhatHappened v={v} note={note} />
        </div>
        <div className="flex min-w-0 flex-col gap-4 xl:gap-6">
          <ForReturns v={v} note={note} onAdd={canAdd ? () => setAdding(true) : undefined} />
          <Activity v={v} />
        </div>
      </div>
      {adding && <AddNationalityDialog patient={v.patient} onOpenChange={setAdding} />}
      </PageContainer>
    </>
  )
}
