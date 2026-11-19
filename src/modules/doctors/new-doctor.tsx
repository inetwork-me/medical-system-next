"use client"

import { useTranslations } from "next-intl"

import { Link, useRouter } from "@/i18n/navigation"
import { Icon } from "@/components/ds/icon"
import { toast } from "@/components/ds/toast"
import { MobileActionBar, PageContainer, PageHeader } from "@/components/shell/page"
import { PageTitle } from "@/components/shell/page-title"
import { Button } from "@/components/ui/button"
import { blankDoctor, setupOf } from "./data"
import { gradeLabel } from "./doctor/settings"
import { doctorHref } from "./href"
import { DoctorProfileForm, EMPTY_PROFILE, focusInvalid, profileFields, useProfileForm, validateProfile } from "./profile-form"
import { SetupChecklist } from "./setup-checklist"
import { addDoctor, useDoctors } from "./store"

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "doctor"

/**
 * Doctors · New doctor: the profile form beside the 280px "Before they can be booked" checklist (above the form on
 * tablet / mobile). Cancel (→ list) · Create doctor (→ the new doctor's page + "doctor-created" toast). The doctor
 * can't be booked until all 5 steps are done; weekly hours are set on the Schedule tab afterwards.
 */
export function NewDoctorPage() {
  const t = useTranslations("doctors.newDoctor")
  const tp = useTranslations("doctors.profile")
  const tn = useTranslations("shell.nav")
  const doctors = useDoctors()
  const router = useRouter()
  const { form, set, tried, setTried } = useProfileForm(() => EMPTY_PROFILE)
  const errors = tried ? validateProfile(form, tp) : {}
  const base = blankDoctor("draft", { scfhs: "" })
  const draft = { ...base, ...profileFields(form, base, gradeLabel), name: { en: form.nameEn, ar: form.nameAr } }
  const done = setupOf({ ...draft, credentials: [{ ...base.credentials[0], number: form.scfhs.trim().toUpperCase() }] })

  const create = () => {
    setTried(true)
    if (Object.keys(validateProfile(form, tp)).length) return focusInvalid()
    let key = slug(form.nameEn)
    while (doctors.some((d) => d.key === key)) key += "-2"
    const blank = blankDoctor(key, { scfhs: form.scfhs.trim().toUpperCase() })
    addDoctor({ ...blank, ...profileFields(form, blank, gradeLabel) })
    toast.success(t("toast"), { description: t("toastText") })
    router.push(doctorHref(key))
  }
  const cancel = (
    <Button variant="outline" asChild>
      <Link href="/doctors">{t("cancel")}</Link>
    </Button>
  )
  const submit = (
    <Button onClick={create}>
      <Icon name="tick-circle" size={24} />
      {t("create")}
    </Button>
  )

  return (
    <>
      <PageTitle title={t("title")} crumbs={[{ label: tn("doctors"), href: "/doctors" }]} back="/doctors" />
      <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/doctors" aria-label={t("back")}>
            <Icon name="arrow-left" size={24} />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{t("title")}</h1>
      </div>
      <PageContainer className="max-md:pb-28">
        <PageHeader
          className="max-md:hidden"
          actions={
            <>
              {cancel}
              {submit}
            </>
          }
        />
        <div className="@container/new">
          <div className="flex flex-col gap-4 md:gap-6 @5xl/new:flex-row @5xl/new:items-start">
            <SetupChecklist done={done} className="@5xl/new:order-2 @5xl/new:w-70 @5xl/new:shrink-0" />
            <div className="min-w-0 flex-1 @5xl/new:order-1">
              <DoctorProfileForm form={form} set={set} errors={errors} />
            </div>
          </div>
        </div>
      </PageContainer>
      <MobileActionBar>
        {cancel}
        {submit}
      </MobileActionBar>
    </>
  )
}
