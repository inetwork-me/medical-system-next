import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { NewLabOrder } from "@/modules/labs/new-order"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("labs.newOrder"))("title") }
}

/** Lab · New lab order. */
export default async function NewOrderPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <NewLabOrder />
}
