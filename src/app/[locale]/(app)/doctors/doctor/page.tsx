import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { DoctorOverview } from "@/modules/doctors/doctor/overview"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("shell.nav"))("doctors") }
}

/** Doctor page · Overview. */
export default async function DoctorOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <DoctorOverview />
}
