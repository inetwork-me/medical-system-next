import { setLocaleFrom } from "@/i18n/set-locale"
import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { VerifyLoginWithNext } from "@/components/auth/client-guards"
import { VerifyForm } from "@/components/auth/verify-form"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("auth"))("otp.login.title") }
}

/** Sign in · 2-step code (?next= is read in the browser). */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <Suspense fallback={<VerifyForm kind="login" />}>
      <VerifyLoginWithNext />
    </Suspense>
  )
}
