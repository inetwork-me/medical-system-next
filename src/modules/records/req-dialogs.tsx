"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { useDates } from "@/i18n/dates"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { Combobox } from "@/components/ds/pickers"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Segmented } from "@/components/ds/segmented"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  PATIENTS,
  PERIODS,
  PURPOSES,
  REC_NOW,
  REC_TODAY,
  REQUEST_DUE_DAYS,
  addDays,
  type CopyPart,
  type Paper,
  type Period,
  type Purpose,
  type RecordsRequest,
  type ReleaseVia,
  type RequestFrom,
} from "./data"
import { patientOf } from "./lookup"
import { KvBox, Latin, Strip, ltrRun, useB } from "./parts"
import { recCan } from "./roles"
import { canRelease, copyPages, nextRequestNo } from "./rules"
import { ME } from "./session"
import { getRequest, getRequests, logAccess, saveRequest, useRecRole, useRequest } from "./store"

const FROMS: RequestFrom[] = ["patient", "insurer", "court", "hospital"]
const ASKABLE: CopyPart[] = ["notes", "labs", "prescriptions", "imaging"]
const VIAS: ReleaseVia[] = ["link", "printed", "email"]
const EXPIRES = [1, 3, 7, 14]

/** A file attached in a dialog (the ID / guardianship proof, the insurer letter, the court order). */
type Attached = { id: string; name: string; meta: string }

/* ------------------------------------------------------------------ new request */

/**
 * Overlay · New request for records (New request). Who's asking (Patient / Insurer / Court / Hospital), patient,
 * asked by, what (visit notes, lab results, prescriptions, imaging), period, purpose, the ID / guardianship file (or
 * the insurer letter / court order), "due in 30 days and the identity is confirmed first". Removing the attached file
 * removes the row in place (no toast, the dialog stays open). Save request → request-created.
 */
export function NewRequestDialog({
  onOpenChange,
  onSaved,
  initial,
}: {
  onOpenChange: (open: boolean) => void
  onSaved?: (no: string) => void
  initial?: { from?: RequestFrom; patient?: string; askedBy?: string; parts?: CopyPart[]; period?: Period; purpose?: Purpose; files?: Attached[]; tried?: boolean }
}) {
  const t = useTranslations("records.newRequest")
  const b = useB()
  const dates = useDates()
  const role = useRecRole()
  const [from, setFrom] = React.useState<RequestFrom>(initial?.from ?? "patient")
  const [patient, setPatient] = React.useState(initial?.patient ?? "")
  const [askedBy, setAskedBy] = React.useState(initial?.askedBy ?? "")
  const [parts, setParts] = React.useState<CopyPart[]>(initial?.parts ?? [])
  const [period, setPeriod] = React.useState<Period>(initial?.period ?? "m12")
  const [purpose, setPurpose] = React.useState<Purpose>(initial?.purpose ?? "secondOpinion")
  const [files, setFiles] = React.useState<Attached[]>(initial?.files ?? [])
  const [tried, setTried] = React.useState(initial?.tried ?? false)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const id = React.useId()
  const p = patient ? patientOf(patient) : undefined
  const minor = !!p && p.age < 18
  const due = addDays(REC_TODAY, REQUEST_DUE_DAYS)
  const allowed = recCan(role, "requests")
  const options = Object.entries(PATIENTS).map(([k, x]) => ({ value: k, label: `${b(x.name)} · ${x.mrn}` }))
  const fileKind = from === "patient" ? (minor ? "guardian" : "id") : from === "court" ? "court" : from === "insurer" ? "insurer" : "hospital"

  const errors = {
    patient: tried && !patient,
    askedBy: tried && !askedBy.trim(),
    parts: tried && parts.length === 0,
    file: tried && files.length === 0,
  }

  const save = () => {
    setTried(true)
    if (!allowed || !patient || !askedBy.trim() || !parts.length || !files.length) return
    const no = nextRequestNo(getRequests().map((r) => r.no))
    const who = { en: askedBy.trim(), ar: askedBy.trim() }
    const purposeText = { en: t(`purposes.${purpose}`), ar: t(`purposes.${purpose}`) }
    const paperKind: Paper["kind"] = from === "court" ? "court" : from === "patient" ? "id" : "letter"
    const req: RecordsRequest = {
      no,
      from,
      patient,
      requester: who,
      requesterShort: who,
      summary: { en: `${askedBy.trim()} · ${purposeText.en}`, ar: `${askedBy.trim()} · ${purposeText.ar}` },
      purpose: purposeText,
      receivedAt: REC_NOW,
      due,
      steps: { received: { at: REC_NOW, text: { en: "Today · at the records office", ar: "اليوم · عند قسم الملفات" }, activity: { en: `Received from ${askedBy.trim()}`, ar: `انستلم من ${askedBy.trim()}` } } },
      asked: parts,
      consentCovers: [],
      parts: [],
      courtOrder: from === "court",
      period: period === "all" ? undefined : { from: addDays(REC_TODAY, -{ m3: 91, m6: 182, m12: 365 }[period]), to: REC_TODAY },
      papers: files.map((f) => ({ id: f.id, kind: paperKind, name: { en: f.name, ar: f.name }, meta: { en: f.meta, ar: f.meta } })),
    }
    saveRequest(req)
    onOpenChange(false)
    onSaved?.(no)
    toast.success(t("toast"), { description: t("toastText", { no: ltrRun(no), date: dates.dayMonth(due) }) })
  }

  const attach = (list: FileList | null) => {
    const f = list?.[0]
    if (!f) return
    const kb = Math.max(1, Math.round(f.size / 1024))
    setFiles((xs) => [...xs, { id: `${Date.now()}`, name: f.name, meta: t("fileMeta", { size: kb }) }])
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("text")}
      icon="folder-open"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button onClick={save} disabled={!allowed}>
          {t("save")}
        </Button>
      }
    >
      {!allowed && (
        <Strip tone="warning" icon="warning-2">
          {t("notAllowed")}
        </Strip>
      )}
      <div className="flex flex-col gap-1.5">
        <span id={`${id}-from`} className="text-xs font-medium text-foreground">
          {t("who")}
          <span aria-hidden className="text-destructive">
            *
          </span>
        </span>
        <Segmented
          value={from}
          onValueChange={(v) => {
            setFrom(v)
            setFiles([])
          }}
          aria-labelledby={`${id}-from`}
          options={FROMS.map((f) => ({ value: f, label: t(`from.${f}`) }))}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("patient")} required error={errors.patient ? t("patientError") : undefined}>
          {(fp) => (
            <Combobox
              {...fp}
              options={options}
              value={patient}
              onChange={setPatient}
              placeholder={t("patientPlaceholder")}
              searchPlaceholder={t("patientSearch")}
              emptyText={t("patientEmpty")}
            />
          )}
        </Field>
        <Field label={t("askedBy")} required error={errors.askedBy ? t("askedByError") : undefined}>
          <Input value={askedBy} onChange={(e) => setAskedBy(e.target.value)} placeholder={t(`askedByPlaceholder.${from}`)} />
        </Field>
      </div>
      {minor && from === "patient" && (
        <Strip tone="info" icon="info-circle">
          {t("minor", { name: b(p!.name).split(" ")[0], age: p!.age, sex: p!.sex })}
        </Strip>
      )}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-xs font-medium text-foreground">
          {t("what")}
          <span aria-hidden className="text-destructive">
            *
          </span>
        </legend>
        <div className="flex flex-col gap-1.5 rounded-lg border px-3 py-2.5" aria-invalid={errors.parts || undefined}>
          {ASKABLE.map((part) => (
            <label key={part} htmlFor={`${id}-${part}`} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                id={`${id}-${part}`}
                checked={parts.includes(part)}
                onCheckedChange={(v) => setParts((xs) => (v === true ? [...xs, part] : xs.filter((x) => x !== part)))}
              />
              {t(`parts.${part}`)}
            </label>
          ))}
        </div>
        {errors.parts && <p className="text-xs text-destructive">{t("whatError")}</p>}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("period")}>
          {(fp) => (
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger {...fp} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((x) => (
                  <SelectItem key={x} value={x}>
                    {t(`periods.${x}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label={t("purpose")}>
          {(fp) => (
            <Select value={purpose} onValueChange={(v) => setPurpose(v as Purpose)}>
              <SelectTrigger {...fp} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PURPOSES.map((x) => (
                  <SelectItem key={x} value={x}>
                    {t(`purposes.${x}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>
      <div className="flex flex-col gap-1.5">
        {files.map((f) => (
          <div key={f.id} className="flex items-center gap-3 py-1">
            <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
              <Icon name="document-text" size={20} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm text-foreground">{f.name}</span>
              <span className="text-xs text-muted-foreground">{f.meta}</span>
            </span>
            {/* Removing a file removes the row in place: no toast, the dialog stays open. */}
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setFiles((xs) => xs.filter((x) => x.id !== f.id))} aria-label={t("removeFile", { name: f.name })}>
              <Icon name="trash" size={22} />
            </Button>
          </div>
        ))}
        {files.length === 0 && (
          <>
            <Button variant="outline" className="justify-start border-dashed" onClick={() => fileRef.current?.click()} aria-invalid={errors.file || undefined}>
              <Icon name="document-upload" size={20} />
              {t(`attach.${fileKind}`)}
            </Button>
            <input ref={fileRef} type="file" accept=".pdf,image/*" className="sr-only" tabIndex={-1} onChange={(e) => attach(e.target.files)} />
            {errors.file && <p className="text-xs text-destructive">{t("fileError")}</p>}
          </>
        )}
      </div>
      <Strip tone="info" icon="info-circle">
        {t("info", { n: REQUEST_DUE_DAYS, date: dates.dayMonth(due) })}
      </Strip>
    </ResponsiveDialog>
  )
}

/* ------------------------------------------------------------------ release */

/**
 * Overlay · Release the records (Release / Release records). Summary (request, pages · watermarked, reviewed by), Send
 * by (Secure link / Printed / Encrypted email), link expiry, send to, "Send the password by SMS on its own", "every
 * page carries the request number; opening is logged". Release → logged → records-released.
 */
export function ReleaseDialog({
  requestNo,
  onOpenChange,
  initial,
}: {
  requestNo: string
  onOpenChange: (open: boolean) => void
  initial?: { via?: ReleaseVia; sendTo?: string; tried?: boolean }
}) {
  const t = useTranslations("records.release")
  const b = useB()
  const dates = useDates()
  const role = useRecRole()
  const r = useRequest(requestNo)
  const [via, setVia] = React.useState<ReleaseVia>(initial?.via ?? "link")
  const [expires, setExpires] = React.useState(7)
  const [sendTo, setSendTo] = React.useState(initial?.sendTo ?? r?.sendTo ?? "")
  const [handedTo, setHandedTo] = React.useState("")
  const [passwordSms, setPasswordSms] = React.useState(true)
  const [tried, setTried] = React.useState(initial?.tried ?? false)
  const [busy, setBusy] = React.useState(false)
  const id = React.useId()
  if (!r) return null
  const p = patientOf(r.patient)
  const pages = copyPages(r)
  const allowed = recCan(role, "release") && canRelease(r)
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sendTo.trim())
  const mobile = /^\+?[0-9 ]{9,}$/.test(sendTo.trim())
  const toOk = via === "printed" ? !!handedTo.trim() : via === "email" ? email : email || mobile
  const review = r.steps.review

  const release = async () => {
    setTried(true)
    if (!allowed || !toOk || busy) return
    setBusy(true)
    await new Promise((x) => setTimeout(x, 400))
    const cur = getRequest(requestNo)
    if (!cur) return
    const text =
      via === "link"
        ? { en: `Secure link · expires in ${expires} days`, ar: `رابط آمن · ينتهي بعد ${expires} أيام` }
        : via === "printed"
          ? { en: `Printed · handed to ${handedTo.trim()}`, ar: `مطبوع · انسلّم لـ ${handedTo.trim()}` }
          : { en: "Encrypted email", ar: "إيميل مشفّر" }
    saveRequest({
      ...cur,
      sendTo: via === "printed" ? cur.sendTo : sendTo.trim(),
      steps: { ...cur.steps, released: { at: REC_NOW, text, activity: { en: `Released to ${cur.requesterShort.en}`, ar: `انسلّم لـ${cur.requesterShort.ar}` } } },
      release: { at: REC_NOW, via, expiresDays: via === "link" ? expires : undefined, passwordSms: via === "link" ? passwordSms : undefined },
    })
    // Every release is logged (Access log).
    logAccess({
      id: `ax-rel-${cur.no}`,
      at: REC_NOW,
      user: ME,
      patient: cur.patient,
      action: via === "printed" ? "print" : "export",
      pages,
      why: { en: `Request ${cur.no}`, ar: `الطلب ${cur.no}` },
      flag: "normal",
    })
    setBusy(false)
    onOpenChange(false)
    const who = b(cur.requesterShort)
    toast.success(t("toast"), { description: t(`toastText.${via}`, { who, sms: via === "link" && passwordSms ? "yes" : "no" }) })
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("text", { name: b(p.name), who: b(r.requesterShort) })}
      icon="send-2"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button onClick={() => void release()} disabled={!allowed || busy}>
          {busy ? t("releasing") : t("release")}
        </Button>
      }
    >
      <KvBox
        rows={[
          [
            t("request"),
            <span key="r">
              <Latin>{r.no}</Latin> · {b(r.requesterShort)}
            </span>,
          ],
          [t("copy"), t("copyValue", { n: pages })],
          [
            t("reviewedBy"),
            review ? (
              <span key="v" className="text-success">
                {b(review.text).split(" · ")[0]} · {dates.dayMonth(review.at)}
              </span>
            ) : (
              <span key="v" className="text-warning-soft-foreground">
                {t("notReviewed")}
              </span>
            ),
          ],
        ]}
      />
      {!allowed && (
        <Strip tone="warning" icon="warning-2">
          {canRelease(r) ? t("notAllowed") : t("notReady")}
        </Strip>
      )}
      <div className="flex flex-col gap-1.5">
        <span id={`${id}-via`} className="text-xs font-medium text-foreground">
          {t("sendBy")}
          <span aria-hidden className="text-destructive">
            *
          </span>
        </span>
        <Segmented value={via} onValueChange={setVia} aria-labelledby={`${id}-via`} options={VIAS.map((v) => ({ value: v, label: t(`via.${v}`) }))} />
      </div>
      {via === "printed" ? (
        <Field label={t("handedTo")} required error={tried && !toOk ? t("handedToError") : undefined}>
          <Input value={handedTo} onChange={(e) => setHandedTo(e.target.value)} placeholder={t("handedToPlaceholder")} />
        </Field>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {via === "link" && (
            <Field label={t("expires")}>
              {(fp) => (
                <Select value={String(expires)} onValueChange={(v) => setExpires(Number(v))}>
                  <SelectTrigger {...fp} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRES.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {t("after", { n: d })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          )}
          <Field label={t("sendTo")} required error={tried && !toOk ? t(via === "email" ? "emailError" : "sendToError") : undefined} className={via === "email" ? "sm:col-span-2" : undefined}>
            <Input dir="ltr" value={sendTo} onChange={(e) => setSendTo(e.target.value)} startIcon={<Icon name="sms" size={20} className="text-muted-foreground" />} />
          </Field>
        </div>
      )}
      {via === "link" && (
        <label htmlFor={`${id}-pw`} className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox id={`${id}-pw`} checked={passwordSms} onCheckedChange={(v) => setPasswordSms(v === true)} />
          {t("passwordSms")}
        </label>
      )}
      <Strip tone="info" icon="info-circle">
        {t(via === "printed" ? "infoPrinted" : "info")}
      </Strip>
    </ResponsiveDialog>
  )
}
