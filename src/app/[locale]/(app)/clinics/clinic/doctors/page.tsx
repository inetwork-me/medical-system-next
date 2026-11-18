import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { ClinicDoctors } from "@/modules/clinics/clinic/doctors"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("clinics.page.tabs"))("doctors", { n: "" }).replace(/ · $/, "") }
}

/** Clinic page · Doctors. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <ClinicDoctors />
}
