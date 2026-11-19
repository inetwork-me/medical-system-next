import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { Samples } from "@/modules/labs/samples"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("shell.tabs.lab"))("samples") }
}

/** Lab · Samples: collection queue, samples today, rejected today, tube guide. */
export default async function SamplesPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <Samples />
}
