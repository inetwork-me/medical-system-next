import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { NewDoctorPage } from "@/modules/doctors/new-doctor"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("doctors.newDoctor"))("title") }
}

/** Doctors · New doctor: the profile form and the "Before they can be booked" checklist. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <NewDoctorPage />
}
