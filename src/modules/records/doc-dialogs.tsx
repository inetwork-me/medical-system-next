"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { DatePicker } from "@/components/ds/pickers"
import { Field } from "@/components/ds/field"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Segmented } from "@/components/ds/segmented"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { HOSPITALS, REC_NOW, REC_TODAY, SHARE_LINK_DAYS, addDays, REFERRAL_CLINICS, USERS, icdOf, type RecDocument, type Sector, type Soon } from "./data"
import { patientOf } from "./lookup"
import { KvBox, Latin, Strip, useB, useWhen } from "./parts"
import { recCan } from "./roles"
import { mainDiagnosis, nextDocNo } from "./rules"
import { seha } from "./seha"
import { ME } from "./session"
import { getDocuments, getEncounter, getNotes, saveDocument, useEncounter, useNotes, useRecRole } from "./store"

const SECTORS: Sector[] = ["private", "government", "none"]
const SOONS: Soon[] = ["routine", "week", "urgent"]
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const toDate = (iso: string) => new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))

/* ------------------------------------------------------------------ sick leave */

/**
 * Overlay · Sick leave (Create for this visit › Sick leave). Patient (ID masked "ID ends in 482"), visit, From, Days,
 * Works in (Private sector / Government / Not working), "Show the diagnosis on the certificate" (off by default), note
 * about Seha + SMS + QR. Issue sick leave → Seha (stub) → the document → sickleave-issued.
 */
export function SickLeaveDialog({
  encounter,
  onOpenChange,
  initial,
}: {
  encounter: string
  onOpenChange: (open: boolean) => void
  initial?: { from?: string; days?: string; sector?: Sector; diagnosis?: boolean; tried?: boolean }
}) {
  const t = useTranslations("records.sickLeave")
  const b = useB()
  const when = useWhen()
  const role = useRecRole()
  const e = useEncounter(encounter)
  const note = useNotes().find((n) => n.encounter === encounter)
  const [from, setFrom] = React.useState<string>(initial?.from ?? REC_TODAY)
  const [days, setDays] = React.useState(initial?.days ?? "2")
  const [sector, setSector] = React.useState<Sector>(initial?.sector ?? "private")
  const [showDx, setShowDx] = React.useState(initial?.diagnosis ?? false)
  const [tried, setTried] = React.useState(initial?.tried ?? false)
  const [busy, setBusy] = React.useState(false)
  const dxId = React.useId()
  if (!e) return null
  const p = patientOf(e.patient)
  const n = Number(days)
  const daysOk = Number.isInteger(n) && n >= 1 && n <= 30
  const allowed = recCan(role, "documents") && e.doctor === ME
  const main = note ? mainDiagnosis(note) : undefined

  const issue = async () => {
    setTried(true)
    if (!daysOk || !from || !allowed || busy) return
    setBusy(true)
    try {
      const res = await seha.register({ patientIdLast3: p.nationalIdLast3 ?? "", from, days: n, sector, showDiagnosis: showDx, diagnosis: showDx ? main?.code : undefined })
      const no = nextDocNo("SL", getDocuments().map((d) => d.no))
      const dayWord = { en: n === 1 ? "1 day" : `${n} days`, ar: n === 1 ? "يوم" : n === 2 ? "يومين" : n <= 10 ? `${n} أيام` : `${n} يوم` }
      const icd = main ? icdOf(main.code) : undefined
      const doc: RecDocument = {
        no,
        kind: "sickLeave",
        patient: e.patient,
        at: REC_NOW,
        status: "issued",
        details: { en: `${dayWord.en} · Seha ref. ${res.ref}`, ar: `${dayWord.ar} · مرجع صحة ${res.ref}` },
        encounter,
        doctor: e.doctor,
        for: sector === "none" ? undefined : p.sex === "f" ? { en: "Her employer", ar: "جهة عملها" } : { en: "His employer", ar: "جهة عمله" },
        seha: { ref: res.ref, from, days: n, sector, showDiagnosis: showDx },
        sections: icd ? [{ key: "diagnosis", text: { en: `${main!.code} · ${icd.name.en}.`, ar: `${main!.code} · ${icd.name.ar}.` } }] : [],
        signedAt: REC_NOW,
        verifyCode: `SL${res.ref.slice(-3)}-${no.slice(-3)}`,
        shares: [{ to: "patient", name: { en: "Patient", ar: "المريض" }, via: "sms" }],
        history: [
          { at: REC_NOW, text: { en: "Issued and registered in Seha", ar: "صدرت وانسجلت في منصة صحة" } },
          { at: REC_NOW, text: { en: "SMS sent to the patient", ar: "انرسلت رسالة للمريض" } },
        ],
      }
      saveDocument(doc)
      onOpenChange(false)
      toast.success(t("toast"), { description: t("toastText", { days: n, ref: `⁦${res.ref}⁩` }) })
    } catch {
      toast.error(t("failed"), { description: t("failedText"), retry: () => void issue() })
    } finally {
      setBusy(false)
    }
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("text")}
      icon="calendar-edit"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button onClick={() => void issue()} disabled={busy || !allowed}>
          {busy ? t("issuing") : t("issue")}
        </Button>
      }
    >
      <KvBox
        rows={[
          [
            t("patient"),
            <span key="p">
              {b(p.name)}
              {p.nationalIdLast3 && (
                <>
                  {" · "}
                  {t("idEnds")} <Latin>{p.nationalIdLast3}</Latin>
                </>
              )}
            </span>,
          ],
          [t("visit"), `${when(e.at, { time: false })} · ${b(e.clinic)}`],
        ]}
      />
      {!allowed && (
        <Strip tone="warning" icon="warning-2">
          {t("notYours")}
        </Strip>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Field label={t("from")} required error={tried && !from ? t("fromError") : undefined}>
          {(fp) => <DatePicker {...fp} value={from ? toDate(from) : undefined} onChange={(d) => setFrom(d ? isoDay(d) : "")} placeholder={t("fromPlaceholder")} />}
        </Field>
        <Field label={t("days")} required error={tried && !daysOk ? t("daysError") : undefined}>
          <Input inputMode="numeric" dir="ltr" value={days} onChange={(ev) => setDays(ev.target.value.replace(/\D/g, "").slice(0, 2))} />
        </Field>
      </div>
      <div className="flex flex-col gap-1.5">
        <span id={`${dxId}-sector`} className="text-xs font-medium text-foreground">
          {t("worksIn")}
          <span aria-hidden className="text-destructive">
            *
          </span>
        </span>
        <Segmented value={sector} onValueChange={setSector} aria-labelledby={`${dxId}-sector`} options={SECTORS.map((s) => ({ value: s, label: t(`sector.${s}`) }))} />
      </div>
      <label htmlFor={dxId} className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox id={dxId} checked={showDx} onCheckedChange={(v) => setShowDx(v === true)} />
        {t("showDiagnosis")}
      </label>
      <Strip tone="info" icon="info-circle">
        {t(sector === "none" ? "infoNoEmployer" : "info", { sex: p.sex })}
      </Strip>
    </ResponsiveDialog>
  )
}

/* ------------------------------------------------------------------ referral */

/**
 * Overlay · Refer the patient (Create for this visit › Referral). To: Inside Al Noor (clinic + doctor) / Another
 * hospital; How soon (Routine / Within a week / Urgent); reason; "Attach today's note and ECG". Send referral → the
 * document (waiting for reply) → referral-sent.
 */
export function ReferralDialog({
  encounter,
  onOpenChange,
  initial,
}: {
  encounter: string
  onOpenChange: (open: boolean) => void
  initial?: { inside?: boolean; clinic?: string; doctor?: string; hospital?: string; soon?: Soon; reason?: string; tried?: boolean }
}) {
  const t = useTranslations("records.referral")
  const b = useB()
  const role = useRecRole()
  const e = useEncounter(encounter)
  const note = useNotes().find((n) => n.encounter === encounter)
  const [inside, setInside] = React.useState(initial?.inside ?? true)
  const [clinic, setClinic] = React.useState(initial?.clinic ?? "")
  const [doctor, setDoctor] = React.useState(initial?.doctor ?? "")
  const [hospital, setHospital] = React.useState(initial?.hospital ?? "")
  const [soon, setSoon] = React.useState<Soon>(initial?.soon ?? "routine")
  const [reason, setReason] = React.useState(initial?.reason ?? "")
  const [attach, setAttach] = React.useState(true)
  const [tried, setTried] = React.useState(initial?.tried ?? false)
  const [busy, setBusy] = React.useState(false)
  const id = React.useId()
  if (!e) return null
  const p = patientOf(e.patient)
  const c = REFERRAL_CLINICS.find((x) => x.id === clinic)
  const h = HOSPITALS.find((x) => x.id === hospital)
  const allowed = recCan(role, "documents") && e.doctor === ME
  const ecg = note?.orders.some((o) => o.kind === "ecg" && o.status === "done")
  const missing = inside ? !c : !h

  const sendIt = async () => {
    setTried(true)
    if (missing || !allowed || busy) return
    setBusy(true)
    await new Promise((r) => setTimeout(r, 300))
    const no = nextDocNo("RF", getDocuments().map((d) => d.no))
    const to = inside ? c!.name : h!.name
    const doc = USERS[doctor as keyof typeof USERS]
    const main = note ? mainDiagnosis(note) : undefined
    const icd = main ? icdOf(main.code) : undefined
    saveDocument({
      no,
      kind: "referral",
      patient: e.patient,
      at: REC_NOW,
      status: "waiting",
      details: inside ? { en: `${to.en} · inside Al Noor`, ar: `${to.ar} · داخل النور` } : { en: to.en, ar: to.ar },
      encounter,
      doctor: e.doctor,
      for: to,
      referral: { inside, to, doctor: doc?.name, soon, attach },
      sections: [
        ...(icd ? [{ key: "diagnosis" as const, text: { en: `${main!.code} · ${icd.name.en}.`, ar: `${main!.code} · ${icd.name.ar}.` } }] : []),
        ...(reason.trim() ? [{ key: "reason" as const, text: { en: reason.trim(), ar: reason.trim() } }] : []),
      ],
      signedAt: REC_NOW,
      shares: inside ? [] : [{ to: "hospital", name: to, via: "link", expires: addDays(REC_TODAY, SHARE_LINK_DAYS) }],
      history: [{ at: REC_NOW, text: attach ? { en: "Sent with today's note and ECG", ar: "انرسل مع ملاحظة اليوم والتخطيط" } : { en: "Sent", ar: "انرسل" } }],
    })
    setBusy(false)
    onOpenChange(false)
    toast.success(t("toast"), {
      description: inside ? t("toastInside", { clinic: b(c!.short), sex: p.sex }) : t("toastOutside", { hospital: b(h!.name) }),
    })
  }

  const doctors = c ? c.doctors : []
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={b(p.name)}
      icon="arrow-swap-horizontal"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button onClick={() => void sendIt()} disabled={busy || !allowed}>
          {busy ? t("sending") : t("send")}
        </Button>
      }
    >
      {!allowed && (
        <Strip tone="warning" icon="warning-2">
          {t("notYours")}
        </Strip>
      )}
      <div className="flex flex-col gap-1.5">
        <span id={`${id}-to`} className="text-xs font-medium text-foreground">
          {t("to")}
          <span aria-hidden className="text-destructive">
            *
          </span>
        </span>
        <Segmented
          value={inside ? "inside" : "outside"}
          onValueChange={(v) => setInside(v === "inside")}
          aria-labelledby={`${id}-to`}
          options={[
            { value: "inside", label: t("inside") },
            { value: "outside", label: t("outside") },
          ]}
        />
      </div>
      {inside ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("clinic")} required error={tried && !c ? t("clinicError") : undefined}>
            {(fp) => (
              <Select
                value={clinic}
                onValueChange={(v) => {
                  setClinic(v)
                  setDoctor("")
                }}
              >
                <SelectTrigger {...fp} className="w-full">
                  <SelectValue placeholder={t("choose")} />
                </SelectTrigger>
                <SelectContent>
                  {REFERRAL_CLINICS.map((x) => (
                    <SelectItem key={x.id} value={x.id}>
                      {b(x.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field label={t("doctor")}>
            {(fp) => (
              <Select value={doctor} onValueChange={setDoctor} disabled={!c}>
                <SelectTrigger {...fp} className="w-full">
                  <SelectValue placeholder={t("anyDoctor")} />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((k) => (
                    <SelectItem key={k} value={k}>
                      {b(USERS[k].name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        </div>
      ) : (
        <Field label={t("hospital")} required error={tried && !h ? t("hospitalError") : undefined}>
          {(fp) => (
            <Select value={hospital} onValueChange={setHospital}>
              <SelectTrigger {...fp} className="w-full">
                <SelectValue placeholder={t("choose")} />
              </SelectTrigger>
              <SelectContent>
                {HOSPITALS.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {b(x.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      )}
      <div className="flex flex-col gap-1.5">
        <span id={`${id}-soon`} className="text-xs font-medium text-foreground">
          {t("howSoon")}
          <span aria-hidden className="text-destructive">
            *
          </span>
        </span>
        <Segmented value={soon} onValueChange={setSoon} aria-labelledby={`${id}-soon`} options={SOONS.map((s) => ({ value: s, label: t(`soon.${s}`) }))} />
      </div>
      <Field label={t("reason")}>
        <Textarea rows={3} value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder={t("reasonPlaceholder")} />
      </Field>
      <label htmlFor={`${id}-attach`} className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox id={`${id}-attach`} checked={attach} onCheckedChange={(v) => setAttach(v === true)} />
        {t(ecg ? "attach" : "attachNote")}
      </label>
    </ResponsiveDialog>
  )
}

/* ------------------------------------------------------------------ medical report (draft) */

/**
 * Create for this visit › Medical report: a draft drafted from the visit note (main diagnosis, examination, follow-up),
 * opened on the document page, where the doctor signs and sends it. Reuses an existing draft for the visit.
 */
export function draftReportFrom(encounter: string): string | undefined {
  const docs = getDocuments()
  const existing = docs.find((d) => d.kind === "report" && d.encounter === encounter && d.status === "draft")
  if (existing) return existing.no
  const note = getNotes().find((n) => n.encounter === encounter)
  const e = getEncounter(encounter)
  if (!note || !e) return undefined
  const main = mainDiagnosis(note)
  const icd = main ? icdOf(main.code) : undefined
  const no = nextDocNo("MR", docs.map((d) => d.no))
  const sections: NonNullable<RecDocument["sections"]> = []
  if (icd) sections.push({ key: "diagnosis", text: { en: `${main!.code} · ${icd.name.en}.`, ar: `${main!.code} · ${icd.name.ar}.` } })
  if (note.objective.en || note.objective.ar) sections.push({ key: "findings", text: note.objective })
  saveDocument({
    no,
    kind: "report",
    patient: e.patient,
    at: REC_NOW,
    status: "draft",
    details: { en: "Draft · from the visit note", ar: "مسودة · من ملاحظة الزيارة" },
    encounter,
    doctor: e.doctor,
    sections,
    verifyCode: `MR${no.slice(-3)}-${encounter.slice(-3)}`,
    history: [{ at: REC_NOW, text: { en: "Drafted from today's visit note", ar: "انكتب من ملاحظة زيارة اليوم" } }],
  })
  return no
}
