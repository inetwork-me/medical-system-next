import { setLocaleFrom } from "@/i18n/set-locale"

import { LabSoon } from "@/modules/labs/soon"

/** Built in a later Labs step (CODE_CHAT_LABS.md §5). */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <LabSoon />
}
