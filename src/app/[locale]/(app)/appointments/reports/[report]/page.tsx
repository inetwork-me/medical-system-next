import { setLocaleFrom } from "@/i18n/set-locale"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { REPORT_KEYS, type ReportKey } from "@/modules/appointments/reports/data"
import { AppointmentsReport } from "@/modules/appointments/reports/reports"

export function generateStaticParams() {
  return REPORT_KEYS.map((report) => ({ report }))
}

export async function generateMetadata({ params }: PageProps<"/[locale]/appointments/reports/[report]">) {
  await setLocaleFrom(params)
  const { report } = await params
  if (!REPORT_KEYS.includes(report as ReportKey)) return {}
  return { title: (await getTranslations("appointments.reports.cards"))(`${report as ReportKey}.title`) }
}

/** Appointments · Report · <name> (volume, no-shows, utilisation, waiting-time, channels, reminders). */
export default async function AppointmentsReportPage({ params }: PageProps<"/[locale]/appointments/reports/[report]">) {
  await setLocaleFrom(params)
  const { report } = await params
  if (!REPORT_KEYS.includes(report as ReportKey)) notFound()
  return <AppointmentsReport report={report as ReportKey} />
}
