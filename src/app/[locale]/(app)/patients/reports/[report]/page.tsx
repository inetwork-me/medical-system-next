import { setLocaleFrom } from "@/i18n/set-locale"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { ReportBody } from "@/modules/patients/reports/bodies"
import { REPORT_KEYS, type ReportKey } from "@/modules/patients/reports/data"

export function generateStaticParams() {
  return REPORT_KEYS.map((report) => ({ report }))
}

export async function generateMetadata({ params }: PageProps<"/[locale]/patients/reports/[report]">) {
  await setLocaleFrom(params)
  const { report } = await params
  if (!REPORT_KEYS.includes(report as ReportKey)) return {}
  return { title: (await getTranslations("patients.reports.cards"))(`${report as ReportKey}.title`) }
}

/** Patients · Report · <name> (activity, registrations, stay, visits, duplicates, incomplete). */
export default async function ReportPage({ params }: PageProps<"/[locale]/patients/reports/[report]">) {
  await setLocaleFrom(params)
  const { report } = await params
  if (!REPORT_KEYS.includes(report as ReportKey)) notFound()
  return <ReportBody report={report as ReportKey} />
}
