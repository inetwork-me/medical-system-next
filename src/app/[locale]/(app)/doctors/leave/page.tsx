import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { LeaveBoard } from "@/modules/doctors/leave-board"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("shell.tabs.doctors"))("leave") }
}

/** Doctors · Leave & cover: requests waiting for approval and who is away this week. */
export default async function DoctorsLeavePage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <LeaveBoard />
}
