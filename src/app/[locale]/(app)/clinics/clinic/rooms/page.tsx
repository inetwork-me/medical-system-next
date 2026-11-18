import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { ClinicRoomsPage } from "@/modules/clinics/rooms"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("clinics.page.tabs"))("rooms") }
}

/** Clinic page · Rooms. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <ClinicRoomsPage />
}
