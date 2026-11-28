import { setLocaleFrom } from "@/i18n/set-locale"
import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { LoginWithNext } from "@/components/auth/client-guards"
import { LoginForm } from "@/components/auth/login-form"
import { authMode } from "@/lib/auth-mode"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("auth"))("login.submit") }
}

/** Sign in (?next= is read in the browser). */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  const mode = authMode()
  return (
    <Suspense fallback={<LoginForm mode={mode} />}>
      <LoginWithNext mode={mode} />
    </Suspense>
  )
}
