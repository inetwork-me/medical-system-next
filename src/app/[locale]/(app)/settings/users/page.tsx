import { Suspense } from "react"

import { setLocaleFrom } from "@/i18n/set-locale"
import { UsersPage } from "@/modules/settings/users"
import { settingsTitle } from "../title"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await settingsTitle("users") }
}

/** Settings · Users (`?filter=active|invited|no2fa`). */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <Suspense>
      <UsersPage />
    </Suspense>
  )
}
