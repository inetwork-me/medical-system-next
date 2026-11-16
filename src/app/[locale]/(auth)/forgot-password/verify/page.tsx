import { getTranslations } from "next-intl/server"

import { VerifyForm } from "@/components/auth/verify-form"

export async function generateMetadata() {
  return { title: (await getTranslations("auth"))("otp.reset.title") }
}

export default function Page() {
  return <VerifyForm kind="reset" />
}
