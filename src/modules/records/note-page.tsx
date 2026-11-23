"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { Link, useRouter } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { ActionMenu } from "@/components/ds/action-menu"
import { Field } from "@/components/ds/field"
import { Icon, type IconName } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { PageTitle } from "@/components/shell/page-title"
import { MobileActionBar, PageContainer, PageHeader } from "@/components/shell/page"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  CURRENT_MEDS,
  PAST_VISITS,
  PROBLEMS,
  REC_NOW,
  USERS,
  drugLabel,
  drugOf,
  icdOf,
  type FollowUp,
  type Order,
  type OrderKind,
  type Outcome,
  type RecPatient,
  type VisitNote,
  type Vitals,
} from "./data"
import { NOTES_HREF, prescriptionHref, reportHref } from "./href"
import { ReferralDialog, SickLeaveDialog, draftReportFrom } from "./doc-dialogs"
import { patientOf } from "./lookup"
import { AddDiagnosisDialog, AddendumDialog, SignNoteDialog } from "./note-dialogs"
import { InitialsAvatar, Latin, OrderStatusBadge, PatientName, Strip, useB, useSoon } from "./parts"
import { recCan } from "./roles"
import { canAddendum, canEditNote, needsBreakGlass, noteStatus, removeDiagnosis, vitalTone, type VitalKey } from "./rules"
import { RestrictedFileDialog } from "./access-dialogs"
import { ME } from "./session"
import { getNote, logAccessOnce, saveNote, useAddedProblems, useEncounter, useGrants, useNote, useRecRole } from "./store"

const FOLLOW_UPS: FollowUp[] = ["none", "w1", "w2", "w4", "w4r", "m3", "asNeeded"]
const OUTCOMES: Outcome[] = ["home", "admitted", "referred", "er"]
const ORDER_ICON: Record<OrderKind, IconName> = {
  ecg: "heart",
  lab: "glass",
  imaging: "gallery",
  holter: "heart-search",
  procedure: "hospital",
}

/** The editable parts of a draft (the page keeps them until Save draft / Sign). */
type Form = {
  subjective: string
  objective: string
  followUp: FollowUp | ""
  outcome: Outcome | ""
  advice: string
}

function formOf(n: VisitNote, locale: string): Form {
  const pick = (v: { en: string; ar: string }) => (locale === "ar" ? v.ar || v.en : v.en || v.ar)
  return {
    subjective: pick(n.subjective),
    objective: pick(n.objective),
    followUp: n.followUp ?? "",
    outcome: n.outcome ?? "",
    advice: pick(n.advice),
  }
}
/** The form back onto the note (a doctor writes in one language; both sides carry what they wrote). */
function applyForm(n: VisitNote, f: Form, locale: string): Partial<VisitNote> {
  const same = (v: { en: string; ar: string }, s: string) => (locale === "ar" ? (v.ar || v.en) === s : (v.en || v.ar) === s)
  const text = (v: { en: string; ar: string }, s: string) => (same(v, s) ? v : { en: s, ar: s })
  return {
    subjective: text(n.subjective, f.subjective),
    objective: text(n.objective, f.objective),
    advice: text(n.advice, f.advice),
    followUp: f.followUp || undefined,
    outcome: f.outcome || undefined,
  }
}

/* ------------------------------------------------------------------ banner */

/**
 * Widget / Rec Banner: avatar, name (opens the patient page), "54 y · male · MRN-17654 · Bupa Arabia · class B";
 * flags: allergy (red), a risky current medicine (amber), last visit.
 */
export function PatientBanner({ patientKey }: { patientKey: string }) {
  const t = useTranslations("records.banner")
  const b = useB()
  const locale = useLocale()
  const dates = useDates()
  const p = patientOf(patientKey)
  const risky = (CURRENT_MEDS[patientKey] ?? []).filter((m) => m.risky)
  const last = PAST_VISITS[patientKey]?.[0]
  const chip = "inline-flex h-[22px] items-center rounded-full px-2.5 text-xs whitespace-nowrap"
  return (
    <section aria-label={t("label")} className="@container/ban rounded-xl border bg-card">
      <div className="flex flex-col gap-3 p-4 @2xl/ban:flex-row @2xl/ban:items-center @2xl/ban:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <InitialsAvatar initials={p.initials} size={48} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <PatientName patient={p} className="truncate text-lg font-semibold text-foreground" />
            <span className="text-xs text-muted-foreground">
              {t("sub", { age: p.age, sex: t(`sex.${p.sex}`) })} · <Latin>{p.mrn}</Latin>
              {p.insurer && <> · {b(p.insurer)}</>}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {p.allergies.map((a) => (
            <span key={a.en} className={cn(chip, "bg-destructive-soft text-destructive-soft-foreground")}>
              {t("allergy", { name: b(a) })}
            </span>
          ))}
          {risky.map((m) => {
            const d = drugOf(m.drug)
            return (
              <span key={m.drug} className={cn(chip, "bg-warning-soft text-warning-soft-foreground")}>
                {t("takes", {
                  name: d ? b(d.generic).toLocaleLowerCase(locale === "ar" ? "ar" : "en") : m.drug,
                })}
              </span>
            )
          })}
          {last && <span className={cn(chip, "border bg-card text-foreground")}>{t("lastVisit", { date: dates.dayMonth(last.date) })}</span>}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ cards */

function Card({
  title,
  subtitle,
  end,
  children,
  className,
  labelledBy,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  end?: React.ReactNode
  children?: React.ReactNode
  className?: string
  labelledBy: string
}) {
  return (
    <section aria-labelledby={labelledBy} className={cn("flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-5", className)}>
      <header className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id={labelledBy} className="text-lg font-semibold text-foreground">
            {title}
          </h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {end}
      </header>
      {children}
    </section>
  )
}

/** Vitals tiles from nursing; abnormal ones tinted (red out of range, amber borderline). */
export function VitalsCard({ v }: { v?: Vitals }) {
  const t = useTranslations("records.vitals")
  const b = useB()
  if (!v)
    return (
      <Card title={t("title")} labelledBy="rec-vitals">
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      </Card>
    )
  const tiles: [VitalKey, string, string][] = [
    ["bp", `${v.bp[0]}/${v.bp[1]}`, "mmHg"],
    ["pulse", String(v.pulse), "bpm"],
    ["temp", v.temp.toFixed(1), "°C"],
    ["spo2", String(v.spo2), "%"],
    ["weight", String(v.weight), "kg"],
    ["bmi", v.bmi.toFixed(1), ""],
  ]
  return (
    <Card
      title={t("title")}
      subtitle={t("by", {
        name: b(USERS[v.takenBy].name).split(" ")[0],
        time: v.at.slice(11, 16),
      })}
      labelledBy="rec-vitals"
    >
      <div className="@container/vit">
        <dl className="grid grid-cols-3 gap-2 @xl/vit:grid-cols-6">
          {tiles.map(([k, val, unit]) => {
            const tone = vitalTone(k, v)
            return (
              <div
                key={k}
                className={cn(
                  "flex min-w-0 flex-col gap-1 rounded-lg px-3 py-2.5",
                  tone === "destructive"
                    ? "bg-destructive-soft text-destructive-soft-foreground"
                    : tone === "warning"
                      ? "bg-warning-soft text-warning-soft-foreground"
                      : "bg-muted",
                )}
              >
                <dt className={cn("text-xs", !tone && "text-muted-foreground")}>
                  {t(`k.${k}`)}
                  {tone && <span className="sr-only"> · {t(tone === "destructive" ? "high" : "borderline")}</span>}
                </dt>
                <dd dir="ltr" className="flex items-baseline gap-1 rtl:justify-end">
                  <span className={cn("text-lg font-semibold tabular-nums", !tone && "text-foreground")}>{val}</span>
                  {unit && <span className={cn("text-xs", !tone && "text-muted-foreground")}>{unit}</span>}
                </dd>
              </div>
            )
          })}
        </dl>
      </div>
    </Card>
  )
}

function TextBlock({
  id,
  title,
  label,
  value,
  onChange,
  editable,
}: {
  id: string
  title: string
  label: string
  value: string
  onChange: (v: string) => void
  editable: boolean
}) {
  return (
    <Card title={title} labelledBy={id}>
      {editable ? (
        <Field label={label}>
          <Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
        </Field>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground">{label}</span>
          <p className="text-sm whitespace-pre-wrap text-foreground">{value || "—"}</p>
        </div>
      )}
    </Card>
  )
}

/** Diagnoses: ICD-10 list (code in blue, Main badge, remove), Add diagnosis. The first (Main) goes on the claim. */
export function DiagnosesCard({ n, editable, onAdd }: { n: VisitNote; editable: boolean; onAdd: () => void }) {
  const t = useTranslations("records.note")
  const td = useTranslations("records.addDiagnosis")
  const tr = useTranslations("records.removed")
  const b = useB()
  const remove = (code: string) => {
    const cur = getNote(n.id)
    if (!cur) return
    saveNote(removeDiagnosis(cur, code))
    toast.info(tr("toast"), { description: tr("toastText") })
  }
  return (
    <Card
      title={t("diagnoses")}
      subtitle={t("diagnosesText")}
      labelledBy="rec-dx"
      end={
        editable && (
          <Button variant="ghost" size="sm" onClick={onAdd}>
            <Icon name="add" size={18} />
            {t("addDiagnosis")}
          </Button>
        )
      }
    >
      {n.diagnoses.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noDiagnoses")}</p>
      ) : (
        <ul className="rounded-lg border">
          {n.diagnoses.map((d) => {
            const icd = icdOf(d.code)
            return (
              <li key={d.code} className="flex min-h-12 items-center gap-3 border-b px-3 py-2 last:border-b-0">
                <Latin className="w-16 shrink-0 text-sm text-primary">{d.code}</Latin>
                <span className="min-w-0 flex-1 text-sm text-foreground">{icd ? b(icd.name) : d.code}</span>
                {d.type === "main" && <StatusBadge tone="info">{td("types.main")}</StatusBadge>}
                {d.type === "suspected" && <StatusBadge tone="neutral">{td("types.suspected")}</StatusBadge>}
                {editable && (
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => remove(d.code)} aria-label={t("removeDiagnosis", { code: d.code })}>
                    <Icon name="trash" size={20} />
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function OrderRow({ o }: { o: Order }) {
  const b = useB()
  return (
    <li className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
      <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
        <Icon name={ORDER_ICON[o.kind]} size={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm text-foreground">{b(o.name)}</span>
        <span className="text-xs text-muted-foreground">{b(o.detail)}</span>
      </span>
      <OrderStatusBadge status={o.status} />
    </li>
  )
}

/** Plan: orders with status, medicines (Edit prescription), follow-up, visit outcome, advice for the patient. */
function PlanCard({
  n,
  form,
  set,
  editable,
  onPrescription,
}: {
  n: VisitNote
  form: Form
  set: (p: Partial<Form>) => void
  editable: boolean
  onPrescription?: () => void
}) {
  const t = useTranslations("records.note")
  const b = useB()
  const locale = useLocale()
  const label = "text-xs font-medium text-foreground"
  return (
    <Card title={t("plan")} subtitle={t("planText")} labelledBy="rec-plan">
      <div className="flex flex-col gap-2">
        <span className={label}>{t("orders")}</span>
        {n.orders.length ? (
          <ul className="rounded-lg border">
            {n.orders.map((o) => (
              <OrderRow key={o.id} o={o} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noOrders")}</p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <span className={label}>{t("medicines")}</span>
        {n.medicines.length ? (
          <ul className="rounded-lg border">
            {n.medicines.map((m) => {
              const d = drugOf(m.drug)
              return (
                <li key={m.drug} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
                  <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                    <Icon name="health" size={20} />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm text-foreground">{d ? drugLabel(d, locale) : m.drug}</span>
                    <span className="text-xs text-muted-foreground">
                      {b(m.sig)}
                      {m.isNew && <> · {t("new")}</>}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noMedicines")}</p>
        )}
        {editable && onPrescription && (
          <Button variant="outline" onClick={onPrescription}>
            <Icon name="health" size={20} />
            {t(n.medicines.length ? "editPrescription" : "addPrescription")}
          </Button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("followUp")}>
          {(fp) =>
            editable ? (
              <Select value={form.followUp} onValueChange={(v) => set({ followUp: v as FollowUp })}>
                <SelectTrigger {...fp} className="w-full">
                  <SelectValue placeholder={t("pick")} />
                </SelectTrigger>
                <SelectContent>
                  {FOLLOW_UPS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {t(`followUps.${f}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p id={fp.id} className="text-sm text-foreground">
                {form.followUp ? t(`followUps.${form.followUp}`) : "—"}
              </p>
            )
          }
        </Field>
        <Field label={t("outcome")}>
          {(fp) =>
            editable ? (
              <Select value={form.outcome} onValueChange={(v) => set({ outcome: v as Outcome })}>
                <SelectTrigger {...fp} className="w-full">
                  <SelectValue placeholder={t("pick")} />
                </SelectTrigger>
                <SelectContent>
                  {OUTCOMES.map((o) => (
                    <SelectItem key={o} value={o}>
                      {t(`outcomes.${o}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p id={fp.id} className="text-sm text-foreground">
                {form.outcome ? t(`outcomes.${form.outcome}`) : "—"}
              </p>
            )
          }
        </Field>
      </div>
      {editable ? (
        <Field label={t("advice")}>
          <Textarea rows={3} value={form.advice} onChange={(e) => set({ advice: e.target.value })} />
        </Field>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className={label}>{t("advice")}</span>
          <p className="text-sm whitespace-pre-wrap text-foreground">{form.advice || "—"}</p>
        </div>
      )}
    </Card>
  )
}

/** Addenda under a signed note: who, when, why and what (the signed text above never changes). */
function AddendaCard({ n }: { n: VisitNote }) {
  const t = useTranslations("records.note")
  const ta = useTranslations("records.addendum")
  const b = useB()
  const dates = useDates()
  if (!n.addenda.length) return null
  return (
    <Card title={t("addenda")} labelledBy="rec-addenda">
      <ul className="flex flex-col gap-3">
        {n.addenda.map((a, i) => (
          <li key={i} className="flex flex-col gap-1 rounded-lg border-s-2 border-info bg-info-soft/40 px-3 py-2">
            <span className="text-xs text-muted-foreground">
              {b(USERS[a.by].name)} · {dates.dayMonth(a.at)} <span className="tabular-nums">{a.at.slice(11, 16)}</span> · {ta(`reasons.${a.why}`)}
            </span>
            <p className="text-sm whitespace-pre-wrap text-foreground">{b(a.text)}</p>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* ------------------------------------------------------------------ side */

function KvList({ rows }: { rows: [React.ReactNode, React.ReactNode, string?][] }) {
  return (
    <dl className="flex flex-col">
      {rows.map(([k, v, cls], i) => (
        <div key={i} className="flex items-start gap-3 border-b py-3 last:border-b-0">
          <dt className="w-[130px] shrink-0 pt-0.5 text-xs text-muted-foreground">{k}</dt>
          <dd className={cn("min-w-0 flex-1 text-sm text-foreground", cls)}>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Side: Create for this visit (Prescription · Sick leave · Referral · Medical report). */
export function CreateCard({ onCreate }: { onCreate: (what: "prescription" | "sickLeave" | "referral" | "report") => void }) {
  const t = useTranslations("records.note")
  const items: ["prescription" | "sickLeave" | "referral" | "report", IconName][] = [
    ["prescription", "health"],
    ["sickLeave", "calendar-edit"],
    ["referral", "arrow-swap-horizontal"],
    ["report", "document-text"],
  ]
  return (
    <Card title={t("create")} labelledBy="rec-create">
      <div className="flex flex-col gap-2">
        {items.map(([k, icon]) => (
          <button
            key={k}
            type="button"
            onClick={() => onCreate(k)}
            className="flex h-12 items-center gap-3 rounded-lg border bg-card px-3 text-start text-sm text-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
              <Icon name={icon} size={18} />
            </span>
            {t(`createItems.${k}`)}
          </button>
        ))}
      </div>
    </Card>
  )
}

/** Side: problem list · current medicines (risky in amber, outside pharmacies included) · past visits. */
export function RecordSide({ patientKey }: { patientKey: string }) {
  const t = useTranslations("records.note")
  const b = useB()
  const locale = useLocale()
  const dates = useDates()
  const added = useAddedProblems(patientKey)
  const problems = [...(PROBLEMS[patientKey] ?? []), ...added]
  const meds = CURRENT_MEDS[patientKey] ?? []
  const past = PAST_VISITS[patientKey] ?? []
  return (
    <>
      <Card title={t("problems")} labelledBy="rec-problems">
        {problems.length ? <KvList rows={problems.map((p) => [b(p.name), b(p.since)])} /> : <p className="text-sm text-muted-foreground">{t("noProblems")}</p>}
      </Card>
      <Card title={t("before")} labelledBy="rec-meds">
        {meds.length ? (
          <KvList
            rows={meds.map((m) => {
              const d = drugOf(m.drug)
              return [d ? drugLabel(d, locale) : m.drug, b(m.how), m.risky ? "text-warning-soft-foreground" : undefined]
            })}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t("noMeds")}</p>
        )}
      </Card>
      <Card title={t("past")} labelledBy="rec-past">
        {past.length ? (
          <ul className="flex flex-col gap-3">
            {past.map((v) => (
              <li key={v.date} className="flex gap-4 text-xs">
                <span className="w-16 shrink-0 whitespace-nowrap text-muted-foreground">{dates.dayMonth(v.date).replace(/^(\d)\b/, "0$1")}</span>
                <span className="text-foreground">{b(v.text)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noPast")}</p>
        )}
      </Card>
    </>
  )
}

/* ------------------------------------------------------------------ page */

function MobileBar({ onAdd, canAdd }: { onAdd: () => void; canAdd: boolean }) {
  const t = useTranslations("records.note")
  return (
    <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
      <Button variant="ghost" size="icon" asChild>
        <Link href={NOTES_HREF} aria-label={t("back")}>
          <Icon name="arrow-left" size={24} />
        </Link>
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{t("mobileTitle")}</h1>
      <ActionMenu
        title={t("mobileTitle")}
        trigger={
          <Button variant="ghost" size="icon" aria-label={t("more")}>
            <Icon name="more" size={20} />
          </Button>
        }
        groups={[
          [
            canAdd && {
              key: "dx",
              icon: "add",
              label: t("addDiagnosis"),
              onSelect: onAdd,
            },
            {
              key: "print",
              icon: "printer",
              label: t("print"),
              onSelect: () => window.print(),
            },
          ],
        ]}
      />
    </div>
  )
}

/**
 * Visit note (`/records/notes/note?id=VN-2611-2041`): header Back · "Medical records / Visit notes" over "Fahad
 * Al-Dosari · visit note"; actions Save draft · Sign note (signed: Add addendum). Banner; main column: Vitals, What the
 * patient says, Examination, Diagnoses, Plan (+ addenda once signed); side: Create for this visit, Problem list,
 * Before this visit, Past visits (stacked below the main column under 1120 px of content). Mobile: Back · "Visit
 * note" · ⋯ replaces the app bar, and Save draft · Sign note sit in a fixed bar. Opening the note is logged.
 */
export function VisitNotePage() {
  const t = useTranslations("records.note")
  const tn = useTranslations("shell.nav")
  const tt = useTranslations("shell.tabs.records")
  const b = useB()
  const locale = useLocale()
  const dates = useDates()
  const soon = useSoon()
  const router = useRouter()
  const role = useRecRole()
  const id = useSearchParams().get("id") ?? ""
  const n = useNote(id)
  const e = useEncounter(n?.encounter ?? "")
  const [form, setForm] = React.useState<Form | null>(n ? formOf(n, locale) : null)
  const [key, setKey] = React.useState(`${id}|${locale}|${n?.signedAt ?? ""}`)
  const [dirty, setDirty] = React.useState(false)
  const [signing, setSigning] = React.useState(false)
  const [adding, setAdding] = React.useState(false)
  const [addendum, setAddendum] = React.useState(false)
  const [doc, setDoc] = React.useState<"sickLeave" | "referral" | null>(null)
  // Another note (or the note just signed / the language switched): start from what's stored.
  const k = `${id}|${locale}|${n?.signedAt ?? ""}`
  if (n && (k !== key || !form)) {
    setKey(k)
    setForm(formOf(n, locale))
    setDirty(false)
  }

  const patientKey = e?.patient
  const grants = useGrants()
  const [unlocking, setUnlocking] = React.useState(false)
  // Restricted file outside the care team: break the glass first (Restricted file dialog).
  const blocked = !!patientKey && needsBreakGlass(patientOf(patientKey), ME, grants[patientKey])
  React.useEffect(() => {
    if (!n || !patientKey || blocked) return
    logAccessOnce({
      id: `ax-open-${n.id}-${ME}`,
      at: REC_NOW,
      user: ME,
      patient: patientKey,
      action: "open",
      why: { en: "Visit note", ar: "ملاحظة الزيارة" },
      flag: "normal",
    })
  }, [n, patientKey, blocked])

  if (!n || !e || !form) {
    return (
      <PageContainer>
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon="note-2"
            title={t("notFound")}
            description={t("notFoundText")}
            className="py-16"
            actions={
              <Button variant="outline" asChild>
                <Link href={NOTES_HREF}>
                  <Icon name="arrow-left" size={16} />
                  {t("backToList")}
                </Link>
              </Button>
            }
          />
        </div>
      </PageContainer>
    )
  }

  if (blocked) {
    return (
      <PageContainer>
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon="lock"
            title={t("restrictedTitle")}
            description={t("restrictedText", { name: b(patientOf(e.patient).name) })}
            className="py-16"
            actions={
              <>
                <Button variant="outline" asChild>
                  <Link href={NOTES_HREF}>{t("backToList")}</Link>
                </Button>
                <Button onClick={() => setUnlocking(true)}>{t("restrictedOpen")}</Button>
              </>
            }
          />
        </div>
        {unlocking && <RestrictedFileDialog patient={e.patient} onOpenChange={setUnlocking} />}
      </PageContainer>
    )
  }

  const p: RecPatient = patientOf(e.patient)
  const editable = canEditNote(n, ME) && recCan(role, "writeNote")
  const canSign = !n.signedAt && n.author === ME && recCan(role, "signNote")
  const canAdd = canAddendum(n, ME) && recCan(role, "writeNote")
  const set = (patch: Partial<Form>) => {
    setForm((f) => (f ? { ...f, ...patch } : f))
    setDirty(true)
  }
  const draft = applyForm(n, form, locale)
  const save = () => {
    const cur = getNote(n.id)
    if (!cur) return
    saveNote({ ...cur, ...draft })
    setDirty(false)
    toast.success(t("savedToast"), { description: t("savedToastText") })
  }
  const toRx = () => router.push(prescriptionHref(n.encounter))
  const create = (what: "prescription" | "sickLeave" | "referral" | "report") => {
    if (what === "prescription") return toRx()
    if (what === "report") {
      const no = draftReportFrom(n.encounter)
      return no ? router.push(reportHref(no)) : soon()
    }
    setDoc(what)
  }
  const status = noteStatus(n)

  const actions = (
    <>
      {editable && (
        <Button variant="outline" onClick={save}>
          {t("save")}
        </Button>
      )}
      {canSign && (
        <Button onClick={() => setSigning(true)}>
          <Icon name="edit-2" size={20} />
          {t("sign")}
        </Button>
      )}
      {canAdd && (
        <Button onClick={() => setAddendum(true)}>
          <Icon name="add" size={20} />
          {t("addAddendum")}
        </Button>
      )}
    </>
  )

  return (
    <>
      <PageTitle
        title={t("title", { name: b(p.name) })}
        crumbs={[
          { label: tn("records"), href: "/records" },
          { label: tt("notes"), href: NOTES_HREF },
        ]}
        back={NOTES_HREF}
      />
      <MobileBar onAdd={() => setAdding(true)} canAdd={editable} />
      <PageContainer className={cn("@container/np", (editable || canSign || canAdd) && "pb-28 md:pb-6")}>
        <PageHeader actions={<div className="hidden gap-2 md:flex">{actions}</div>} />
        <PatientBanner patientKey={e.patient} />
        {n.signedAt && (
          <Strip tone="success" icon="lock">
            {t("signedStrip", {
              name: b(USERS[n.author].name),
              date: dates.dayMonth(n.signedAt),
              time: n.signedAt.slice(11, 16),
            })}
            {status === "addendum" && <> · {t("withAddenda", { n: n.addenda.length })}</>}
          </Strip>
        )}
        {!n.signedAt && status === "overdue" && (
          <Strip tone="destructive" icon="timer-1">
            {t("overdueStrip")}
          </Strip>
        )}
        <div className="grid gap-4 @[66rem]/np:grid-cols-[minmax(0,1fr)_336px] @[66rem]/np:items-start @[66rem]/np:gap-6">
          <div className="flex min-w-0 flex-col gap-4">
            <VitalsCard v={n.vitals} />
            <TextBlock
              id="rec-subj"
              title={t("says")}
              label={t("complaint")}
              value={form.subjective}
              onChange={(v) => set({ subjective: v })}
              editable={editable}
            />
            <TextBlock
              id="rec-obj"
              title={t("exam")}
              label={t("findings")}
              value={form.objective}
              onChange={(v) => set({ objective: v })}
              editable={editable}
            />
            <DiagnosesCard n={n} editable={editable} onAdd={() => setAdding(true)} />
            <PlanCard n={n} form={form} set={set} editable={editable} onPrescription={recCan(role, "prescribe") && n.author === ME ? toRx : undefined} />
            <AddendaCard n={n} />
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            {recCan(role, "documents") && n.author === ME && <CreateCard onCreate={create} />}
            <RecordSide patientKey={e.patient} />
          </div>
        </div>
        <span className="sr-only" aria-live="polite">
          {dirty ? t("unsaved") : ""}
        </span>
      </PageContainer>
      {(editable || canSign || canAdd) && <MobileActionBar>{actions}</MobileActionBar>}
      {signing && <SignNoteDialog noteId={n.id} draft={draft} onOpenChange={setSigning} />}
      {adding && <AddDiagnosisDialog noteId={n.id} onOpenChange={setAdding} />}
      {addendum && <AddendumDialog noteId={n.id} onOpenChange={setAddendum} />}
      {doc === "sickLeave" && <SickLeaveDialog encounter={n.encounter} onOpenChange={(o) => !o && setDoc(null)} />}
      {doc === "referral" && <ReferralDialog encounter={n.encounter} onOpenChange={(o) => !o && setDoc(null)} />}
    </>
  )
}
