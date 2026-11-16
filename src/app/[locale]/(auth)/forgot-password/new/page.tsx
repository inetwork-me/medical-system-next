import { getTranslations } from "next-intl/server"

import { NewPasswordForm } from "@/components/auth/reset-forms"

export async function generateMetadata() {
  return { title: (await getTranslations("auth"))("newPassword.title") }
}

export default function Page() {
  return <NewPasswordForm />
}
