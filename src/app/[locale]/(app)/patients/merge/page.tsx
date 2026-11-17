import { setLocaleFrom } from "@/i18n/set-locale"
import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { MergeRoute } from "@/modules/patients/merge/merge-route"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("patients.merge"))("title") }
}

/** Patients · Merge patients (?a = main file, ?b = file to close) + Merge confirmation. */
export default async function MergePage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <Suspense>
      <MergeRoute />
    </Suspense>
  )
}
