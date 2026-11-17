import { getTranslations } from "next-intl/server"

import { SoonTab } from "@/modules/appointments/soon"

export async function generateMetadata() {
  return { title: (await getTranslations("shell.tabs.appointments"))("list") }
}

/** Appointments · list: built in a later slice from its FigCraft screens. */
export default function Page() {
  return <SoonTab tab="list" />
}
