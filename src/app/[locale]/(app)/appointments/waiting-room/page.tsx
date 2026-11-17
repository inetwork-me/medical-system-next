import { getTranslations } from "next-intl/server"

import { SoonTab } from "@/modules/appointments/soon"

export async function generateMetadata() {
  return { title: (await getTranslations("shell.tabs.appointments"))("waiting") }
}

/** Appointments · waiting: built in a later slice from its FigCraft screens. */
export default function Page() {
  return <SoonTab tab="waiting" />
}
