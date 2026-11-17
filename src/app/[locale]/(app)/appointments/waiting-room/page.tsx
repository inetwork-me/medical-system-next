import { getTranslations } from "next-intl/server"

import { WaitingRoom } from "@/modules/appointments/waiting/waiting-room"

export async function generateMetadata() {
  return { title: (await getTranslations("shell.tabs.appointments"))("waiting") }
}

/** Appointments · Waiting room: expected → waiting → with doctor → done · to pay. */
export default function WaitingRoomPage() {
  return <WaitingRoom />
}
