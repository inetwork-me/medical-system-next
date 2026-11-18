import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { RoomsBoardPage } from "@/modules/clinics/rooms"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("shell.tabs.clinics"))("rooms") }
}

/** Clinics · Rooms: live rooms board by floor. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <RoomsBoardPage />
}
