import { getTranslations } from "next-intl/server"

import { VerifyForm } from "@/components/auth/verify-form"

export async function generateMetadata() {
  return { title: (await getTranslations("auth"))("otp.login.title") }
}

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  return <VerifyForm kind="login" next={next} />
}
