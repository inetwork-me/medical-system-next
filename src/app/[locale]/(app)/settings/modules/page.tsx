import { Suspense } from "react"

import { setLocaleFrom } from "@/i18n/set-locale"
import { ModulesPage } from "@/modules/settings/modules-page"
import { settingsTitle } from "../title"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await settingsTitle("modules") }
}

/** Settings · Modules per branch (`?branch=olaya|malaz|jeddah`). */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <Suspense>
      <ModulesPage />
    </Suspense>
  )
}
