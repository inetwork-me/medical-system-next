"use client"

import { patientHref } from "@/modules/patients/href"
import * as React from "react"
import { useTranslations } from "next-intl"
import { notify } from "@/components/ds/toast"

import { cn } from "@/lib/utils"
import { Link, useRouter } from "@/i18n/navigation"
import { useDates, parseDay } from "@/i18n/dates"
import { Icon, type IconName } from "@/components/ds/icon"
import { DatePicker } from "@/components/ds/pickers"
import { Segmented } from "@/components/ds/segmented"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge } from "@/components/ds/status-badge"
import { MobileActionBar, PageContainer } from "@/components/shell/page"
import { PageTitle } from "@/components/shell/page-title"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import type { Patient, Tag } from "../data"
import { usePatient, useText } from "../profile/use-patient"
import { usePatientsStore } from "../store"
import { UnsavedDialog, useLeaveGuard } from "./leave-guard"
import { ChipsField, F, FormCtx, SelectField, SwitchRow, TextField, useFormCtx, type FormCtxValue } from "./fields"
import {
  CITY_REGION,
  CORE_REQUIRED,
  SECTIONS,
  ageFrom,
  changedFields,
  initialForm,
  optionLabel,
  sectionOf,
  toLocal,
  validate,
  type EditForm,
  type AnyKey,
  type ErrorKey,
  type FieldKey,
  type SectionKey,
} from "./form"

/**
 * Patients · Patient edit (1440 / 768 / 390) + Errors state + Unsaved-changes overlay.
 *  · xl   section nav (220, sticky) · form · completeness + duplicate (280, sticky)
 *  · md   completeness on top, then the sections (fields 2 across)
 *  · <md  edit bar (close · title) instead of the app bar, fields stacked, fixed Save bar
 * Fields that were already missing show their error at once (as designed); others after blur or Save.
 */
export function EditPatient() {
  const t = useTranslations("patients")
  const data = usePatient()
  if (!data) {
    return (
      <PageContainer>
        <div className="rounded-xl border bg-card">
          <EmptyState icon="profile-2user" title={t("page.notFoundTitle")} description={t("page.notFoundText")} className="py-16" />
        </div>
      </PageContainer>
    )
  }
  return <EditForm_ key={data.patient.id} patient={data.patient} record={data.record} />
}

type Data = NonNullable<ReturnType<typeof usePatient>>


function EditForm_({ patient: p, record }: { patient: Patient; record: Data["record"] }) {
  const t = useTranslations("patients.edit")
  const tp = useTranslations("patients")
  const { b, locale } = useText()
  const router = useRouter()
  const { save, savedForm } = usePatientsStore()
  const [initial] = React.useState<EditForm>(() => savedForm(p.id) ?? initialForm(p, record, locale))
  const [form, setForm] = React.useState(initial)
  const [touched, setTouched] = React.useState<Set<string>>(() => new Set())
  const [submitted, setSubmitted] = React.useState(false)
  const summaryRef = React.useRef<HTMLDivElement>(null)

  const errors = validate(form)
  const initiallyMissing = React.useMemo(() => new Set(Object.keys(validate(initial)) as FieldKey[]), [initial])
  const shown = (k: AnyKey) => {
    const e = errors[k as FieldKey]
    return e && (submitted || touched.has(k) || initiallyMissing.has(k as FieldKey)) ? e : undefined
  }
  const changed = changedFields(form, initial)
  const dirty = changed.length > 0
  const age = ageFrom(form.birthDate)
  const minor = age !== null && age < 18
  const sections = SECTIONS.filter((s) => s.key !== "guardian" || minor)
  const visibleErrors = (Object.keys(errors) as FieldKey[]).filter((k) => sections.some((s) => s.key === sectionOf(k)))

  const ctx: FormCtxValue = {
    form,
    set: (k, v) =>
      setForm((f) => {
        const next = { ...f, [k]: v }
        if (k === "sameWhatsapp" && v) next.whatsapp = next.mobile
        if (k === "mobile" && f.sameWhatsapp) next.whatsapp = v as string
        if (k === "selfPay" && v) Object.assign(next, { insurer: "", insuranceClass: "", policy: "", expiry: "" })
        return next
      }),
    touch: (k) => setTouched((s) => (s.has(k) ? s : new Set(s).add(k))),
    error: shown,
  }

  const back = patientHref(p.id)
  const guard = useLeaveGuard(dirty)
  const leave = () => guard.leave(`/${locale}${back}`)

  const goTo = (k: FieldKey) => {
    const el = document.getElementById(`field-${k}`)
    el?.scrollIntoView({ behavior: "smooth", block: "center" })
    window.setTimeout(() => el?.querySelector<HTMLElement>("input:not([type=hidden]),button,textarea")?.focus({ preventScroll: true }), 350)
  }

  const onSave = () => {
    if (visibleErrors.length) {
      setSubmitted(true)
      window.requestAnimationFrame(() => {
        summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
        summaryRef.current?.focus({ preventScroll: true })
      })
      return
    }
    if (!dirty) {
      notify.info(t("noChanges"), { description: t("noChangesText") })
      return
    }
    const region = CITY_REGION[form.city] ?? "other"
    const tags: Tag[] = [...p.tags.filter((x) => x !== "vip" && x !== "incomplete"), ...(form.classification === "vip" ? (["vip"] as Tag[]) : [])]
    const nameEn = form.nameEn.trim()
    save(
      p.id,
      {
        name: { en: nameEn, ar: form.nameAr.trim() },
        initials:
          nameEn
            .split(/\s+/)
            .filter(Boolean)
            .map((w) => w.replace(/^Al-/i, "")[0])
            .slice(0, 2)
            .join("")
            .toUpperCase() || p.initials,
        gender: form.gender,
        age: age ?? p.age,
        mobile: toLocal(form.mobile),
        region,
        city: region === "other" ? optionLabel("city", form.city) : undefined,
        tags,
      },
      form
    )
    guard.allow()
    notify.success(t("saved"), { description: t("savedText", { name: b({ en: nameEn, ar: form.nameAr.trim() }) }) })
    router.push(back)
  }

  return (
    <FormCtx.Provider value={ctx}>
      {/* Mobile edit bar */}
      <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
        <Button variant="ghost" size="icon" aria-label={t("cancel")} onClick={leave}>
          <Icon name="close-circle" size={24} />
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{t("title")}</h1>
      </div>

      <PageContainer className="gap-4 md:gap-6">
        <PageTitle
          title={t("title")}
          back={back}
          crumbs={[
            { label: tp("title"), href: "/patients" },
            { label: b(p.name), href: patientHref(p.id) },
          ]}
        />
        <Heading onCancel={leave} onSave={onSave} />

        {submitted && visibleErrors.length > 0 && (
          <div ref={summaryRef} tabIndex={-1} role="alert" className="flex flex-col gap-2 rounded-xl bg-destructive-soft p-4 text-destructive-soft-foreground outline-none">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Icon name="danger" size={18} />
              {visibleErrors.some((k) => !["required", "idRequired", "streetRequired"].includes(errors[k]!))
                ? t("summary.titleInvalid", { count: visibleErrors.length })
                : t("summary.title", { count: visibleErrors.length })}
            </p>
            <ul className="flex flex-col gap-1 ps-6 text-xs">
              {visibleErrors.map((k) => (
                <li key={k} className="list-disc">
                  <button type="button" className="cursor-pointer underline-offset-2 hover:underline" onClick={() => goTo(k)}>
                    {t("summary.item", { field: t(`fields.${k}`), section: t(`sections.${sectionOf(k)}.title`) })}
                  </button>
                </li>
              ))}
            </ul>
            <Button variant="outline" size="sm" className="w-fit" onClick={() => goTo(visibleErrors[0])}>
              {t("summary.first")}
            </Button>
          </div>
        )}

        <div className="grid gap-4 md:gap-6 xl:grid-cols-[220px_minmax(0,1fr)_280px] xl:items-start">
          <SectionNav sections={sections.map((s) => ({ ...s, missing: s.fields.some((k) => errors[k]) }))} />
          <form
            noValidate
            className="flex min-w-0 flex-col gap-4 md:gap-6"
            onSubmit={(e) => {
              e.preventDefault()
              onSave()
            }}
          >
            {sections.map((s) => (
              <Section key={s.key} sectionKey={s.key} icon={s.icon} missing={s.fields.some((k) => errors[k])}>
                {s.key === "guardian" && (
                  <p className="flex items-center gap-2.5 rounded-lg bg-info-soft p-3 text-xs text-info-soft-foreground sm:col-span-full">
                    <Icon name="info-circle" size={18} className="shrink-0" />
                    {t("guardianNotice", { name: (b(p.name) ?? "").split(" ")[0], age: age ?? p.age })}
                  </p>
                )}
                <SectionFields sectionKey={s.key} />
              </Section>
            ))}
            {/* Enter in a text field submits */}
            <button type="submit" hidden />
          </form>
          <aside className="order-first flex flex-col gap-4 xl:sticky xl:top-22 xl:order-none">
            <Completeness errors={errors} onGo={goTo} />
            {record.details.duplicate && (
              <div className="flex flex-col gap-2 rounded-xl bg-info-soft p-4 text-info-soft-foreground">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Icon name="people" size={18} />
                  {t("duplicate.title")}
                </p>
                <p className="text-xs">{t("duplicate.text", { mrn: record.details.duplicate.mrn, name: b(record.details.duplicate.name) })}</p>
                <Button variant="outline" size="sm" className="w-fit" asChild>
                  <Link href={`/patients/merge?a=${p.id}&b=${record.details.duplicate.mrn}`}>{t("duplicate.action")}</Link>
                </Button>
              </div>
            )}
            {record.activity[0] && <LastUpdated date={record.activity[0].date} by={b(record.activity[0].by)} />}
          </aside>
        </div>
      </PageContainer>

      <MobileActionBar>
        <Button size="lg" onClick={onSave}>
          <Icon name="tick-circle" size={20} />
          {t("save")}
        </Button>
      </MobileActionBar>

      <UnsavedDialog guard={guard} count={changed.length} />
    </FormCtx.Provider>
  )
}

function LastUpdated({ date, by }: { date: string; by: string }) {
  const t = useTranslations("patients.edit")
  const dates = useDates()
  return <p className="text-xs text-muted-foreground tabular-nums">{t("updated", { date: dates.short(date), by })}</p>
}

/* ================================================================== heading */

function Heading({ onCancel, onSave }: { onCancel: () => void; onSave: () => void }) {
  const t = useTranslations("patients")
  return (
    <div className="hidden items-center justify-end gap-3 md:flex">
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={onCancel}>
          <Icon name="close-circle" size={20} />
          {t("edit.cancel")}
        </Button>
        <Button onClick={onSave}>
          <Icon name="tick-circle" size={20} />
          {t("edit.save")}
        </Button>
      </div>
    </div>
  )
}

/* ================================================================== section nav (xl) */

function SectionNav({ sections }: { sections: { key: SectionKey; icon: IconName; missing: boolean }[] }) {
  const t = useTranslations("patients.edit")
  const [active, setActive] = React.useState<SectionKey>("personal")
  React.useEffect(() => {
    const els = sections.map((s) => document.getElementById(`section-${s.key}`)).filter(Boolean) as HTMLElement[]
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (top) setActive(top.target.id.replace("section-", "") as SectionKey)
      },
      { rootMargin: "-80px 0px -60% 0px" }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [sections])
  return (
    <nav aria-label={t("sectionsLabel")} className="hidden flex-col gap-0.5 rounded-xl border bg-card p-2 xl:sticky xl:top-22 xl:flex">
      {sections.map((s) => {
        const on = active === s.key
        return (
          <a
            key={s.key}
            href={`#section-${s.key}`}
            aria-current={on ? "location" : undefined}
            onClick={(e) => {
              e.preventDefault()
              setActive(s.key)
              document.getElementById(`section-${s.key}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
            }}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50",
              on && "bg-accent font-medium text-accent-foreground hover:bg-accent"
            )}
          >
            <Icon name={s.icon} size={18} className={on ? "text-primary" : "text-muted-foreground"} />
            <span className="flex-1">{t(`sections.${s.key}.title`)}</span>
            {s.missing ? (
              <Icon name="warning-2" size={16} className="text-warning" label={t("missing")} />
            ) : (
              <Icon name="tick-circle" size={16} className="text-success" label={t("complete")} />
            )}
          </a>
        )
      })}
    </nav>
  )
}

/* ================================================================== completeness */

function Completeness({ errors, onGo }: { errors: Partial<Record<FieldKey, ErrorKey>>; onGo: (k: FieldKey) => void }) {
  const t = useTranslations("patients.edit")
  const missing = CORE_REQUIRED.filter((k) => errors[k])
  const done = CORE_REQUIRED.length - missing.length
  const pct = Math.round((done / CORE_REQUIRED.length) * 100)
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5" aria-labelledby="completeness-title">
      <div className="flex flex-col gap-1">
        <h2 id="completeness-title" className="text-lg font-semibold">
          {t("completeness.title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("completeness.count", { done, total: CORE_REQUIRED.length })}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-2xl font-semibold tabular-nums">{pct}%</span>
        <span className="text-xs text-muted-foreground">{t("completeness.left", { count: missing.length })}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-labelledby="completeness-title">
        <div className={cn("h-full rounded-full transition-[width]", pct === 100 ? "bg-success" : "bg-warning")} style={{ width: `${pct}%` }} />
      </div>
      {missing.length > 0 && (
        <ul className="flex flex-col gap-2">
          {missing.map((k) => (
            <li key={k} className="flex items-center gap-2.5 rounded-lg bg-warning-soft p-2.5 text-warning-soft-foreground">
              <Icon name="warning-2" size={16} className="shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-xs font-medium">{t(`fields.${k}`)}</span>
                <span className="text-xs">{t(`sections.${sectionOf(k)}.title`)}</span>
              </div>
              <Button variant="link" size="sm" className="h-7 px-0" onClick={() => onGo(k)}>
                {t("completeness.go")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ================================================================== section card */

function Section({ sectionKey, icon, missing, children }: { sectionKey: SectionKey; icon: IconName; missing: boolean; children: React.ReactNode }) {
  const t = useTranslations("patients.edit")
  return (
    <section
      id={`section-${sectionKey}`}
      aria-labelledby={`section-${sectionKey}-title`}
      className="@container/sec flex scroll-mt-22 flex-col gap-4.5 rounded-xl border bg-card p-4 md:p-6"
    >
      <header className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md",
            missing ? "bg-warning-soft text-warning-soft-foreground" : "bg-accent text-primary"
          )}
        >
          <Icon name={icon} size={18} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id={`section-${sectionKey}-title`} className="text-lg font-semibold">
            {t(`sections.${sectionKey}.title`)}
          </h2>
          <p className="text-xs text-muted-foreground">{t(`sections.${sectionKey}.description`)}</p>
        </div>
        {missing ? <StatusBadge tone="warning">{t("missing")}</StatusBadge> : <StatusBadge tone="success">{t("complete")}</StatusBadge>}
      </header>
      <div className="grid gap-4 @min-[30rem]/sec:grid-cols-2">{children}</div>
    </section>
  )
}

/* ================================================================== fields */

function SectionFields({ sectionKey }: { sectionKey: SectionKey }) {
  const t = useTranslations("patients.edit.fields")
  const { form, set } = useFormCtx()
  const age = ageFrom(form.birthDate)
  switch (sectionKey) {
    case "personal":
      return (
        <>
          <TextField k="nameEn" required dir="ltr" autoComplete="name" />
          <TextField k="nameAr" required dir="rtl" lang="ar" />
          <F k="gender" required>
            {() => (
              <Segmented
                aria-label={t("gender")}
                value={form.gender === "unset" ? ("" as "male") : form.gender}
                onValueChange={(v) => set("gender", v)}
                options={[
                  { value: "male", label: t("male") },
                  { value: "female", label: t("female") },
                ]}
              />
            )}
          </F>
          <F k="birthDate" required helper={age !== null && age >= 0 ? t("age", { age }) : undefined}>
            {(c) => (
              <DatePicker
                {...c}
                value={form.birthDate ? parseDay(form.birthDate) : undefined}
                onChange={(d) => set("birthDate", d ? d.toISOString().slice(0, 10) : "")}
                placeholder={t("birthPlaceholder")}
              />
            )}
          </F>
          <SelectField k="nationality" options="nationality" required />
          <SelectField k="classification" options="classification" />
        </>
      )
    case "contact":
      return (
        <>
          <TextField k="mobile" required dir="ltr" type="tel" icon="call" inputMode="tel" autoComplete="tel" placeholder="+966 5X XXX XXXX" />
          <TextField k="whatsapp" dir="ltr" type="tel" icon="message" inputMode="tel" readOnly={form.sameWhatsapp} placeholder="+966 5X XXX XXXX" />
          <label className="flex cursor-pointer items-center gap-2 text-sm @min-[30rem]/sec:col-span-2">
            <Checkbox checked={form.sameWhatsapp} onCheckedChange={(v) => set("sameWhatsapp", v === true)} />
            {t("sameWhatsapp")}
          </label>
          <TextField k="email" dir="ltr" type="email" icon="sms" autoComplete="email" placeholder="name@example.com" />
          <SelectField k="language" options="language" />
          <SwitchRow k="smsReminders" hint={t("smsRemindersHint")} />
          <SwitchRow k="whatsappMessages" hint={t("whatsappMessagesHint")} />
        </>
      )
    case "identity":
      return (
        <>
          <SelectField k="idType" options="idType" required />
          <TextField
            k="idNumber"
            required
            dir="ltr"
            inputMode={form.idType === "passport" ? "text" : "numeric"}
            placeholder={form.idType === "passport" ? t("passportPlaceholder") : t("idPlaceholder")}
          />
        </>
      )
    case "address":
      return (
        <>
          <SelectField k="city" options="city" required />
          <TextField k="district" />
          <TextField k="street" required placeholder={t("streetPlaceholder")} autoComplete="street-address" />
          <TextField k="postal" dir="ltr" inputMode="numeric" placeholder={t("postalPlaceholder")} autoComplete="postal-code" />
        </>
      )
    case "insurance":
      return (
        <>
          <SelectField k="insurer" options="insurer" disabled={form.selfPay} />
          <SelectField k="insuranceClass" options="insuranceClass" disabled={form.selfPay} />
          <TextField k="policy" dir="ltr" disabled={form.selfPay} />
          <F k="expiry">
            {(c) => (
              <DatePicker
                {...c}
                value={form.expiry ? parseDay(form.expiry) : undefined}
                onChange={(d) => set("expiry", d ? d.toISOString().slice(0, 10) : "")}
                placeholder={t("birthPlaceholder")}
                className={form.selfPay ? "pointer-events-none opacity-50" : undefined}
              />
            )}
          </F>
          <SwitchRow k="selfPay" />
        </>
      )
    case "guardian":
      return (
        <>
          <TextField k="guardianName" required />
          <SelectField k="guardianRelation" options="guardianRelation" required />
          <TextField k="guardianMobile" required dir="ltr" type="tel" icon="call" inputMode="tel" placeholder="+966 5X XXX XXXX" />
          <TextField k="guardianId" dir="ltr" inputMode="numeric" placeholder={t("idPlaceholder")} />
        </>
      )
    case "medical":
      return (
        <>
          <SelectField k="bloodType" options="bloodType" />
          <SelectField k="clinic" options="clinic" />
          <ChipsField k="allergies" tone="destructive" add={t("addAllergy")} />
          <ChipsField k="conditions" tone="warning" add={t("addCondition")} />
          <F k="notes" wide>
            {(c) => <Textarea {...c} value={form.notes} onChange={(e) => set("notes", e.target.value)} className="min-h-22" />}
          </F>
        </>
      )
  }
}
