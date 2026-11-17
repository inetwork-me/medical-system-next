import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { WaitingRoom } from "@/modules/appointments/waiting/waiting-room"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("shell.tabs.appointments"))("waiting") }
}

/** Appointments · Waiting room: expected → waiting → with doctor → done · to pay. */
export default async function WaitingRoomPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <WaitingRoom />
}
