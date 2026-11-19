"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "@/components/ds/toast"

import { cn } from "@/lib/utils"
import type { Bi } from "@/lib/mock/bi"
import { parseDay, useDates } from "@/i18n/dates"
import { useIsMobile } from "@/hooks/use-media-query"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { Combobox } from "@/components/ds/pickers"
import { RadioOption } from "@/components/ds/radio-option"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Segmented } from "@/components/ds/segmented"
import { StatusBadge } from "@/components/ds/status-badge"
import { DropZone, UploadItem, toMb } from "@/components/ds/upload"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { RadioGroup } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { TODAY, type Patient } from "../data"
import { printArea } from "../payments/overlays"
import { save } from "./download"
import { usePatientsStore } from "../store"
import { type Appointment, type FileCategory, type PatientFile, type PatientRecord, type Visit } from "./record"
import { usePatient, useText } from "./use-patient"

/**
 * Patient page overlays (Overlays · Visits & appointments / Files & messages / Forms): one controller in the patient
 * frame, opened from anywhere on the page with useOverlay().open(…). Desktop/tablet = centred dialog (visit = end drawer),
 * mobile = bottom sheet. Each confirm writes to the session store so the page updates.
 */

export type OverlayKind =
  | { kind: "note" }
  | { kind: "visit"; id: string }
  | { kind: "reschedule"; date: string }
  | { kind: "cancel"; date: string }
  | { kind: "book" }
  | { kind: "rx" }
  | { kind: "upload"; files?: File[] }
  | { kind: "viewer"; file: string }
  | { kind: "sms" }

const OverlayCtx = React.createContext<{ open: (o: OverlayKind) => void }>({ open: () => {} })
export const useOverlay = () => React.useContext(OverlayCtx)

export function OverlayProvider({ children, initial }: { children: React.ReactNode; initial?: OverlayKind | null }) {
  const [current, setCurrent] = React.useState<OverlayKind | null>(initial ?? null)
  const data = usePatient()
  const value = React.useMemo(() => ({ open: (o: OverlayKind) => setCurrent(o) }), [])
  const close = () => setCurrent(null)
  const p = data?.patient
  const r = data?.record
  return (
    <OverlayCtx.Provider value={value}>
      {children}
      {p && r && current && (
        <>
          {current.kind === "note" && <AddNote patient={p} record={r} onClose={close} />}
          {current.kind === "visit" && <VisitDrawer patient={p} record={r} id={current.id} onClose={close} open={setCurrent} />}
          {current.kind === "reschedule" && <Reschedule patient={p} record={r} date={current.date} onClose={close} />}
          {current.kind === "cancel" && <CancelAppt patient={p} record={r} date={current.date} onClose={close} />}
          {current.kind === "book" && <BookVisit patient={p} record={r} onClose={close} />}
          {current.kind === "rx" && <Prescribe patient={p} record={r} onClose={close} />}
          {current.kind === "upload" && <Upload patient={p} initial={current.files} onClose={close} />}
          {current.kind === "viewer" && <Viewer record={r} name={current.file} onClose={close} />}
          {current.kind === "sms" && <Sms patient={p} record={r} onClose={close} />}
        </>
      )}
    </OverlayCtx.Provider>
  )
}

/* ================================================================== shared bits */

function KV({ rows, className }: { rows: [string, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cn("shrink-0 overflow-hidden rounded-lg bg-muted", className)}>
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-start gap-3 border-b border-border px-3 py-2.5 text-xs last:border-0">
          <dt className="flex-1 text-muted-foreground">{k}</dt>
          <dd className="max-w-[60%] text-end font-medium tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function Cancel({ onClick, label }: { onClick: () => void; label?: string }) {
  const t = useTranslations("patients.ov")
  return (
    <Button variant="outline" onClick={onClick}>
      {label ?? t("cancel")}
    </Button>
  )
}

const now = () => new Date().toTimeString().slice(0, 5)
const SESSION_DOCTOR: Bi = { en: "Dr. Khaled Mansour", ar: "د. خالد منصور" }
const act = (text: Bi, kind: "added" | "edited" = "added") => ({ date: TODAY, time: now(), initials: "KM", by: SESSION_DOCTOR, kind, text })

/** "Wed 18 Nov" / "الأربعاء 18 نوفمبر" */
function useDay() {
  const { locale } = useText()
  return (iso: string) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en-GB", {
      weekday: locale === "ar" ? "long" : "short",
      day: "numeric",
      month: "short",
      numberingSystem: "latn",
      timeZone: "UTC",
    })
      .format(new Date(`${iso}T12:00:00Z`))
      .replace(/[,،]/, "")
      .replace(/\bSept\b/, "Sep")
}

/* ================================================================== day + time picker (book, reschedule) */

const SLOTS = ["08:30", "09:00", "09:30", "10:00", "10:20", "10:40", "11:00", "11:30", "16:00", "16:30"]
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
/** Some slots are taken (deterministic per day), plus the patient's own appointments. */
const takenSlots = (day: string, appts: Appointment[]) =>
  new Set([...SLOTS.filter((s) => hash(day + s) % 4 === 0), ...appts.filter((a) => a.date === day && a.time).map((a) => a.time!)])

function SlotPicker({
  day,
  setDay,
  time,
  setTime,
  appts,
  heading,
  children,
}: {
  day: string | null
  setDay: (d: string | null) => void
  time: string | null
  setTime: (t: string | null) => void
  appts: Appointment[]
  heading: React.ReactNode
  children?: React.ReactNode
}) {
  const t = useTranslations("patients.ov")
  const taken = day ? takenSlots(day, appts) : new Set<string>()
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      <div className="rounded-lg border p-2 md:w-72 md:shrink-0">
        <Calendar
          mode="single"
          selected={day ? parseDay(day) : undefined}
          onSelect={(d) => {
            setDay(d ? iso(d) : null)
            setTime(null)
          }}
          defaultMonth={day ? parseDay(day) : parseDay(TODAY)}
          disabled={[{ before: new Date(`${TODAY}T00:00:00`) }, { dayOfWeek: [5, 6] }]}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="text-sm font-medium">{day ? heading : t("book.pickDay")}</p>
        {day && (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={typeof heading === "string" ? heading : undefined}>
            {SLOTS.map((s) => {
              const off = taken.has(s)
              const on = s === time
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={off}
                  onClick={() => setTime(s)}
                  className={cn(
                    "h-8 cursor-pointer rounded-md border px-3 text-xs font-medium tabular-nums outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-45",
                    on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                  )}
                >
                  {s}
                </button>
              )
            })}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

/* ================================================================== add note */

function AddNote({ patient, record, onClose }: { patient: Patient; record: PatientRecord; onClose: () => void }) {
  const t = useTranslations("patients.ov.note")
  const { b } = useText()
  const dates = useDates()
  const { change } = usePatientsStore()
  const done = record.visits.filter((v) => v.status === "completed")
  const [type, setType] = React.useState<"clinical" | "nursing" | "followup">("clinical")
  const [visit, setVisit] = React.useState(done[0]?.id ?? "none")
  const [text, setText] = React.useState("")
  const [shared, setShared] = React.useState(true)
  const [tried, setTried] = React.useState(false)
  const save = () => {
    setTried(true)
    if (!text.trim()) return
    const titleBi: Record<typeof type, Bi> = {
      clinical: { en: "Clinical note", ar: "ملاحظة طبية" },
      nursing: { en: "Nursing note", ar: "ملاحظة تمريض" },
      followup: { en: "Follow-up note", ar: "ملاحظة متابعة" },
    }
    change(patient.id, (c) => ({
      ...c,
      notes: [{ title: titleBi[type], by: SESSION_DOCTOR, date: TODAY, body: { en: text.trim(), ar: text.trim() } }, ...c.notes],
      activity: [act({ en: `Note: ${titleBi[type].en}`, ar: `ملاحظة: ${titleBi[type].ar}` }), ...c.activity],
    }))
    onClose()
    toast.success(t("saved"), { description: t("savedText", { name: b(patient.name) }) })
  }
  return (
    <ResponsiveDialog
      open
      onOpenChange={(o) => !o && onClose()}
      icon="note-2"
      width="sm:max-w-130"
      title={t("title")}
      description={`${b(patient.name)} · MRN ${patient.mrn}`}
      secondary={<Cancel onClick={onClose} />}
      primary={
        <Button onClick={save}>
          <Icon name="tick-circle" size={20} />
          {t("save")}
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("type")}>
          {(c) => (
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger {...c} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["clinical", "nursing", "followup"] as const).map((k) => (
                  <SelectItem key={k} value={k}>
                    {t(`types.${k}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label={t("visit")}>
          {(c) => (
            <Select value={visit} onValueChange={setVisit}>
              <SelectTrigger {...c} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("noVisit")}</SelectItem>
                {done.slice(0, 6).map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {dates.dayMonth(v.date)} · {b(v.clinic)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>
      <Field label={t("text")} required helper={`${text.length} / 1000`} error={tried && !text.trim() ? t("required") : undefined}>
        <Textarea value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder={t("placeholder")} className="min-h-28" />
      </Field>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox checked={shared} onCheckedChange={(v) => setShared(v === true)} />
        {t("shared")}
      </label>
    </ResponsiveDialog>
  )
}

/* ================================================================== visit details (drawer) */

const VISIT_TONE = { upcoming: "info", completed: "success", cancelled: "destructive" } as const

function VisitDrawer({
  patient,
  record,
  id,
  onClose,
  open,
}: {
  patient: Patient
  record: PatientRecord
  id: string
  onClose: () => void
  open: (o: OverlayKind) => void
}) {
  const t = useTranslations("patients.ov.visit")
  const tp = useTranslations("patients.page")
  const dates = useDates()
  const { b } = useText()
  const mobile = useIsMobile()
  const v = record.visits.find((x) => x.id === id)
  if (!v) return null
  const fahadDesign = patient.id === "004891" && v.id === "v4"
  const inv = record.invoices.find((i) => i.date === v.date && i.status !== "void")
  const appt = record.appointments.find((a) => a.visitId === v.id || a.date === v.date)
  const weight = record.vitals.history.find((h) => h.date === v.date)?.kg
  const rows: [string, React.ReactNode][] = [
    [t("reason"), b(v.reason)],
    [t("diagnosis"), v.dx ? b(v.dx) : "—"],
    ...(v.status === "completed"
      ? ([
          [
            t("times"),
            <bdi key="t" dir="ltr">
              {fahadDesign ? "10:02 → 10:41" : `${v.time} → ${addMin(v.time, 35)}`}
            </bdi>,
          ],
          [
            t("body"),
            weight
              ? `${tp("medical.kg", { v: weight })}${record.vitals.height && fahadDesign ? ` · ${tp("medical.cm", { v: record.vitals.height })}` : ""}`
              : "—",
          ],
          [t("vitals"), fahadDesign ? "98% · 36.8°C" : "—"],
        ] as [string, React.ReactNode][])
      : []),
  ]
  const notes = record.notes.find((n) => n.date === v.date)
  const rx = record.medications.filter((m) => m.when.date === v.date || (fahadDesign && m.status === "active" && m.name.en.includes("inhaler")))
  const footer =
    v.status === "upcoming" ? (
      <>
        <Button variant="outline" onClick={() => appt && open({ kind: "cancel", date: appt.date })} disabled={!appt}>
          {t("cancelAppt")}
        </Button>
        <Button onClick={() => appt && open({ kind: "reschedule", date: appt.date })} disabled={!appt}>
          <Icon name="calendar-2" size={20} />
          {t("reschedule")}
        </Button>
      </>
    ) : (
      <>
        <Button variant="outline" onClick={printArea}>
          <Icon name="printer" size={20} />
          {t("print")}
        </Button>
        <Button onClick={() => open({ kind: "book" })}>
          <Icon name="calendar-add" size={20} />
          {t("followUp")}
        </Button>
      </>
    )
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side={mobile ? "bottom" : "end"} className={cn("gap-0", mobile ? "max-h-[92dvh] rounded-t-2xl" : "w-full sm:max-w-120")}>
        <SheetHeader>
          <SheetTitle>{t("title", { date: dates.short(v.date) })}</SheetTitle>
          <SheetDescription>
            {b(v.clinic)} · {b(v.doctor)} · <bdi dir="ltr">{v.time}</bdi>
          </SheetDescription>
        </SheetHeader>
        <SheetBody data-print-area className="flex flex-col gap-4 overflow-y-auto">
          <StatusBadge tone={VISIT_TONE[v.status]}>{tp(`status.${v.status}`)}</StatusBadge>
          <KV rows={rows} />
          {notes && (
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-medium">{t("notes")}</h3>
              <p className="rounded-lg bg-muted p-3 text-xs">{b(notes.body)}</p>
            </section>
          )}
          {rx.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-medium">{t("prescription")}</h3>
              <KV className="border bg-card" rows={rx.map((m) => [b(m.name), b(m.dose)] as [string, React.ReactNode])} />
            </section>
          )}
          {inv && (
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-medium">{t("invoice")}</h3>
              <KV
                className="border bg-card"
                rows={[[inv.no, t("invoiceLine", { total: inv.total, insurance: inv.insurance, due: inv.status === "pending" ? inv.share : 0 })]]}
              />
            </section>
          )}
          {!notes && !rx.length && !inv && v.status !== "upcoming" && <p className="text-xs text-muted-foreground">{t("none")}</p>}
        </SheetBody>
        <SheetFooter className="flex-row justify-end gap-2 *:flex-1 sm:*:flex-none">{footer}</SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
const addMin = (t: string, m: number) => {
  const x = Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) + m
  return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`
}

/* ================================================================== reschedule / cancel */

function useAppt(record: PatientRecord, date: string) {
  return record.appointments.find((a) => a.date === date)
}

function ApptBox({ a }: { a: Appointment }) {
  const t = useTranslations("patients.ov.appt")
  const { b } = useText()
  const day = useDay()
  return (
    <KV
      rows={[
        [t("current"), t("when", { day: day(a.date), time: a.time ?? "—" })],
        [t("clinic"), a.clinic ? `${b(a.clinic)}${a.doctor ? ` · ${b(a.doctor)}` : ""}` : "—"],
      ]}
    />
  )
}

function Reschedule({ patient, record, date, onClose }: { patient: Patient; record: PatientRecord; date: string; onClose: () => void }) {
  const t = useTranslations("patients.ov.reschedule")
  const ta = useTranslations("patients.ov.appt")
  const day = useDay()
  const { change } = usePatientsStore()
  const a = useAppt(record, date)
  const [d, setD] = React.useState<string | null>(null)
  const [time, setTime] = React.useState<string | null>(null)
  const [sendSms, setSendSms] = React.useState(true)
  const [tried, setTried] = React.useState(false)
  if (!a) return null
  const confirm = () => {
    setTried(true)
    if (!d || !time) return
    change(patient.id, (c) => {
      const orig = Object.entries(c.apptEdits).find(([, e]) => e.date === date)?.[0] ?? date
      const isNew = c.visits.some((v) => v.id === a.visitId)
      return {
        ...c,
        apptEdits: isNew ? c.apptEdits : { ...c.apptEdits, [orig]: { ...c.apptEdits[orig], date: d, time } },
        visitEdits: a.visitId ? { ...c.visitEdits, [a.visitId]: { ...c.visitEdits[a.visitId], date: d, time } } : c.visitEdits,
        activity: [act({ en: `Appointment moved to ${d} ${time}`, ar: `انتقل الموعد إلى ${d} ${time}` }, "edited"), ...c.activity],
      }
    })
    onClose()
    toast.success(t("done"), { description: t("doneText", { when: ta("when", { day: day(d), time }) }) })
  }
  return (
    <ResponsiveDialog
      open
      onOpenChange={(o) => !o && onClose()}
      icon="calendar-2"
      width="sm:max-w-150"
      title={t("title")}
      description={t("text")}
      secondary={<Cancel onClick={onClose} />}
      primary={
        <Button onClick={confirm}>
          <Icon name="tick-circle" size={20} />
          {t("confirm")}
        </Button>
      }
    >
      <ApptBox a={a} />
      <SlotPicker day={d} setDay={setD} time={time} setTime={setTime} appts={record.appointments} heading={d ? t("times", { day: day(d) }) : null}>
        {tried && (!d || !time) && <p className="text-xs text-destructive">{t("pick")}</p>}
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={sendSms} onCheckedChange={(v) => setSendSms(v === true)} />
          {patient.age < 18 ? t("notifyGuardian") : t("notify")}
        </label>
      </SlotPicker>
    </ResponsiveDialog>
  )
}

function CancelAppt({ patient, record, date, onClose }: { patient: Patient; record: PatientRecord; date: string; onClose: () => void }) {
  const t = useTranslations("patients.ov.cancelAppt")
  const tr = useTranslations("patients.ov.reschedule")
  const ta = useTranslations("patients.ov.appt")
  const day = useDay()
  const { change } = usePatientsStore()
  const a = useAppt(record, date)
  const [reason, setReason] = React.useState("patient")
  const [sendSms, setSendSms] = React.useState(true)
  if (!a) return null
  const confirm = () => {
    change(patient.id, (c) => {
      const orig = Object.entries(c.apptEdits).find(([, e]) => e.date === date)?.[0] ?? date
      const isNew = c.visits.some((v) => v.id === a.visitId)
      return {
        ...c,
        apptEdits: isNew ? c.apptEdits : { ...c.apptEdits, [orig]: { ...c.apptEdits[orig], cancelled: true } },
        visitEdits: a.visitId ? { ...c.visitEdits, [a.visitId]: { ...c.visitEdits[a.visitId], status: "cancelled", amount: 0 } } : c.visitEdits,
        activity: [act({ en: `Appointment cancelled · ${date}`, ar: `انلغى موعد · ${date}` }, "edited"), ...c.activity],
      }
    })
    onClose()
    toast.success(t("done"), { description: t("doneText", { when: ta("when", { day: day(a.date), time: a.time ?? "" }) }) })
  }
  return (
    <ResponsiveDialog
      open
      onOpenChange={(o) => !o && onClose()}
      icon="close-circle"
      tone="destructive"
      width="sm:max-w-120"
      title={t("title")}
      description={t("text")}
      secondary={<Cancel onClick={onClose} label={t("keep")} />}
      primary={
        <Button variant="destructive" onClick={confirm}>
          {t("confirm")}
        </Button>
      }
    >
      <ApptBox a={a} />
      <RadioGroup value={reason} onValueChange={setReason} className="gap-2" aria-label={t("reason")}>
        {(["patient", "doctor", "mistake"] as const).map((k) => (
          <RadioOption key={k} value={k} title={t(`reasons.${k}`)} />
        ))}
      </RadioGroup>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox checked={sendSms} onCheckedChange={(v) => setSendSms(v === true)} />
        {patient.age < 18 ? tr("notifyGuardian") : tr("notify")}
      </label>
    </ResponsiveDialog>
  )
}

/* ================================================================== book visit */

const CLINICS: { key: string; name: Bi; doctors: Bi[]; price: number }[] = [
  { key: "pediatrics", name: { en: "Pediatrics", ar: "الأطفال" }, doctors: [{ en: "Dr. Ahmed Zaki", ar: "د. أحمد زكي" }], price: 350 },
  { key: "family", name: { en: "Family medicine", ar: "طب الأسرة" }, doctors: [{ en: "Dr. Reem Alotaibi", ar: "د. ريم العتيبي" }], price: 250 },
  {
    key: "cardiology",
    name: { en: "Cardiology", ar: "القلب" },
    doctors: [
      { en: "Dr. Khaled Mansour", ar: "د. خالد منصور" },
      { en: "Dr. Reem Alotaibi", ar: "د. ريم العتيبي" },
    ],
    price: 450,
  },
  { key: "dental", name: { en: "Dental", ar: "الأسنان" }, doctors: [{ en: "Dr. Sami Odeh", ar: "د. سامي عودة" }], price: 300 },
  { key: "dermatology", name: { en: "Dermatology", ar: "الجلدية" }, doctors: [{ en: "Dr. Lama Nasser", ar: "د. لمى ناصر" }], price: 300 },
]

function BookVisit({ patient, record, onClose }: { patient: Patient; record: PatientRecord; onClose: () => void }) {
  const t = useTranslations("patients.ov.book")
  const ta = useTranslations("patients.ov.appt")
  const { b } = useText()
  const day = useDay()
  const { change } = usePatientsStore()
  const [clinic, setClinic] = React.useState(patient.age < 18 ? "pediatrics" : "family")
  const c = CLINICS.find((x) => x.key === clinic)!
  const [doctor, setDoctor] = React.useState(0)
  const [type, setType] = React.useState<"inPerson" | "telehealth">("inPerson")
  const [service, setService] = React.useState<"followup" | "consult" | "checkup">("followup")
  const [d, setD] = React.useState<string | null>(null)
  const [time, setTime] = React.useState<string | null>(null)
  const [note, setNote] = React.useState("")
  const [tried, setTried] = React.useState(false)
  const doc = c.doctors[Math.min(doctor, c.doctors.length - 1)]
  const confirm = () => {
    setTried(true)
    if (!d || !time) return
    const svc: Record<typeof service, Bi> = {
      followup: { en: "Follow-up visit", ar: "زيارة متابعة" },
      consult: { en: "Consultation", ar: "استشارة" },
      checkup: { en: "Check-up", ar: "كشف" },
    }
    const v: Visit = { id: `b${Date.now()}`, date: d, time, clinic: c.name, doctor: doc, reason: svc[service], dx: null, status: "upcoming", amount: c.price }
    change(patient.id, (ch) => ({
      ...ch,
      visits: [v, ...ch.visits],
      activity: [act({ en: `Visit booked: ${c.name.en} · ${d} ${time}`, ar: `حجز موعد: ${c.name.ar} · ${d} ${time}` }), ...ch.activity],
    }))
    onClose()
    toast.success(t("done"), { description: t("doneText", { when: ta("when", { day: day(d), time }), doctor: b(doc) }) })
  }
  return (
    <ResponsiveDialog
      open
      onOpenChange={(o) => !o && onClose()}
      icon="calendar-add"
      width="sm:max-w-160"
      title={t("title")}
      description={`${b(patient.name)} · MRN ${patient.mrn}`}
      secondary={<Cancel onClick={onClose} />}
      primary={
        <Button onClick={confirm}>
          <Icon name="tick-circle" size={20} />
          {t("confirm")}
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("clinic")} required>
          {(f) => (
            <Select
              value={clinic}
              onValueChange={(v) => {
                setClinic(v)
                setDoctor(0)
                setTime(null)
              }}
            >
              <SelectTrigger {...f} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLINICS.map((x) => (
                  <SelectItem key={x.key} value={x.key}>
                    {b(x.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label={t("doctor")} required>
          {(f) => (
            <Select value={String(doctor)} onValueChange={(v) => setDoctor(Number(v))}>
              <SelectTrigger {...f} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {c.doctors.map((x, i) => (
                  <SelectItem key={x.en} value={String(i)}>
                    {b(x)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label={t("type")}>
          {() => (
            <Segmented
              aria-label={t("type")}
              value={type}
              onValueChange={setType}
              options={[
                { value: "inPerson", label: t("inPerson") },
                { value: "telehealth", label: t("telehealth") },
              ]}
            />
          )}
        </Field>
        <Field label={t("service")}>
          {(f) => (
            <Select value={service} onValueChange={(v) => setService(v as typeof service)}>
              <SelectTrigger {...f} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["followup", "consult", "checkup"] as const).map((k) => (
                  <SelectItem key={k} value={k}>
                    {t(`services.${k}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>
      <SlotPicker
        day={d}
        setDay={setD}
        time={time}
        setTime={setTime}
        appts={record.appointments}
        heading={d ? t("day", { day: day(d), doctor: b(doc) }) : null}
      >
        {tried && (!d || !time) && <p className="text-xs text-destructive">{t("pick")}</p>}
        <Field label={t("note")}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notePlaceholder")} className="min-h-16" />
        </Field>
      </SlotPicker>
    </ResponsiveDialog>
  )
}

/* ================================================================== prescribe */

const MEDICINES: { name: Bi; group?: string }[] = [
  { name: { en: "Montelukast 5 mg chewable", ar: "مونتيلوكاست 5 ملغ للمضغ" } },
  { name: { en: "Salbutamol inhaler 100 mcg", ar: "بخاخ سالبوتامول 100 ميكروغرام" } },
  { name: { en: "Budesonide inhaler 200 mcg", ar: "بخاخ بوديسونيد 200 ميكروغرام" } },
  { name: { en: "Paracetamol 500 mg", ar: "باراسيتامول 500 ملغ" } },
  { name: { en: "Ibuprofen 400 mg", ar: "إيبوبروفين 400 ملغ" } },
  { name: { en: "Amoxicillin 500 mg", ar: "أموكسيسيلين 500 ملغ" }, group: "penicillin" },
  { name: { en: "Azithromycin 250 mg", ar: "أزيثرومايسين 250 ملغ" } },
  { name: { en: "Cetirizine 10 mg", ar: "سيتريزين 10 ملغ" } },
  { name: { en: "Vitamin D3 1000 IU", ar: "فيتامين د3 1000 وحدة" } },
  { name: { en: "Omeprazole 20 mg", ar: "أوميبرازول 20 ملغ" } },
]

function Prescribe({ patient, record, onClose }: { patient: Patient; record: PatientRecord; onClose: () => void }) {
  const t = useTranslations("patients.ov.rx")
  const tp = useTranslations("patients.page")
  const { b, locale } = useText()
  const { change } = usePatientsStore()
  const [med, setMed] = React.useState<string>("")
  const [dose, setDose] = React.useState("")
  const [freq, setFreq] = React.useState<"once" | "twice" | "three" | "asNeeded" | "evening">("once")
  const [days, setDays] = React.useState("30")
  const [refills, setRefills] = React.useState("0")
  const [notes, setNotes] = React.useState("")
  const [tried, setTried] = React.useState(false)
  const m = MEDICINES.find((x) => x.name.en === med)
  const penicillin = record.allergies.find((a) => /penicillin/i.test(a.name.en))
  const clash = m?.group === "penicillin" && penicillin
  const weight = record.vitals.weight
  const list = new Intl.ListFormat(locale, { type: "conjunction" }).format(
    record.allergies.map((a) => `${b(a.name)}${a.severity === "severe" ? ` (${b({ en: "severe", ar: "شديدة" })})` : ""}`),
  )
  const confirm = () => {
    setTried(true)
    if (!m || !dose.trim() || clash) return
    change(patient.id, (c) => ({
      ...c,
      meds: [
        {
          name: m.name,
          dose: { en: `${dose.trim()} · ${FREQ_EN[freq]}`, ar: `${dose.trim()} · ${FREQ_AR[freq]}` },
          when: { kind: "sinceDay", date: TODAY },
          by: SESSION_DOCTOR,
          status: "active",
        },
        ...c.meds,
      ],
      activity: [act({ en: `Prescription: ${m.name.en}`, ar: `وصفة: ${m.name.ar}` }), ...c.activity],
    }))
    onClose()
    toast.success(t("done"), { description: t("doneText", { med: b(m.name), dose: `${dose.trim()} · ${t(`freq.${freq}`)}` }) })
  }
  return (
    <ResponsiveDialog
      open
      onOpenChange={(o) => !o && onClose()}
      icon="note-2"
      width="sm:max-w-140"
      title={t("title")}
      description={t("meta", { name: b(patient.name), age: tp("years", { n: patient.age }), weight: weight ? tp("medical.kg", { v: weight }) : "—" })}
      secondary={<Cancel onClick={onClose} />}
      primary={
        <Button onClick={confirm}>
          <Icon name="tick-circle" size={20} />
          {t("confirm")}
        </Button>
      }
    >
      {record.allergies.length > 0 && (
        <p className="flex items-start gap-2.5 rounded-lg bg-destructive-soft p-3 text-xs text-destructive-soft-foreground">
          <Icon name="danger" size={18} className="shrink-0" />
          {t("allergies", { list })}
        </p>
      )}
      <Field
        label={t("medication")}
        required
        error={clash ? t("allergyHit", { name: b(patient.name).split(" ")[0], allergy: b(penicillin!.name) }) : tried && !m ? t("required") : undefined}
      >
        {(c) => (
          <Combobox
            {...c}
            value={med}
            onChange={setMed}
            options={MEDICINES.map((x) => ({ value: x.name.en, label: b(x.name) }))}
            placeholder={t("search")}
            searchPlaceholder={t("search")}
            emptyText={t("empty")}
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("dose")} required error={tried && !dose.trim() ? t("required") : undefined}>
          <Input value={dose} onChange={(e) => setDose(e.target.value)} placeholder={b({ en: "1 tablet", ar: "حبة وحدة" })} />
        </Field>
        <Field label={t("frequency")} required>
          {(c) => (
            <Select value={freq} onValueChange={(v) => setFreq(v as typeof freq)}>
              <SelectTrigger {...c} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["once", "twice", "three", "asNeeded", "evening"] as const).map((k) => (
                  <SelectItem key={k} value={k}>
                    {t(`freq.${k}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label={t("duration")}>
          {(c) => (
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger {...c} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["5", "7", "10", "14", "30", "90"].map((n) => (
                  <SelectItem key={n} value={n}>
                    {t("days", { n })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label={t("refills")}>
          {(c) => (
            <Select value={refills} onValueChange={setRefills}>
              <SelectTrigger {...c} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["0", "1", "2", "3"].map((n) => (
                  <SelectItem key={n} value={n}>
                    {n === "0" ? t("none") : n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>
      <Field label={t("instructions")}>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("instructionsPlaceholder")} className="min-h-16" />
      </Field>
    </ResponsiveDialog>
  )
}
const FREQ_EN = { once: "once daily", twice: "twice daily", three: "three times daily", asNeeded: "as needed", evening: "once daily, evening" }
const FREQ_AR = { once: "مرة باليوم", twice: "مرتين باليوم", three: "ثلاث مرات باليوم", asNeeded: "عند الحاجة", evening: "مرة باليوم بالليل" }

/* ================================================================== upload */

const CATEGORIES: FileCategory[] = ["lab", "imaging", "prescription", "insurance", "referral", "consent"]
const ICON_FOR: Record<FileCategory, PatientFile["icon"]> = {
  lab: "document-text",
  imaging: "gallery",
  prescription: "note-2",
  insurance: "shield-tick",
  referral: "document-text",
  consent: "tick-square",
}
type Pending = { id: string; name: string; bytes: number; progress: number; file: File }
const size = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`)

function Upload({ patient, initial, onClose }: { patient: Patient; initial?: File[]; onClose: () => void }) {
  const t = useTranslations("patients.ov.upload")
  const tf = useTranslations("patients.page.files")
  const { b } = useText()
  const { change } = usePatientsStore()
  const [category, setCategory] = React.useState<FileCategory>("lab")
  const toPending = (files: File[]) => files.map((f, i) => ({ id: `${Date.now()}-${i}-${f.name}`, name: f.name, bytes: f.size, progress: 0, file: f }))
  // Files picked on the Files tab arrive pre-filled.
  const [items, setItems] = React.useState<Pending[]>(() => toPending(initial ?? []))
  const add = (files: File[]) => setItems((x) => [...x, ...toPending(files)])
  // Simulated upload progress.
  React.useEffect(() => {
    if (!items.some((i) => i.progress < 100)) return
    const id = window.setInterval(() => setItems((x) => x.map((i) => (i.progress < 100 ? { ...i, progress: Math.min(100, i.progress + 20) } : i))), 180)
    return () => window.clearInterval(id)
  }, [items])
  const ready = items.filter((i) => i.progress === 100)
  const save = () => {
    if (!ready.length) return
    const files: PatientFile[] = ready.map((i) => {
      const ext = (i.name.split(".").pop() ?? "").toUpperCase()
      return {
        icon: ICON_FOR[category],
        name: i.name,
        title: { en: i.name, ar: i.name },
        category,
        ext,
        size: size(i.bytes),
        bytes: i.bytes,
        date: TODAY,
        by: SESSION_DOCTOR,
        url: URL.createObjectURL(i.file),
      }
    })
    change(patient.id, (c) => ({
      ...c,
      files: [...files, ...c.files],
      activity: [act({ en: `Files uploaded: ${files.length}`, ar: `رفع ملفات: ${files.length}` }), ...c.activity],
    }))
    onClose()
    toast.success(t("done", { count: files.length }), { description: t("doneText", { name: b(patient.name) }) })
  }
  return (
    <ResponsiveDialog
      open
      onOpenChange={(o) => !o && onClose()}
      icon="document-upload"
      width="sm:max-w-140"
      title={t("title")}
      description={t("text")}
      secondary={<Cancel onClick={onClose} />}
      primary={
        <Button onClick={save} disabled={!ready.length}>
          <Icon name="tick-circle" size={20} />
          {t("confirm", { count: ready.length })}
        </Button>
      }
    >
      <Field label={t("category")} required>
        {(c) => (
          <Select value={category} onValueChange={(v) => setCategory(v as FileCategory)}>
            <SelectTrigger {...c} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((k) => (
                <SelectItem key={k} value={k}>
                  {tf(`category.${k}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      <DropZone onFiles={add} />
      {items.map((i) => (
        <UploadItem
          key={i.id}
          name={i.name}
          state={i.progress < 100 ? "uploading" : "complete"}
          progress={i.progress}
          doneMb={toMb((i.bytes * i.progress) / 100)}
          totalMb={toMb(i.bytes)}
          onRemove={() => setItems((x) => x.filter((y) => y.id !== i.id))}
        />
      ))}
    </ResponsiveDialog>
  )
}

/* ================================================================== file viewer */

function Viewer({ record, name, onClose }: { record: PatientRecord; name: string; onClose: () => void }) {
  const t = useTranslations("patients.ov.viewer")
  const tf = useTranslations("patients.page")
  const dates = useDates()
  const { b } = useText()
  const file = record.files.find((f) => f.name === name)
  const isLab = name === "__labs" || file?.category === "lab"
  const pages = isLab ? 2 : 1
  const [page, setPage] = React.useState(1)
  const data = usePatient()
  const title = file?.name ?? "lab-results.pdf"
  const meta = t("meta", { category: file ? tf(`files.category.${file.category}`) : tf("files.category.lab"), size: file?.size ?? "412 KB", page, pages })
  const icon = (n: Parameters<typeof Icon>[0]["name"], label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-8 cursor-pointer items-center justify-center rounded-md bg-zinc-700 text-white outline-none hover:bg-zinc-600 focus-visible:ring-[3px] focus-visible:ring-white/40"
    >
      <Icon name={n} size={16} />
    </button>
  )
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-dvh max-h-dvh w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 bg-zinc-900 p-0 sm:h-180 sm:max-h-[90dvh] sm:max-w-225 sm:rounded-2xl"
      >
        <div className="flex items-center gap-2 bg-zinc-800 px-4 py-2.5">
          <div className="flex min-w-0 flex-1 flex-col">
            <DialogTitle className="truncate text-sm font-medium text-zinc-50">
              <bdi dir="ltr">{title}</bdi>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 tabular-nums">{meta}</DialogDescription>
          </div>
          {icon("document-download", t("download"), () => {
            const target = file ?? record.files.find((f) => f.category === "lab")
            if (target) void save(target)
          })}
          {icon("printer", t("print"), printArea)}
          {icon("close-circle", t("close"), onClose)}
        </div>
        <div className="flex flex-1 items-center justify-center overflow-auto p-6">
          <div data-print-area className="flex w-full max-w-120 flex-col gap-2.5 bg-white p-6 text-zinc-950 shadow-lg">
            {isLab && record.labs && page === 1 ? (
              <>
                <h2 className="text-lg font-semibold">{t("report")}</h2>
                <p className="text-xs text-zinc-500 tabular-nums">
                  {data ? b(data.patient.name) : ""} · {data?.patient.mrn} · {dates.short(record.labs.date)}
                </p>
                {record.labs.results.map((l) => (
                  <div key={l.name.en} className="flex items-center gap-2 border-b border-zinc-200 py-1.5 text-xs">
                    <span className="flex-1">{b(l.name)}</span>
                    <bdi dir="ltr" className="font-medium tabular-nums">
                      {l.value}
                    </bdi>
                    <bdi dir="ltr" className="w-16 text-end text-zinc-500 tabular-nums rtl:text-start">
                      {l.range.replace(/ /g, "")}
                    </bdi>
                  </div>
                ))}
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Icon name={file?.icon ?? "document-text"} size={32} className="text-zinc-400" />
                <p className="text-sm font-medium">{file ? b(file.title) : t("report")}</p>
                <p className="text-xs text-zinc-500">{t("preview")}</p>
                <p className="text-xs text-zinc-500">{t("previewText")}</p>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-center gap-3 bg-zinc-800 px-4 py-2.5 text-xs text-zinc-300 tabular-nums">
          <button
            type="button"
            aria-label={t("prev")}
            disabled={page <= 1}
            onClick={() => setPage((x) => x - 1)}
            className="cursor-pointer rounded p-1 disabled:opacity-40"
          >
            <Icon name="arrow-left-1" size={16} />
          </button>
          <span className="font-medium text-zinc-50">
            <bdi dir="ltr">{page} / {pages}</bdi>
          </span>
          <button
            type="button"
            aria-label={t("next")}
            disabled={page >= pages}
            onClick={() => setPage((x) => x + 1)}
            className="cursor-pointer rounded p-1 disabled:opacity-40"
          >
            <Icon name="arrow-right-1" size={16} />
          </button>
          <span className="text-zinc-400">100%</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ================================================================== SMS */

function Sms({ patient, record, onClose }: { patient: Patient; record: PatientRecord; onClose: () => void }) {
  const t = useTranslations("patients.ov.sms")
  const { b } = useText()
  const day = useDay()
  const { savedForm } = usePatientsStore()
  const form = savedForm(patient.id)
  const minor = patient.age < 18
  const guardian = minor
    ? patient.id === "004891"
      ? { name: b({ en: "Abdullah", ar: "عبدالله" }), phone: "050 771 2045" }
      : form?.guardianName
        ? { name: form.guardianName.split(" ")[0], phone: form.guardianMobile.replace("+966 ", "0") }
        : null
    : null
  const recipients = [
    ...(guardian ? [{ key: "guardian", label: t("guardian", guardian), phone: guardian.phone }] : []),
    ...(patient.mobile ? [{ key: "patient", label: t("patient", { phone: patient.mobile }), phone: patient.mobile }] : []),
  ]
  const [to, setTo] = React.useState(recipients[0]?.key ?? "")
  const next = record.appointments.filter((a) => a.date >= TODAY && a.kind === "booked").sort((a, z) => a.date.localeCompare(z.date))[0]
  const first = b(patient.name).split(" ")[0]
  const body = (tpl: string) =>
    tpl === "reminder"
      ? next
        ? t("bodies.reminder", {
            name: first,
            clinic: next.clinic ? b(next.clinic) : "",
            doctor: next.doctor ? b(next.doctor) : "",
            when: next.time ? t("dayAt", { day: day(next.date), time: next.time }) : day(next.date),
          })
        : t("bodies.reminderNone")
      : tpl === "results"
        ? t("bodies.results", { name: first })
        : tpl === "payment"
          ? t("bodies.payment", { name: first, amount: record.billing.balance })
          : ""
  const [tpl, setTpl] = React.useState("reminder")
  const [text, setText] = React.useState(() => body("reminder"))
  const phone = recipients.find((r) => r.key === to)?.phone
  const send = () => {
    if (!phone || !text.trim()) return
    onClose()
    toast.success(t("sent"), { description: t("sentText", { phone }) })
  }
  const parts = Math.max(1, Math.ceil(text.length / 160))
  return (
    <ResponsiveDialog
      open
      onOpenChange={(o) => !o && onClose()}
      icon="sms"
      width="sm:max-w-125"
      title={t("title")}
      secondary={<Cancel onClick={onClose} />}
      primary={
        <Button onClick={send} disabled={!phone || !text.trim()}>
          <Icon name="sms" size={20} />
          {t("send")}
        </Button>
      }
    >
      {!recipients.length ? (
        <p className="rounded-lg bg-warning-soft p-3 text-xs text-warning-soft-foreground">{t("noPhone")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("to")}>
            {(c) => (
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger {...c} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {recipients.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field label={t("template")}>
            {(c) => (
              <Select
                value={tpl}
                onValueChange={(v) => {
                  setTpl(v)
                  setText(body(v))
                }}
              >
                <SelectTrigger {...c} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["reminder", "results", "payment", "custom"] as const).map((k) => (
                    <SelectItem key={k} value={k}>
                      {t(`templates.${k}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        </div>
      )}
      <Field label={t("message")} helper={t("counter", { n: text.length, sms: parts })}>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-28" disabled={!recipients.length} />
      </Field>
    </ResponsiveDialog>
  )
}
