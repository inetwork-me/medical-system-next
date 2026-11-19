import { setLocaleFrom } from "@/i18n/set-locale"

import { EnterResults } from "@/modules/labs/order/entry"

/** Lab · Order page · Enter results (`?no=LAB-0142&test=lipid`). */
export default async function EntryPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <EnterResults />
}
