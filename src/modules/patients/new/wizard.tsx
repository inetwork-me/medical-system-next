"use client"

import { patientHref } from "@/modules/patients/href"
import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "@/components/ds/toast"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { IfModule } from "@/lib/modules"
import { parseDay, useDates } from "@/i18n/dates"
import { Icon, type IconName } from "@/components/ds/icon"
import { DatePicker } from "@/components/ds/pickers"
import { Segmented } from "@/components/ds/segmented"
import { DropZone, UploadItem, toMb } from "@/components/ds/upload"
import { MobileActionBar, PageContainer } from "@/components/shell/page"
import { PageTitle } from "@/components/shell/page-title"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TODAY, findByNationalId, type Patient, type Tag } from "../data"
import { CheckRow, ChipsField, F, FormCtx, SelectField, SwitchRow, TextField, useFormCtx, type FormCtxValue } from "../edit/fields"
import {
  CITY_REGION,
  ageFrom,
  changedFields,
  optionLabel,
  toLocal,
  validate,
  type AnyKey,
  type EditForm,
  type ErrorKey,
  type FullForm,
} from "../edit/form"
import { UnsavedDialog, useLeaveGuard } from "../edit/leave-guard"
import { useText } from "../profile/use-patient"
import { usePatientsStore } from "../store"

/**
 * Patients · New patient (Step 1–4 + Duplicate found + Done) · 1440 / 768 / 390.
 *  · xl   stepper across · step card + Back / Next · live summary (280: photo, duplicate check, tip)
 *  · md   stepper across · step card · Back / Next (no summary)
 *  · <md  top bar (close · "New patient"), compact stepper, fields stacked, fixed Back / Next bar
 * Steps validate before moving on; step 1 checks the ID against existing files, step 2 the mobile.
 */

type Step = 1 | 2 | 3 | 4

const EMPTY: FullForm = {
  nameEn: "",
  nameAr: "",
  gender: "unset",
  birthDate: "",
  nationality: "sa",
  classification: "regular",
  mobile: "",
  whatsapp: "",
  sameWhatsapp: true,
  email: "",
  language: "ar",
  smsReminders: true,
  whatsappMessages: true,
  idType: "national",
  idNumber: "",
  city: "riyadh",
  district: "",
  street: "",
  postal: "",
  insurer: "",
  insuranceClass: "",
  policy: "",
  expiry: "",
  selfPay: false,
  guardianName: "",
  guardianRelation: "",
  guardianMobile: "",
  guardianId: "",
  bloodType: "unknown",
  clinic: "",
  allergies: [],
  conditions: [],
  notes: "",
  payment: "insurance",
  noAllergies: false,
  emergencyName: "",
  emergencyMobile: "",
  consent: false,
  welcomeSms: true,
}

const STEP_FIELDS: Record<Step, AnyKey[]> = {
  1: ["nameEn", "nameAr", "gender", "birthDate", "nationality", "classification", "idType", "idNumber"],
  2: ["mobile", "whatsapp", "email", "language", "city", "district", "street", "postal"],
  3: ["insurer", "insuranceClass", "policy", "expiry", "bloodType", "allergies", "emergencyName", "emergencyMobile", "guardianName", "guardianRelation", "guardianMobile", "guardianId"],
  4: ["consent"],
}

function validateNew(f: FullForm): Partial<Record<AnyKey, ErrorKey>> {
  const e: Partial<Record<AnyKey, ErrorKey>> = { ...validate({ ...f, selfPay: f.payment === "selfPay" }) }
  if (!f.district.trim()) e.district = "required"
  if (f.payment === "insurance") for (const k of ["insurer", "insuranceClass", "policy", "expiry"] as const) if (!f[k]) e[k] = "required"
  if (f.emergencyMobile && !toLocal(f.emergencyMobile)) e.emergencyMobile = "mobile"
  if (!f.consent) e.consent = "consent"
  return e
}

const DRAFT_KEY = "ms_new_patient_draft"
const readDraft = (): FullForm | null => {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY)
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : null
  } catch {
    return null
  }
}
const writeDraft = (f: FullForm | null) => {
  try {
    if (f) window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(f))
    else window.sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    /* storage unavailable: drafts just don't persist */
  }
}

export function NewPatientWizard() {
  const t = useTranslations("patients.new")
  const { b, locale } = useText()
  const { patients, add } = usePatientsStore()
  const [form, setForm] = React.useState<FullForm>(EMPTY)
  const [step, setStep] = React.useState<Step>(1)
  const [done, setDone] = React.useState<{ mrn: string; name: string; sms: boolean } | null>(null)
  const [touched, setTouched] = React.useState<Set<string>>(() => new Set())
  const [shownSteps, setShownSteps] = React.useState<Set<Step>>(() => new Set())
  const [okDup, setOkDup] = React.useState<Set<string>>(() => new Set())
  const [card, setCard] = React.useState<{ name: string; size: string } | null>(null)
  const top = React.useRef<HTMLDivElement>(null)

  // Restore a draft saved earlier in this session.
  // (Read after mount: sessionStorage doesn't exist during server rendering.)
  React.useEffect(() => {
    const id = window.setTimeout(() => {
      const d = readDraft()
      if (d) {
        setForm(d)
        toast.info(t("draftRestored"), { description: t("draftRestoredText") })
      }
    })
    return () => window.clearTimeout(id)
  }, [t])

  const errors = validateNew(form)
  const age = ageFrom(form.birthDate)
  const minor = age !== null && age < 18
  const stepFields = (s: Step) => STEP_FIELDS[s].filter((k) => minor || !k.startsWith("guardian"))
  const stepErrors = (s: Step) => stepFields(s).filter((k) => errors[k])
  const dirty = !done && changedFields(form, EMPTY).length > 0
  const guard = useLeaveGuard(dirty)

  // Live duplicate check: national ID (step 1) and mobile (step 2).
  const idDigits = form.idNumber.replace(/\D/g, "")
  const byId = idDigits.length === 10 ? findByNationalId(idDigits, patients) : undefined
  const localMobile = toLocal(form.mobile)
  const byMobile = localMobile ? patients.find((p) => p.mobile === localMobile) : undefined
  const dup =
    step === 1 && byId && !okDup.has(`id:${idDigits}`)
      ? { patient: byId, key: `id:${idDigits}`, kind: "id" as const }
      : step === 2 && byMobile && !okDup.has(`m:${localMobile}`)
        ? { patient: byMobile, key: `m:${localMobile}`, kind: "mobile" as const }
        : null

  const ctx: FormCtxValue = {
    form,
    set: (k, v) =>
      setForm((f) => {
        const next = { ...f, [k]: v } as FullForm
        if (k === "sameWhatsapp" && v) next.whatsapp = next.mobile
        if (k === "mobile" && f.sameWhatsapp) next.whatsapp = v as string
        if (k === "payment") {
          next.selfPay = v === "selfPay"
          if (next.selfPay) Object.assign(next, { insurer: "", insuranceClass: "", policy: "", expiry: "" })
        }
        if (k === "noAllergies" && v) next.allergies = []
        return next
      }),
    touch: (k) => setTouched((s) => (s.has(k) ? s : new Set(s).add(k))),
    error: (k) => {
      const e = errors[k]
      const s = (Object.keys(STEP_FIELDS) as unknown as Step[]).find((x) => STEP_FIELDS[x].includes(k))
      return e && (touched.has(k) || (s !== undefined && shownSteps.has(Number(s) as Step))) ? e : undefined
    },
  }

  const scrollTop = () => window.requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
  const goTo = (s: Step) => {
    setStep(s)
    scrollTop()
  }
  const showErrors = (s: Step) => {
    setShownSteps((x) => new Set(x).add(s))
    const first = stepErrors(s)[0]
    window.requestAnimationFrame(() => {
      const el = document.getElementById(`field-${first}`)
      el?.scrollIntoView({ behavior: "smooth", block: "center" })
      el?.querySelector<HTMLElement>("input,button,textarea")?.focus({ preventScroll: true })
    })
  }

  const next = () => {
    if (stepErrors(step).length) return showErrors(step)
    if (dup) {
      document.getElementById("duplicate-found")?.focus()
      return
    }
    if (step < 4) goTo((step + 1) as Step)
  }

  const create = () => {
    const bad = ([1, 2, 3, 4] as Step[]).find((s) => stepErrors(s).length)
    if (bad) {
      setStep(bad)
      return showErrors(bad)
    }
    const region = CITY_REGION[form.city] ?? "other"
    const nameEn = form.nameEn.trim()
    const patient: Omit<Patient, "id" | "mrn"> = {
      initials:
        nameEn
          .split(/\s+/)
          .filter(Boolean)
          .map((w) => w.replace(/^Al-/i, "")[0])
          .slice(0, 2)
          .join("")
          .toUpperCase() || "?",
      name: { en: nameEn, ar: form.nameAr.trim() },
      gender: form.gender,
      age: age ?? 0,
      mobile: toLocal(form.mobile),
      region,
      city: region === "other" ? optionLabel("city", form.city) : undefined,
      branch: "main",
      tags: (form.classification === "vip" ? ["vip"] : []) as Tag[],
      lastVisit: "",
      visits: 0,
      registered: TODAY,
    }
    const { payment, noAllergies, emergencyName, emergencyMobile, consent, welcomeSms, ...rest } = form
    void payment
    void noAllergies
    void emergencyName
    void emergencyMobile
    void consent
    const edit: EditForm = { ...rest, bloodType: form.bloodType === "unknown" ? "" : form.bloodType }
    const mrn = add(patient, edit)
    guard.allow()
    writeDraft(null)
    setDone({ mrn, name: b(patient.name), sms: welcomeSms })
    scrollTop()
  }

  const reset = () => {
    setForm(EMPTY)
    setTouched(new Set())
    setShownSteps(new Set())
    setOkDup(new Set())
    setCard(null)
    setDone(null)
    setStep(1)
    scrollTop()
  }

  const saveDraft = () => {
    writeDraft(form)
    toast.info(t("draft"), { description: t("draftText") })
  }
  const cancel = () => guard.leave(`/${locale}/patients`)

  return (
    <FormCtx.Provider value={ctx}>
      {/* Mobile top bar */}
      <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
        {!done && (
          <Button variant="ghost" size="icon" aria-label={t("cancel")} onClick={cancel}>
            <Icon name="close-circle" size={24} />
          </Button>
        )}
        <h1 className={cn("min-w-0 flex-1 truncate text-lg font-semibold", done && "ps-1")}>{t("mobileTitle")}</h1>
      </div>

      <PageContainer className="gap-4 md:gap-6">
        <WizardTitle />
        <div ref={top} className="hidden scroll-mt-24 items-center justify-end gap-3 md:flex">
          {!done && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={saveDraft}>
                <Icon name="document-download" size={20} />
                {t("saveDraft")}
              </Button>
              <Button variant="outline" onClick={cancel}>
                <Icon name="close-circle" size={20} />
                {t("cancel")}
              </Button>
            </div>
          )}
        </div>

        {done ? (
          <Success {...done} onAnother={reset} />
        ) : (
          <>
            <Stepper step={step} onGo={(s) => s < step && goTo(s)} />
            {dup && (
              <DuplicateCard
                patient={dup.patient}
                kind={dup.kind}
                value={dup.kind === "id" ? form.idNumber : form.mobile}
                onContinue={() => {
                  setOkDup((s) => new Set(s).add(dup.key))
                  if (!stepErrors(step).length && step < 4) goTo((step + 1) as Step)
                }}
              />
            )}
            <div className="grid items-start gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="flex min-w-0 flex-col gap-5">
                {step === 4 ? <Review onEdit={goTo} /> : <StepCard step={step} minor={minor} card={card} setCard={setCard} />}
                <div className="hidden items-center gap-2 md:flex">
                  {step > 1 && (
                    <Button variant="outline" onClick={() => goTo((step - 1) as Step)}>
                      <Icon name="arrow-left" size={20} />
                      {t("back")}
                    </Button>
                  )}
                  <span className="flex-1" />
                  {step < 4 ? (
                    <Button onClick={next}>
                      {t("next")}
                      <Icon name="arrow-right" size={20} />
                    </Button>
                  ) : (
                    <Button onClick={create}>
                      <Icon name="tick-circle" size={20} />
                      {t("create")}
                    </Button>
                  )}
                </div>
              </div>
              <Summary dupShown={!!dup} checked={idDigits.length === 10 && !byId} count={patients.length} />
            </div>
            <MobileActionBar>
              {step > 1 && (
                <Button variant="outline" size="lg" onClick={() => goTo((step - 1) as Step)}>
                  <Icon name="arrow-left" size={20} />
                  {t("back")}
                </Button>
              )}
              {step < 4 ? (
                <Button size="lg" onClick={next}>
                  {t("next")}
                  <Icon name="arrow-right" size={20} />
                </Button>
              ) : (
                <Button size="lg" onClick={create}>
                  <Icon name="tick-circle" size={20} />
                  {t("create")}
                </Button>
              )}
            </MobileActionBar>
          </>
        )}
      </PageContainer>
      <UnsavedDialog guard={guard} count={changedFields(form, EMPTY).length} />
    </FormCtx.Provider>
  )
}

function WizardTitle() {
  const t = useTranslations("patients")
  return <PageTitle title={t("new.title")} back="/patients" crumbs={[{ label: t("title"), href: "/patients" }]} />
}

/* ================================================================== stepper */

const STEP_KEYS = ["s1", "s2", "s3", "s4"] as const

function Stepper({ step, onGo }: { step: Step; onGo: (s: Step) => void }) {
  const t = useTranslations("patients.new")
  return (
    <>
      {/* Full (md+) */}
      <ol className="hidden items-center gap-1.5 rounded-xl border bg-card px-4 py-4 md:flex lg:gap-2 lg:px-5" aria-label={t("progress")}>
        {STEP_KEYS.map((k, i) => {
          const n = (i + 1) as Step
          const state = n < step ? "done" : n === step ? "current" : "next"
          return (
            <React.Fragment key={k}>
              <li className="flex shrink-0 items-center gap-2 lg:gap-2.5" aria-current={state === "current" ? "step" : undefined}>
                <button
                  type="button"
                  disabled={state !== "done"}
                  onClick={() => onGo(n)}
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    state === "done" && "cursor-pointer bg-success text-primary-foreground",
                    state === "current" && "bg-primary text-primary-foreground",
                    state === "next" && "border text-muted-foreground"
                  )}
                  aria-label={`${t("step", { n })} · ${t(`steps.${k}`)}`}
                >
                  {state === "done" ? <Icon name="tick-circle" size={16} /> : n}
                </button>
                <span className="flex flex-col">
                  <span className="text-xs text-muted-foreground">{t("step", { n })}</span>
                  <span className={cn("text-sm font-medium", state === "next" ? "text-muted-foreground" : "text-foreground")}>{t(`steps.${k}`)}</span>
                </span>
              </li>
              {n < 4 && <li aria-hidden className={cn("h-0.5 min-w-2 flex-1 rounded-full lg:min-w-4", n < step ? "bg-success" : "bg-border")} />}
            </React.Fragment>
          )
        })}
      </ol>
      {/* Compact (mobile) */}
      <div className="flex flex-col gap-2.5 rounded-xl border bg-card p-4 md:hidden">
        <div className="flex items-center gap-2">
          <span className="flex-1 text-xs text-muted-foreground">{t("stepOf", { n: step, total: 4 })}</span>
          <span className="text-sm font-medium">{t(`steps.${STEP_KEYS[step - 1]}`)}</span>
        </div>
        <div className="flex gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step} aria-label={t("progress")}>
          {STEP_KEYS.map((k, i) => (
            <span key={k} className={cn("h-1.5 flex-1 rounded-full", i < step ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
      </div>
    </>
  )
}

/* ================================================================== duplicate found */

function DuplicateCard({ patient, kind, value, onContinue }: { patient: Patient; kind: "id" | "mobile"; value: string; onContinue: () => void }) {
  const t = useTranslations("patients")
  const { b } = useText()
  const dates = useDates()
  return (
    <div
      id="duplicate-found"
      tabIndex={-1}
      role="alert"
      className="flex flex-col gap-2 rounded-xl bg-warning-soft p-4 text-warning-soft-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-warning/40"
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <Icon name="people" size={18} />
        {t("new.duplicate.title")}
      </p>
      <p className="text-xs tabular-nums">
        {kind === "id"
          ? t("new.duplicate.byId", { name: b(patient.name), mrn: patient.mrn, id: value })
          : t("new.duplicate.byMobile", { name: b(patient.name), mrn: patient.mrn, mobile: value })}
      </p>
      <p className="text-xs tabular-nums">
        {patient.lastVisit
          ? t("new.duplicate.lastVisit", { date: dates.short(patient.lastVisit), branch: t(`branches.${patient.branch}`).split(" · ").pop()! })
          : t("new.duplicate.noVisit")}
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" asChild>
          <Link href={patientHref(patient.id)}>
            <Icon name="eye" size={16} />
            {t("new.duplicate.open")}
          </Link>
        </Button>
        <Button size="sm" variant="outline" onClick={onContinue}>
          {t("new.duplicate.continue")}
        </Button>
      </div>
    </div>
  )
}

/* ================================================================== step cards */

const STEP_ICON: Record<1 | 2 | 3, IconName> = { 1: "user", 2: "call", 3: "shield-tick" }

function StepCard({
  step,
  minor,
  card,
  setCard,
}: {
  step: 1 | 2 | 3
  minor: boolean
  card: { name: string; size: string } | null
  setCard: (c: { name: string; size: string } | null) => void
}) {
  const t = useTranslations("patients.new")
  const tf = useTranslations("patients.edit.fields")
  const te = useTranslations("patients.edit")
  const { form, set } = useFormCtx()
  const age = ageFrom(form.birthDate ?? "")
  const insurance = form.payment !== "selfPay"
  return (
    <section aria-labelledby="step-title" className="@container/sec flex flex-col gap-4.5 rounded-xl border bg-card p-4 md:p-6">
      <header className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
          <Icon name={STEP_ICON[step]} size={18} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id="step-title" className="text-lg font-semibold">
            {t(`forms.s${step}.title`)}
          </h2>
          <p className="text-xs text-muted-foreground">{t(`forms.s${step}.description`)}</p>
        </div>
      </header>
      {step === 3 && (
        <p className="flex items-center gap-2.5 rounded-lg bg-info-soft p-3 text-xs text-info-soft-foreground">
          <Icon name="info-circle" size={18} className="shrink-0" />
          {minor ? t("guardianNeeded") : t("guardianInfo")}
        </p>
      )}
      {step === 3 &&
        insurance &&
        (card ? (
          <UploadItem name={card.name} state="complete" totalMb={card.size} onRemove={() => setCard(null)} />
        ) : (
          <DropZone multiple={false} onFiles={([f]) => setCard({ name: f.name, size: toMb(f.size) })} />
        ))}
      <div className="grid gap-4 @min-[30rem]/sec:grid-cols-2">
        {step === 1 && (
          <>
            <TextField k="nameEn" required dir="ltr" autoComplete="name" />
            <TextField k="nameAr" required dir="rtl" lang="ar" />
            <F k="gender" required>
              {() => (
                <Segmented
                  aria-label={tf("gender")}
                  value={form.gender === "unset" ? ("" as "male") : form.gender}
                  onValueChange={(v) => set("gender", v)}
                  options={[
                    { value: "male", label: tf("male") },
                    { value: "female", label: tf("female") },
                  ]}
                />
              )}
            </F>
            <F k="birthDate" required helper={age !== null && age >= 0 ? tf(age < 18 ? "minor" : "adult", { age }) : undefined}>
              {(c) => (
                <DatePicker
                  {...c}
                  value={form.birthDate ? parseDay(form.birthDate) : undefined}
                  onChange={(d) => set("birthDate", d ? d.toISOString().slice(0, 10) : "")}
                  placeholder={tf("birthPlaceholder")}
                />
              )}
            </F>
            <SelectField k="nationality" options="nationality" required />
            <SelectField k="classification" options="classification" />
            <SelectField k="idType" options="idType" required />
            <F k="idNumber" required helper={tf("idHelper")}>
              {(c) => (
                <IdInput c={c} placeholder={form.idType === "passport" ? tf("passportPlaceholder") : tf("idPlaceholder")} />
              )}
            </F>
          </>
        )}
        {step === 2 && (
          <>
            <TextField k="mobile" required dir="ltr" type="tel" icon="call" inputMode="tel" autoComplete="tel" placeholder="+966 5X XXX XXXX" />
            <TextField k="whatsapp" dir="ltr" type="tel" icon="message" inputMode="tel" readOnly={form.sameWhatsapp} placeholder="+966 5X XXX XXXX" />
            <CheckRow k="sameWhatsapp" wide />
            <TextField k="email" dir="ltr" type="email" icon="sms" autoComplete="email" placeholder="name@example.com" />
            <SelectField k="language" options="language" />
            <SelectField k="city" options="city" required />
            <TextField k="district" required />
            <TextField k="street" required placeholder={tf("streetPlaceholder")} autoComplete="street-address" />
            <TextField k="postal" dir="ltr" inputMode="numeric" placeholder={tf("postalPlaceholder")} autoComplete="postal-code" />
            <SwitchRow k="smsReminders" hint={tf("smsRemindersHint")} wide={false} />
            <SwitchRow k="whatsappMessages" hint={tf("whatsappMessagesHint")} wide={false} />
          </>
        )}
        {step === 3 && (
          <>
            <F k="payment" required wide>
              {() => (
                <Segmented
                  aria-label={tf("payment")}
                  value={form.payment ?? "insurance"}
                  onValueChange={(v) => set("payment", v)}
                  options={[
                    { value: "insurance", label: tf("insurancePay") },
                    { value: "selfPay", label: tf("selfPayShort") },
                  ]}
                />
              )}
            </F>
            {insurance && (
              <>
                <SelectField k="insurer" options="insurer" required />
                <SelectField k="insuranceClass" options="insuranceClass" required />
                <TextField k="policy" dir="ltr" required />
                <F k="expiry" required>
                  {(c) => (
                    <DatePicker
                      {...c}
                      value={form.expiry ? parseDay(form.expiry) : undefined}
                      onChange={(d) => set("expiry", d ? d.toISOString().slice(0, 10) : "")}
                      placeholder={tf("birthPlaceholder")}
                    />
                  )}
                </F>
              </>
            )}
            <SelectField k="bloodType" options="bloodTypeOrUnknown" />
            <div className="flex items-start pt-0.5">
              <CheckRow k="noAllergies" />
            </div>
            {!form.noAllergies && <ChipsField k="allergies" tone="destructive" add={tf("addAllergy")} />}
            <TextField k="emergencyName" />
            <TextField k="emergencyMobile" dir="ltr" type="tel" icon="call" inputMode="tel" placeholder="+966 5X XXX XXXX" />
            {minor && (
              <>
                <p className="pt-2 text-sm font-semibold @min-[30rem]/sec:col-span-2">{te("sections.guardian.title")}</p>
                <TextField k="guardianName" required />
                <SelectField k="guardianRelation" options="guardianRelation" required />
                <TextField k="guardianMobile" required dir="ltr" type="tel" icon="call" inputMode="tel" placeholder="+966 5X XXX XXXX" />
                <TextField k="guardianId" dir="ltr" inputMode="numeric" placeholder={tf("idPlaceholder")} />
              </>
            )}
          </>
        )}
      </div>
    </section>
  )
}

/** ID number: digits grouped "1087 334 902" for national ID / iqama, free text for passports. */
function IdInput({ c, placeholder }: { c: React.ComponentProps<"input">; placeholder: string }) {
  const { form, set, touch } = useFormCtx()
  const passport = form.idType === "passport"
  const fmt = (v: string) => {
    if (passport) return v.toUpperCase().slice(0, 9)
    const d = v.replace(/\D/g, "").slice(0, 10)
    return [d.slice(0, 4), d.slice(4, 7), d.slice(7)].filter(Boolean).join(" ")
  }
  return (
    <input
      {...c}
      dir="ltr"
      inputMode={passport ? "text" : "numeric"}
      autoComplete="off"
      value={form.idNumber}
      placeholder={placeholder}
      onChange={(e) => set("idNumber", fmt(e.target.value))}
      onBlur={() => touch("idNumber")}
      data-slot="input"
      className="flex h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 text-base shadow-xs outline-none transition-[color,box-shadow,border-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 md:text-sm rtl:text-right"
    />
  )
}

/* ================================================================== review */

function Review({ onEdit }: { onEdit: (s: Step) => void }) {
  const t = useTranslations("patients")
  const { form } = useFormCtx()
  const { b } = useText()
  const dates = useDates()
  const f = form as FullForm
  const age = ageFrom(f.birthDate)
  const L = (k: Parameters<typeof optionLabel>[0], v: string) => {
    const x = optionLabel(k, v)
    return x ? b(x) : "—"
  }
  const ltr = (v: string) => (v ? <bdi dir="ltr">{v}</bdi> : "—")
  const reminders = [f.smsReminders && t("new.review.sms"), f.whatsappMessages && t("new.review.whatsapp")].filter(Boolean).join(" · ")
  const minor = age !== null && age < 18
  const cards: { n: Step; rows: [string, React.ReactNode][] }[] = [
    {
      n: 1,
      rows: [
        [t("new.review.name"), b({ en: f.nameEn || "—", ar: f.nameAr || f.nameEn || "—" })],
        [t("new.review.genderAge"), `${f.gender === "unset" ? "—" : t(`gender.single.${f.gender}`)} · ${age !== null ? t("new.summary.years", { n: age }) : "—"}`],
        [t("new.review.birth"), f.birthDate ? dates.numeric(f.birthDate) : "—"],
        [t("new.review.nationality"), L("nationality", f.nationality)],
        [L("idType", f.idType), ltr(f.idNumber)],
      ],
    },
    {
      n: 2,
      rows: [
        [t("new.review.mobile"), ltr(f.mobile)],
        [t("new.review.email"), ltr(f.email)],
        [t("new.review.address"), [L("city", f.city), f.district, f.street].filter((x) => x && x !== "—").join(" · ")],
        [t("new.review.reminders"), reminders || t("new.review.remindersNone")],
      ],
    },
    {
      n: 3,
      rows: [
        [t("new.review.insurance"), f.payment === "selfPay" ? t("new.review.selfPay") : [L("insurer", f.insurer), L("insuranceClass", f.insuranceClass)].join(" · ")],
        ...(f.payment === "selfPay" ? [] : ([[t("new.review.policy"), ltr(f.policy)]] as [string, React.ReactNode][])),
        [t("new.review.allergies"), f.noAllergies ? t("new.review.noneKnown") : f.allergies.length ? f.allergies.join(locale_sep(b)) : t("new.review.notRecorded")],
        [t("new.review.emergency"), f.emergencyName || "—"],
        [t("new.review.emergencyMobile"), ltr(f.emergencyMobile)],
        ...(minor
          ? ([
              [t("new.review.guardian"), f.guardianName ? `${f.guardianName} · ${L("guardianRelation", f.guardianRelation)}` : "—"],
              [t("new.review.guardianMobile"), ltr(f.guardianMobile)],
            ] as [string, React.ReactNode][])
          : []),
      ],
    },
  ]
  return (
    <div className="flex flex-col gap-4">
      {cards.map((c) => (
        <section key={c.n} className="@container/sec flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-6" aria-labelledby={`review-${c.n}`}>
          <header className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2 id={`review-${c.n}`} className="text-lg font-semibold">
                {t(`new.steps.s${c.n}`)}
              </h2>
              <p className="text-xs text-muted-foreground">{t("new.step", { n: c.n })}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onEdit(c.n)}>
              <Icon name="edit-2" size={16} />
              {t("new.review.edit")}
            </Button>
          </header>
          <dl className="grid gap-x-6 @min-[30rem]/sec:grid-cols-2">
            {c.rows.map(([k, v]) => (
              <div key={k} className="flex min-w-0 flex-col gap-0.5 py-2">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="text-sm font-medium tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <section className="@container/sec flex flex-col gap-2.5 rounded-xl border bg-card p-4">
        <CheckRow k="consent" />
        <CheckRow k="welcomeSms" />
      </section>
    </div>
  )
}

/** Arabic lists use the Arabic comma. */
const locale_sep = (b: (v: { en: string; ar: string }) => string) => b({ en: ", ", ar: "، " })

/* ================================================================== summary (xl) */

function Summary({ dupShown, checked, count }: { dupShown: boolean; checked: boolean; count: number }) {
  const t = useTranslations("patients")
  const { form } = useFormCtx()
  const { b, n } = useText()
  const age = ageFrom(form.birthDate ?? "")
  const name = b({ en: form.nameEn.trim(), ar: form.nameAr.trim() || form.nameEn.trim() })
  const initials = form.nameEn
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/^Al-/i, "")[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
  const meta = [
    form.gender === "unset" ? null : t(`gender.single.${form.gender}`),
    age !== null ? t("new.summary.years", { n: age }) : null,
    optionLabel("nationality", form.nationality) ? b(optionLabel("nationality", form.nationality)!) : null,
  ]
    .filter(Boolean)
    .join(" · ")
  return (
    <aside className="hidden flex-col gap-4 xl:sticky xl:top-22 xl:flex">
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-5 text-center">
        <div className="flex size-18 items-center justify-center rounded-xl bg-accent text-xl font-semibold text-accent-foreground" aria-hidden>
          {initials || <Icon name="user" size={28} />}
        </div>
        <p className="text-lg font-semibold">{name || t("new.summary.newPatient")}</p>
        {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
        <Badge variant="secondary">{t("new.summary.mrnAfter")}</Badge>
      </div>
      {!dupShown && checked && (
        <div className="flex flex-col gap-1.5 rounded-xl bg-success-soft p-4 text-success-soft-foreground" role="status">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Icon name="tick-circle" size={18} />
            {t("new.summary.noMatch")}
          </p>
          <p className="text-xs">{t("new.summary.noMatchText", { count: n(count) })}</p>
        </div>
      )}
      <div className="flex flex-col gap-1.5 rounded-xl bg-muted p-4">
        <p className="text-xs font-medium">{t("new.summary.tip")}</p>
        <p className="text-xs text-muted-foreground">{t("new.summary.tipText")}</p>
      </div>
    </aside>
  )
}

/* ================================================================== done */

function Success({ mrn, name, sms, onAnother }: { mrn: string; name: string; sms: boolean; onAnother: () => void }) {
  const t = useTranslations("patients.new")
  return (
    <div className="flex justify-center md:py-8 xl:py-12">
      <section className="flex w-full max-w-140 flex-col items-center gap-4 rounded-2xl border bg-card p-8 text-center" role="status">
        <span className="flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
          <Icon name="tick-circle" size={32} />
        </span>
        <h2 className="text-2xl font-semibold">{t("done.title")}</h2>
        <p className="text-sm text-muted-foreground">{sms ? t("done.text", { name }) : t("done.textNoSms", { name })}</p>
        <p className="flex items-center gap-2 rounded-lg bg-muted px-3.5 py-2">
          <span className="text-xs text-muted-foreground">{t("done.fileNumber")}</span>
          <bdi dir="ltr" className="text-sm font-medium tabular-nums">
            MRN {mrn}
          </bdi>
        </p>
        <div className="flex w-full flex-col gap-2">
          <IfModule
            id="appointments"
            fallback={
              <Button size="lg" asChild>
                <Link href={patientHref(mrn)}>
                  <Icon name="profile-circle" size={20} />
                  {t("done.open")}
                </Link>
              </Button>
            }
          >
            <Button size="lg" asChild>
              <Link href={patientHref(mrn, undefined, { action: "book" })}>
                <Icon name="calendar-add" size={20} />
                {t("done.book")}
              </Link>
            </Button>
          </IfModule>
          <Button size="lg" variant="outline" onClick={onAnother}>
            <Icon name="user-add" size={20} />
            {t("done.another")}
          </Button>
          <Button size="lg" variant="ghost" asChild>
            <Link href="/patients">
              <Icon name="arrow-left" size={20} />
              {t("done.list")}
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
