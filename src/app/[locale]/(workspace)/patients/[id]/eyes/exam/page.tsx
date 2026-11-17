import { getLocale, getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

import { bi } from "@/lib/mock/bi"
import { isTabEnabled } from "@/lib/modules"
import { patientById } from "@/modules/patients/data"
import { EyeExamWorkspace } from "@/modules/patients/specialties/eye-ws"

type Props = { params: Promise<{ locale: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const p = patientById(id)
  const t = await getTranslations("specialties.ws")
  return { title: p ? `${t("titleEye")} · ${bi(p.name, await getLocale())}` : t("titleEye") }
}

/** Patients · Eye movement exam · exam. Part of the patients.eyes record tab. */
export default async function Page({ searchParams }: Props) {
  if (!isTabEnabled("patients", "eyes")) notFound()
  const exam = (await searchParams).exam
  return <EyeExamWorkspace examId={typeof exam === "string" ? exam : undefined} />
}
