"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import type { Bi } from "@/lib/mock/bi"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { Widget } from "@/components/ds/widget"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SPECIALTIES } from "@/modules/clinics/data"
import { SwitchCard } from "@/modules/clinics/parts"
import { useClinics } from "@/modules/clinics/store"
import { OPTIONS } from "@/modules/patients/edit/form"
import { LANGUAGES, SCFHS_PATTERN, SYSTEM_ROLES, contactOf, languageKeys, languagesOf, type Doctor, type Grade, type SystemRole } from "./data"
import { useDoctorText } from "./text"

/* ================================================================== form model */

export type ProfileForm = {
  nameEn: string
  nameAr: string
  gender: "" | "male" | "female"
  nationality: string
  languages: string[]
  specialty: string
  grade: "" | Grade
  scfhs: string
  years: string
  clinic: string
  room: string
  online: boolean
  acceptsNew: boolean
  mobile: string
  email: string
  role: SystemRole
  ext: string
  ePrescribing: boolean
}
export type ProfileErrors = Partial<Record<keyof ProfileForm, string>>

const GRADES: Grade[] = ["consultant", "specialist", "resident"]
const stripDr = (s: string) => s.replace(/^(Dr\.|د\.)\s*/, "").trim()

/** The form for a saved doctor; the specialty defaults to the main clinic's. */
export function profileOf(d: Doctor, clinicSpecialty?: Bi): ProfileForm {
  const c = contactOf(d)
  return {
    nameEn: stripDr(d.name.en),
    nameAr: stripDr(d.name.ar),
    gender: d.female ? "female" : "male",
    nationality: c.nationality,
    languages: languageKeys(d.languages),
    specialty: (d.specialty ?? clinicSpecialty)?.en ?? "",
    grade: d.grade,
    scfhs: d.credentials.find((x) => x.type === "scfhs")?.number ?? "",
    years: String(d.yearsExp),
    clinic: d.clinic,
    room: d.room,
    online: d.booking.online,
    acceptsNew: d.booking.acceptsNew,
    mobile: c.mobile,
    email: c.email,
    role: c.role,
    ext: d.ext,
    ePrescribing: c.ePrescribing,
  }
}

export const EMPTY_PROFILE: ProfileForm = {
  nameEn: "",
  nameAr: "",
  gender: "",
  nationality: "",
  languages: ["ar"],
  specialty: "",
  grade: "",
  scfhs: "",
  years: "",
  clinic: "",
  room: "",
  online: true,
  acceptsNew: true,
  mobile: "",
  email: "",
  role: "doctor",
  ext: "",
  ePrescribing: true,
}

export function validateProfile(f: ProfileForm, t: (k: "required" | "scfhsInvalid" | "extInvalid" | "emailInvalid") => string): ProfileErrors {
  const e: ProfileErrors = {}
  for (const k of ["nameEn", "nameAr", "gender", "specialty", "grade", "scfhs", "clinic"] as const) if (!f[k].trim()) e[k] = t("required")
  if (f.scfhs.trim() && !SCFHS_PATTERN.test(f.scfhs.trim().toUpperCase())) e.scfhs = t("scfhsInvalid")
  if (f.ext && !/^\d{4}$/.test(f.ext)) e.ext = t("extInvalid")
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = t("emailInvalid")
  return e
}

/** The doctor fields a valid form writes (title follows grade + specialty when either changed). */
export function profileFields(f: ProfileForm, base: Doctor, gradeLabel: (g: Grade, female: boolean) => Bi): Partial<Doctor> {
  const female = f.gender === "female"
  const spec = SPECIALTIES.find((s) => s.en === f.specialty)
  const grade = (f.grade || base.grade) as Grade
  const scfhs = f.scfhs.trim().toUpperCase()
  const credentials = base.credentials.some((c) => c.type === "scfhs")
    ? base.credentials.map((c) => (c.type === "scfhs" ? { ...c, number: scfhs } : c))
    : base.credentials
  const nameEn = `Dr. ${f.nameEn.trim()}`
  const nameAr = `د. ${f.nameAr.trim()}`
  const changedTitle = grade !== base.grade || (spec && spec.en !== base.specialty?.en)
  const g = gradeLabel(grade, female)
  return {
    name: { en: nameEn, ar: nameAr },
    initials: f.nameEn.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").filter(Boolean).slice(0, 2).join("") || base.initials,
    female,
    nationality: f.nationality || undefined,
    languages: f.languages.length ? languagesOf(f.languages) : base.languages,
    ...(spec ? { specialty: spec } : {}),
    grade,
    ...(changedTitle && spec ? { title: { en: `${g.en} · ${spec.en}`, ar: `${g.ar} · ${spec.ar}` } } : {}),
    credentials,
    yearsExp: Number(f.years) || 0,
    clinic: f.clinic,
    room: f.room,
    booking: { ...base.booking, online: f.online, acceptsNew: f.acceptsNew },
    mobile: f.mobile.trim(),
    email: f.email.trim(),
    role: f.role,
    ext: f.ext,
    ePrescribing: f.ePrescribing,
  }
}

/** Form state + "tried" (errors show after the first Save / Create). */
export function useProfileForm(initial: () => ProfileForm) {
  const [form, setForm] = React.useState<ProfileForm>(initial)
  const [tried, setTried] = React.useState(false)
  const set = <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) =>
    setForm((f) => ({ ...f, [k]: v, ...(k === "clinic" ? { room: "" } : {}) }))
  return { form, setForm, set, tried, setTried }
}

/** Form validation never toasts (DS sheet 12): field errors + an Alert on top, focus goes to the first bad field. */
export const focusInvalid = () => requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus())

/* ================================================================== Widget / Doctor Profile Form · New Doctor Form */

/**
 * Sections: Personal details · Professional · Clinic & booking · Contact & system access · [Deactivate doctor].
 * Two columns when the card is wide (≥ 36rem), one on mobile — the same recipe as the Clinics settings form.
 */
export function DoctorProfileForm({
  form,
  set,
  errors,
  danger,
}: {
  form: ProfileForm
  set: <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) => void
  errors: ProfileErrors
  danger?: React.ReactNode
}) {
  const t = useTranslations("doctors.profile")
  const tg = useTranslations("doctors.credTab")
  const { b } = useDoctorText()
  const clinics = useClinics().filter((c) => !c.archived)
  const clinic = clinics.find((c) => c.key === form.clinic)
  const rooms = [...new Set([...(clinic?.rooms.map((r) => r.number) ?? []), ...(form.room ? [form.room] : [])])]

  const select = (k: "gender" | "nationality" | "specialty" | "grade" | "clinic" | "room" | "role", label: string, options: { value: string; label: string }[], opts: { required?: boolean; ph?: string } = {}) => (
    <Field label={label} required={opts.required} error={errors[k]}>
      {(p) => (
        <Select value={(form[k] as string) || undefined} onValueChange={(v) => set(k, v as never)}>
          <SelectTrigger {...p} className="w-full">
            <SelectValue placeholder={opts.ph ?? t("choose")} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  )
  const text = (k: "nameEn" | "nameAr" | "scfhs" | "years" | "mobile" | "email" | "ext", label: string, opts: { required?: boolean; ph?: string; dir?: "ltr" | "rtl"; inputMode?: "numeric" | "tel" | "email" } = {}) => (
    <Field label={label} required={opts.required} error={errors[k]}>
      <Input value={form[k]} onChange={(e) => set(k, e.target.value)} placeholder={opts.ph} dir={opts.dir} inputMode={opts.inputMode} />
    </Field>
  )
  const section = (title: string, desc: string, children: React.ReactNode, extra?: React.ReactNode) => (
    <Widget title={title} description={desc} className="gap-4 p-4 md:p-6">
      <div className="@container/form">
        <div className="grid grid-cols-1 gap-4 @xl/form:grid-cols-2">{children}</div>
      </div>
      {extra}
    </Widget>
  )
  const langLabel = LANGUAGES.filter((l) => form.languages.includes(l.key))
    .map((l) => b(l.name))
    .join(b({ en: ", ", ar: "، " }))

  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      {Object.keys(errors).length > 0 && (
        <Alert variant="destructive">
          <Icon name="danger" />
          <AlertTitle>{t("fixErrors")}</AlertTitle>
        </Alert>
      )}
      {section(
        t("personal"),
        t("personalText"),
        <>
          {text("nameEn", t("nameEn"), { required: true, ph: t("nameEnPh"), dir: "ltr" })}
          {text("nameAr", t("nameAr"), { required: true, ph: t("nameArPh") })}
          {select("gender", t("gender"), [{ value: "male", label: t("male") }, { value: "female", label: t("female") }], { required: true })}
          {select("nationality", t("nationality"), OPTIONS.nationality.map((o) => ({ value: o.value, label: b(o.label) })))}
          <Field label={t("languages")} className="@xl/form:col-span-2">
            {(p) => (
              <DropdownMenu>
                <DropdownMenuTrigger
                  {...p}
                  className={cn(
                    "flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-sm whitespace-nowrap shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    !langLabel && "text-muted-foreground"
                  )}
                >
                  <span className="truncate">{langLabel || t("choose")}</span>
                  <Icon name="arrow-down" size={16} className="text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
                  {LANGUAGES.map((l) => (
                    <DropdownMenuCheckboxItem
                      key={l.key}
                      checked={form.languages.includes(l.key)}
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={(on) => set("languages", on ? [...form.languages, l.key] : form.languages.filter((x) => x !== l.key))}
                    >
                      {b(l.name)}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </Field>
        </>
      )}
      {section(
        t("professional"),
        t("professionalText"),
        <>
          {select("specialty", t("specialty"), SPECIALTIES.map((s) => ({ value: s.en, label: b(s) })), { required: true, ph: t("specialtyPh") })}
          {select("grade", t("grade"), GRADES.map((g) => ({ value: g, label: tg(`${form.gender === "female" ? "gradeF" : "grade"}.${g}`) })), { required: true })}
          {text("scfhs", t("scfhs"), { required: true, ph: "XX-00-0000000", dir: "ltr" })}
          {text("years", t("years"), { ph: "0", dir: "ltr", inputMode: "numeric" })}
        </>
      )}
      {section(
        t("clinicBooking"),
        t("clinicBookingText"),
        <>
          {select("clinic", t("mainClinic"), clinics.map((c) => ({ value: c.key, label: b(c.name) })), { required: true, ph: t("mainClinicPh") })}
          {select("room", t("room"), rooms.map((r) => ({ value: r, label: t("roomValue", { n: r }) })), { ph: t("roomPh") })}
        </>,
        <>
          <SwitchCard label={t("online")} hint={t("onlineText")} checked={form.online} onCheckedChange={(v) => set("online", v)} />
          <SwitchCard label={t("acceptsNew")} checked={form.acceptsNew} onCheckedChange={(v) => set("acceptsNew", v)} />
        </>
      )}
      {section(
        t("contact"),
        t("contactText"),
        <>
          {text("mobile", t("mobile"), { ph: "+966…", dir: "ltr", inputMode: "tel" })}
          {text("email", t("email"), { ph: "name@alnoor.sa", dir: "ltr", inputMode: "email" })}
          {select("role", t("role"), SYSTEM_ROLES.map((r) => ({ value: r, label: t(`roles.${r}`) })))}
          {text("ext", t("ext"), { ph: t("extPh"), dir: "ltr", inputMode: "numeric" })}
        </>,
        <SwitchCard label={t("ePrescribing")} hint={t("ePrescribingText")} checked={form.ePrescribing} onCheckedChange={(v) => set("ePrescribing", v)} />
      )}
      {danger}
    </div>
  )
}
