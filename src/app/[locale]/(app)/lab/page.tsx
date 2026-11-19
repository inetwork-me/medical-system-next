import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { Worklist } from "@/modules/labs/worklist"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("shell.nav"))("lab") }
}

/** Lab · Worklist (module home). */
export default async function LabPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <Worklist />
}
