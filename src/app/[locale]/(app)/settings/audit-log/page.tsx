import { Suspense } from "react"

import { setLocaleFrom } from "@/i18n/set-locale"
import { AuditLogPage } from "@/modules/settings/audit-log"
import { settingsTitle } from "../title"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await settingsTitle("audit") }
}

/** Settings · Audit log (`?filter=settings|signin|failed|export`). */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <Suspense>
      <AuditLogPage />
    </Suspense>
  )
}
