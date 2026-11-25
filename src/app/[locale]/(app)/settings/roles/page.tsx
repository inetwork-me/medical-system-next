import { Suspense } from "react"

import { setLocaleFrom } from "@/i18n/set-locale"
import { RolesPage } from "@/modules/settings/roles"
import { settingsTitle } from "../title"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await settingsTitle("roles") }
}

/** Settings · Roles and access (`?role=reception`). */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <Suspense>
      <RolesPage />
    </Suspense>
  )
}
