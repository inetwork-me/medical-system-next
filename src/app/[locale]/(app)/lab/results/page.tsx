import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { ResultsToValidate } from "@/modules/labs/validation"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("labs.results"))("pageTitle") }
}

/** Lab · Results to validate. */
export default async function ResultsPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <ResultsToValidate />
}
