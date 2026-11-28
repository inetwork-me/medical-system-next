import { setLocaleFrom } from "@/i18n/set-locale"
import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { BranchWithNext } from "@/components/auth/client-guards"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("auth"))("branch.title") }
}

/** Sign in · pick a branch (?next= is read in the browser). */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <Suspense fallback={null}>
      <BranchWithNext />
    </Suspense>
  )
}
