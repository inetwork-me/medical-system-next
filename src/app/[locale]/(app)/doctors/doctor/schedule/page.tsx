import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { DoctorSchedule } from "@/modules/doctors/doctor/schedule"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("shell.nav"))("doctors") }
}

/** Doctor page · Schedule. */
export default async function DoctorSchedulePage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <DoctorSchedule />
}
