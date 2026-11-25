import { Suspense } from "react"

import { setLocaleFrom } from "@/i18n/set-locale"
import { UserPage } from "@/modules/settings/user-page"
import { settingsTitle } from "../../title"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await settingsTitle("user") }
}

/** Settings · User (`?id=nora`), inner page of Users. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <Suspense>
      <UserPage />
    </Suspense>
  )
}
