import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { DoctorsList } from "@/modules/doctors/list/list"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("shell.nav"))("doctors") }
}

/** Doctors · Doctors: KPIs, filters and the doctor cards. */
export default async function DoctorsPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <DoctorsList />
}
