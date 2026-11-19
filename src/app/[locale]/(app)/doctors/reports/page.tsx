import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { DoctorsReportPage } from "@/modules/doctors/report"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("shell.tabs.doctors"))("reports") }
}

/** Doctors · Reports: visits by doctor and the doctor comparison. */
export default async function DoctorsReportsPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <DoctorsReportPage />
}
