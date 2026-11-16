import { getTranslations } from "next-intl/server"

import { SignupForm } from "@/components/auth/signup-form"

export async function generateMetadata() {
  return { title: (await getTranslations("auth"))("signup.title") }
}

export default function Page() {
  return <SignupForm />
}
