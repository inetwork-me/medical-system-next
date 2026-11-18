import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { ClinicSchedule } from "@/modules/clinics/clinic/schedule"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("clinics.page.tabs"))("schedule", { n: "" }).replace(/ · $/, "") }
}

/** Clinic page · Schedule (hours, booking rules, closures). */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <ClinicSchedule />
}
