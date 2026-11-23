"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { useDates } from "@/i18n/dates"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Segmented } from "@/components/ds/segmented"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Combobox } from "@/components/ds/pickers"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { CURRENT_MEDS, PATIENTS, REC_NOW, USERS, icdOf, type AddendumReason, type DiagnosisType, type VisitNote } from "./data"
import { checkMedicines } from "./checks"
import { patientOf } from "./lookup"
import { pinService, validPinShape, PIN_LENGTH } from "./pin"
import { KvBox, Latin, Strip, ltrRun, useB, useWhen } from "./parts"
import { recCan } from "./roles"
import { addAddendum, addDiagnosis, mainDiagnosis, searchIcd, signNote } from "./rules"
import { ME } from "./session"
import { addEncounter, addProblem, getNote, getNotes, saveNote, useEncounter, useNote, useRecRole } from "./store"

const REASONS: AddendumReason[] = ["lateResult", "correction", "moreInfo", "patientCall"]

/* ------------------------------------------------------------------ sign */

/**
 * Overlay · Sign the visit note (Sign note; Sign on an overdue row). Summary (patient, diagnoses, orders, medicines
 * checked), "I reviewed his allergies and current medicines", the signing PIN (masked, 4 digits), "once signed it's
 * locked; later changes are addenda". Sign and lock → PIN check (stub) → note-signed toast. `draft` carries the
 * page's unsaved edits so they're signed too.
 */
export function SignNoteDialog({
  noteId,
  draft,
  onOpenChange,
  onSigned,
  initial,
}: {
  noteId: string
  draft?: Partial<VisitNote>
  onOpenChange: (open: boolean) => void
  onSigned?: () => void
  /** Stories: open with the drawn state (box ticked, PIN typed) or the errors showing. */
  initial?: { reviewed?: boolean; pin?: string; tried?: boolean; wrong?: boolean }
}) {
  const t = useTranslations("records.sign")
  const b = useB()
  const locale = useLocale()
  const when = useWhen()
  const role = useRecRole()
  const stored = useNote(noteId)
  const e = useEncounter(stored?.encounter ?? "")
  const [reviewed, setReviewed] = React.useState(initial?.reviewed ?? false)
  const [pin, setPin] = React.useState(initial?.pin ?? "")
  const [tried, setTried] = React.useState(initial?.tried ?? false)
  const [wrong, setWrong] = React.useState(initial?.wrong ?? false)
  const [busy, setBusy] = React.useState(false)
  const boxId = React.useId()
  if (!stored || !e) return null
  const n = { ...stored, ...draft }
  const p = patientOf(e.patient)
  const allowed = n.author === ME && recCan(role, "signNote") && !n.signedAt
  const main = mainDiagnosis(n)
  const sep = locale === "ar" ? "، " : ", "
  const newMeds = n.medicines.filter((m) => m.isNew).length
  const check = checkMedicines(p, n.medicines.map((m) => m.drug), CURRENT_MEDS[e.patient] ?? [])
  const medsOk = check.allergy.length === 0

  const pinError = tried && !validPinShape(pin) ? t("pinError") : wrong ? t("pinWrong") : undefined
  const reviewError = tried && !reviewed

  const sign = async () => {
    setTried(true)
    setWrong(false)
    if (!allowed || !reviewed || !validPinShape(pin) || busy) return
    setBusy(true)
    try {
      const res = await pinService.verify(USERS[ME].id, pin)
      if (!res.ok) {
        setWrong(true)
        setPin("")
        return
      }
      const cur = getNote(noteId)
      if (!cur) return
      saveNote(signNote({ ...cur, ...draft }, REC_NOW))
      onOpenChange(false)
      onSigned?.()
      toast.success(t("toast"), { description: t("toastText") })
    } catch {
      toast.error(t("failed"), { description: t("failedText"), retry: () => void sign() })
    } finally {
      setBusy(false)
    }
  }

  const rows: [React.ReactNode, React.ReactNode][] = [
    [
      t("patient"),
      <span key="p">
        {b(p.name)} · <Latin>{p.mrn}</Latin>
      </span>,
    ],
    [t("diagnoses"), n.diagnoses.length ? <bdi key="d">{t("diagnosesValue", { n: n.diagnoses.length, code: ltrRun(main?.code ?? "") })}</bdi> : t("none")],
    [t("orders"), n.orders.length ? n.orders.map((o) => b(o.short)).join(sep) : t("none")],
    [
      t("medicines"),
      n.medicines.length ? (
        <span key="m" className={medsOk ? "text-success" : "text-warning-soft-foreground"}>
          {t(medsOk ? "medicinesChecked" : "medicinesAllergy", { n: n.medicines.length, fresh: newMeds })}
        </span>
      ) : (
        t("none")
      ),
    ],
  ]

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("text", { name: b(p.name), when: when(n.createdAt).toLocaleLowerCase(locale === "ar" ? "ar" : "en") })}
      icon="edit-2"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button onClick={() => void sign()} disabled={!allowed || busy}>
          {busy ? t("signing") : t("confirm")}
        </Button>
      }
    >
      <KvBox rows={rows} />
      {!allowed && (
        <Strip tone="warning" icon="warning-2">
          {n.signedAt ? t("already") : t("notYours")}
        </Strip>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={boxId} className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox id={boxId} checked={reviewed} onCheckedChange={(v) => setReviewed(v === true)} aria-invalid={reviewError} />
          {t(p.sex === "f" ? "reviewedHer" : "reviewedHis")}
        </label>
        {reviewError && <p className="text-xs text-destructive">{t("reviewedError")}</p>}
      </div>
      <Field label={t("pin")} required helper={t("pinHint", { n: PIN_LENGTH })} error={pinError}>
        <Input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          dir="ltr"
          maxLength={PIN_LENGTH}
          value={pin}
          onChange={(ev) => setPin(ev.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))}
          onKeyDown={(ev) => ev.key === "Enter" && void sign()}
          startIcon={<Icon name="lock" size={20} className="text-muted-foreground" />}
          className="tracking-[0.3em]"
        />
      </Field>
      <Strip tone="info" icon="info-circle">
        {t("info")}
      </Strip>
    </ResponsiveDialog>
  )
}

/* ------------------------------------------------------------------ add diagnosis */

/**
 * Overlay · Add a diagnosis (Add diagnosis). ICD-10 search by name or code; radio results (code + name + hint:
 * already on this visit · needs a test to confirm · unspecified codes get rejected by insurers); Type Main /
 * Secondary / Suspected (one Main: a new Main makes the old one Secondary); "Add to his problem list".
 * Add → diagnosis-added.
 */
export function AddDiagnosisDialog({
  noteId,
  onOpenChange,
  initial,
}: {
  noteId: string
  onOpenChange: (open: boolean) => void
  initial?: { query?: string; code?: string; type?: DiagnosisType; tried?: boolean }
}) {
  const t = useTranslations("records.addDiagnosis")
  const b = useB()
  const n = useNote(noteId)
  const e = useEncounter(n?.encounter ?? "")
  const [query, setQuery] = React.useState(initial?.query ?? "")
  const [code, setCode] = React.useState(initial?.code ?? "")
  const [type, setType] = React.useState<DiagnosisType>(initial?.type ?? (n && n.diagnoses.length ? "secondary" : "main"))
  const [problem, setProblem] = React.useState(false)
  const [tried, setTried] = React.useState(initial?.tried ?? false)
  const problemId = React.useId()
  if (!n || !e) return null
  const p = patientOf(e.patient)
  const results = searchIcd(query)
  const onVisit = new Set(n.diagnoses.map((d) => d.code))
  const picked = code && !onVisit.has(code) ? code : ""

  const add = () => {
    setTried(true)
    if (!picked) return
    const cur = getNote(noteId)
    if (!cur || cur.signedAt) return
    saveNote(addDiagnosis(cur, picked, type))
    const icd = icdOf(picked)
    if (problem && icd) addProblem(e.patient, { name: icd.short ?? icd.name, since: { en: "Since this visit", ar: "من هالزيارة" } })
    onOpenChange(false)
    toast.success(t("toast"), { description: `${ltrRun(picked)} · ${t(`typeLower.${type}`)}` })
  }

  const hint = (c: string) => {
    const x = icdOf(c)!
    if (onVisit.has(c)) return { text: t("onVisit"), tone: "muted" as const }
    if (x.confirm) return { text: b(x.confirm), tone: "muted" as const }
    if (x.unspecified) return { text: t("unspecified"), tone: "warning" as const }
    return null
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("text")}
      icon="health"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={<Button onClick={add}>{t("add")}</Button>}
    >
      <Field label={t("search")} error={tried && !picked ? t("pickError") : undefined}>
        <Input
          type="search"
          value={query}
          onChange={(ev) => {
            setQuery(ev.target.value)
            setTried(false)
          }}
          placeholder={t("searchPlaceholder")}
          startIcon={<Icon name="search-normal-1" size={18} />}
          autoFocus
        />
      </Field>
      {query.trim() === "" ? (
        <p className="text-xs text-muted-foreground">{t("searchHint")}</p>
      ) : results.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("noResults")}</p>
      ) : (
        <RadioGroupPrimitive.Root value={picked} onValueChange={setCode} aria-label={t("search")} className="flex flex-col gap-2">
          {results.map((x) => {
            const h = hint(x.code)
            return (
              <RadioGroupPrimitive.Item
                key={x.code}
                value={x.code}
                disabled={onVisit.has(x.code)}
                className="group/radio flex w-full cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 text-start transition-colors outline-none hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default disabled:hover:bg-card data-[state=checked]:border-primary data-[state=checked]:bg-accent"
              >
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-card group-data-[state=checked]/radio:border-primary">
                  <RadioGroupPrimitive.Indicator className="size-2 rounded-full bg-primary" />
                </span>
                <Latin className="w-16 shrink-0 text-sm text-primary">{x.code}</Latin>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm text-foreground">{b(x.name)}</span>
                  {h && <span className={cn("text-xs", h.tone === "warning" ? "text-warning-soft-foreground" : "text-muted-foreground")}>{h.text}</span>}
                </span>
              </RadioGroupPrimitive.Item>
            )
          })}
        </RadioGroupPrimitive.Root>
      )}
      <div className="flex flex-col gap-1.5">
        <span id={`${problemId}-type`} className="text-xs font-medium text-foreground">
          {t("type")}
        </span>
        <Segmented
          value={type}
          onValueChange={setType}
          aria-labelledby={`${problemId}-type`}
          options={(["main", "secondary", "suspected"] as const).map((v) => ({ value: v, label: t(`types.${v}`) }))}
        />
      </div>
      <label htmlFor={problemId} className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox id={problemId} checked={problem} onCheckedChange={(v) => setProblem(v === true)} />
        {t(p.sex === "f" ? "problemHer" : "problemHis")}
      </label>
    </ResponsiveDialog>
  )
}

/* ------------------------------------------------------------------ addendum */

/**
 * Overlay · Add to a signed note (Addendum on signed rows / on the signed note). The note and who signed it, Why
 * (select), the addendum, "the signed note stays as it was; the addendum shows under it with your name and the
 * time". Add addendum → addendum-added.
 */
export function AddendumDialog({
  noteId,
  onOpenChange,
  initial,
}: {
  noteId: string
  onOpenChange: (open: boolean) => void
  initial?: { why?: AddendumReason; text?: string; tried?: boolean }
}) {
  const t = useTranslations("records.addendum")
  const b = useB()
  const dates = useDates()
  const role = useRecRole()
  const n = useNote(noteId)
  const e = useEncounter(n?.encounter ?? "")
  const [why, setWhy] = React.useState<AddendumReason | "">(initial?.why ?? "")
  const [text, setText] = React.useState(initial?.text ?? "")
  const [tried, setTried] = React.useState(initial?.tried ?? false)
  if (!n || !e) return null
  const p = patientOf(e.patient)
  const allowed = !!n.signedAt && n.author === ME && recCan(role, "writeNote")
  const signedTime = n.signedAt ? (n.signedAt.slice(0, 10) === n.createdAt.slice(0, 10) ? n.signedAt.slice(11, 16) : `${dates.dayMonth(n.signedAt)} ${n.signedAt.slice(11, 16)}`) : ""

  const add = () => {
    setTried(true)
    if (!allowed || !why || !text.trim()) return
    const cur = getNote(noteId)
    if (!cur) return
    saveNote(addAddendum(cur, { by: ME, at: REC_NOW, why, text: { en: text.trim(), ar: text.trim() } }))
    onOpenChange(false)
    toast.success(t("toast"), { description: t("toastText") })
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={b(p.name)}
      icon="edit-2"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button onClick={add} disabled={!allowed}>
          {t("add")}
        </Button>
      }
    >
      <KvBox
        rows={[
          [
            t("note"),
            <bdi key="n">
              {b(p.name)} · {dates.dayMonth(n.createdAt)} <span className="tabular-nums">{n.createdAt.slice(11, 16)}</span>
            </bdi>,
          ],
          [
            t("signed"),
            <span key="s" className="text-success">
              {b(USERS[n.author].name)} · <span className="tabular-nums">{signedTime}</span>
            </span>,
          ],
        ]}
      />
      {!allowed && (
        <Strip tone="warning" icon="warning-2">
          {t("notYours")}
        </Strip>
      )}
      <Field label={t("why")} required error={tried && !why ? t("whyError") : undefined}>
        {(fp) => (
          <Select value={why} onValueChange={(v) => setWhy(v as AddendumReason)}>
            <SelectTrigger {...fp} className="w-full">
              <SelectValue placeholder={t("whyPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {REASONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {t(`reasons.${r}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      <Field label={t("text")} error={tried && !text.trim() ? t("textError") : undefined}>
        <Textarea rows={3} value={text} onChange={(ev) => setText(ev.target.value)} placeholder={t("textPlaceholder")} />
      </Field>
      <Strip tone="info" icon="info-circle">
        {t("info")}
      </Strip>
    </ResponsiveDialog>
  )
}

/* ------------------------------------------------------------------ new visit note */

const KINDS = ["followUp", "newPatient", "echo"] as const
type VisitKind = (typeof KINDS)[number]

/**
 * New visit note (Visit notes header). Not in the design: the smallest form that starts a note — patient and kind of
 * visit — creating today's visit and a draft note in the doctor's clinic, then opening it.
 */
export function NewNoteDialog({ onOpenChange, onCreated }: { onOpenChange: (open: boolean) => void; onCreated: (noteId: string) => void }) {
  const t = useTranslations("records.newNote")
  const b = useB()
  const [patient, setPatient] = React.useState("")
  const [kind, setKind] = React.useState<VisitKind>("followUp")
  const [tried, setTried] = React.useState(false)
  const id = React.useId()
  const options = Object.entries(PATIENTS).map(([k, x]) => ({ value: k, label: `${b(x.name)} · ${x.mrn}` }))

  const create = () => {
    setTried(true)
    if (!patient) return
    const seq = 3000 + getNotes().filter((n) => n.id.startsWith("VN-2611-3")).length
    const enc = `V-2611-${seq}`
    const noteId = `VN-2611-${seq}`
    const kinds: Record<VisitKind, { en: string; ar: string }> = {
      followUp: { en: "Follow-up", ar: "متابعة" },
      newPatient: { en: "New patient", ar: "مريض جديد" },
      echo: { en: "Echo review", ar: "مراجعة إيكو" },
    }
    const doc = USERS[ME]
    addEncounter(
      { id: enc, patient, doctor: ME, clinic: doc.clinic ?? { en: "Clinic", ar: "العيادة" }, kind: kinds[kind], reason: { en: kinds[kind].en.toLowerCase(), ar: kinds[kind].ar }, at: REC_NOW },
      { id: noteId, encounter: enc, author: ME, createdAt: REC_NOW, subjective: { en: "", ar: "" }, objective: { en: "", ar: "" }, diagnoses: [], orders: [], medicines: [], advice: { en: "", ar: "" }, addenda: [] }
    )
    onOpenChange(false)
    onCreated(noteId)
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("text")}
      icon="note-2"
      width="sm:max-w-120"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={<Button onClick={create}>{t("create")}</Button>}
    >
      <Field label={t("patient")} required error={tried && !patient ? t("patientError") : undefined}>
        {(fp) => <Combobox {...fp} options={options} value={patient} onChange={setPatient} placeholder={t("patientPlaceholder")} searchPlaceholder={t("patientSearch")} emptyText={t("patientEmpty")} />}
      </Field>
      <div className="flex flex-col gap-1.5">
        <span id={`${id}-k`} className="text-xs font-medium text-foreground">
          {t("kind")}
        </span>
        <Segmented value={kind} onValueChange={setKind} aria-labelledby={`${id}-k`} options={KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))} />
      </div>
    </ResponsiveDialog>
  )
}
