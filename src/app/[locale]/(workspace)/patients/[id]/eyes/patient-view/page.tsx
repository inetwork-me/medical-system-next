import { getLocale, getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

import { bi } from "@/lib/mock/bi"
import { isTabEnabled } from "@/lib/modules"
import { patientById } from "@/modules/patients/data"
import { EyePatientView } from "@/modules/patients/specialties/patient-view"

type Props = { params: Promise<{ locale: string; id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const p = patientById(id)
  const t = await getTranslations("specialties.pv")
  return { title: p ? `${t("title")} · ${bi(p.name, await getLocale())}` : t("title") }
}

/** Patients · Eye · Patient view (education, full screen). Part of the patients.eyes record tab. */
export default function Page() {
  if (!isTabEnabled("patients", "eyes")) notFound()
  return <EyePatientView />
}
