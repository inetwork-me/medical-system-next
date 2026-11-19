"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { useRouter } from "@/i18n/navigation"
import { Icon } from "@/components/ds/icon"
import { toast } from "@/components/ds/toast"
import { Widget } from "@/components/ds/widget"
import { MobileActionBar } from "@/components/shell/page"
import { Button } from "@/components/ui/button"
import { useClinics } from "@/modules/clinics/store"
import type { Grade } from "../data"
import { DeactivateDialog } from "../deactivate-dialog"
import { doctorHref } from "../href"
import { DoctorProfileForm, focusInvalid, profileFields, profileOf, useProfileForm, validateProfile } from "../profile-form"
import { updateDoctor } from "../store"
import { useDoctorText } from "../text"
import { DoctorPage, useCurrentDoctor } from "./frame"

/** Grade in both languages for the title made from grade + specialty ("Consultant · Pediatrics" / "استشاري · طب الأطفال"). */
const GRADE_BI: Record<Grade, { en: string; ar: string; arF: string }> = {
  consultant: { en: "Consultant", ar: "استشاري", arF: "استشارية" },
  specialist: { en: "Specialist", ar: "أخصائي", arF: "أخصائية" },
  resident: { en: "Resident", ar: "طبيب مقيم", arF: "طبيبة مقيمة" },
}
export const gradeLabel = (g: Grade, female: boolean) => ({ en: GRADE_BI[g].en, ar: female ? GRADE_BI[g].arF : GRADE_BI[g].ar })

/**
 * Doctor page · Settings (Widget / Doctor Profile Form): Personal details · Professional · Clinic & booking ·
 * Contact & system access · Deactivate doctor. Discard (→ Overview) · Save changes (toast "changes-saved").
 * Mobile: the fixed action bar replaces the bottom nav; Deactivate goes full width.
 */
export function DoctorSettings() {
  const d = useCurrentDoctor()
  const t = useTranslations("doctors.settings")
  const tp = useTranslations("doctors.profile")
  const router = useRouter()
  const clinic = useClinics().find((c) => c.key === d.clinic)
  const { form, set, setForm, tried, setTried } = useProfileForm(() => profileOf(d, clinic?.specialty))
  const errors = tried ? validateProfile(form, tp) : {}
  const [deactivating, setDeactivating] = React.useState(false)
  const { dates } = useDoctorText()

  const discard = () => {
    setForm(profileOf(d, clinic?.specialty))
    setTried(false)
    router.push(doctorHref(d.key))
  }
  const save = () => {
    setTried(true)
    if (Object.keys(validateProfile(form, tp)).length) return focusInvalid()
    updateDoctor(d.key, profileFields(form, d, gradeLabel))
    setTried(false)
    toast.success(t("saved"), { description: t("savedText") })
  }
  const buttons = (
    <>
      <Button variant="outline" onClick={discard}>
        {t("discard")}
      </Button>
      <Button onClick={save}>
        <Icon name="tick-circle" size={24} />
        {t("save")}
      </Button>
    </>
  )

  return (
    <DoctorPage actions={<div className="flex gap-2 max-md:hidden">{buttons}</div>} className="max-md:pb-28">
      <DoctorProfileForm
        form={form}
        set={set}
        errors={errors}
        danger={
          <Widget
            title={t("danger")}
            description={d.deactivation ? t("deactivatedText", { date: dates.short(d.deactivation.lastDay) }) : t("dangerText")}
            className="gap-4 p-4 md:p-6"
          >
            <Button variant="destructive" className="max-md:w-full md:self-start" disabled={!!d.deactivation} onClick={() => setDeactivating(true)}>
              <Icon name="user-remove" size={24} />
              {t("deactivate")}
            </Button>
          </Widget>
        }
      />
      <MobileActionBar>{buttons}</MobileActionBar>
      {deactivating && <DeactivateDialog doctorKey={d.key} onOpenChange={(o) => !o && setDeactivating(false)} />}
    </DoctorPage>
  )
}
