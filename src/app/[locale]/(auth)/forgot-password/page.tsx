import { getTranslations } from "next-intl/server"

import { ForgotForm } from "@/components/auth/reset-forms"

export async function generateMetadata() {
  return { title: (await getTranslations("auth"))("forgot.title") }
}

export default function Page() {
  return <ForgotForm />
}
