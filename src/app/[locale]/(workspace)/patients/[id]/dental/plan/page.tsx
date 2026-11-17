import { getLocale, getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

import { bi } from "@/lib/mock/bi"
import { isTabEnabled } from "@/lib/modules"
import { patientById } from "@/modules/patients/data"
import { PlanWorkspace } from "@/modules/patients/specialties/plan-ws"

type Props = { params: Promise<{ locale: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const p = patientById(id)
  const t = await getTranslations("specialties.ws")
  return { title: p ? `${t("titleDental")} · ${bi(p.name, await getLocale())}` : t("titleDental") }
}

/** Patients · Dental · Treatment plan workspace. Part of the patients.dental record tab. */
export default function Page() {
  if (!isTabEnabled("patients", "dental")) notFound()
  return <PlanWorkspace />
}
