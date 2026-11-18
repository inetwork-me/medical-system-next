import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { NewClinicPage } from "@/modules/clinics/settings"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("clinics.newClinic"))("title") }
}

/** Clinics · New clinic: the form and the "Before you open it" checklist. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <NewClinicPage />
}
