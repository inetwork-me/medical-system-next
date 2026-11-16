import { getTranslations } from "next-intl/server"

import { LoginForm } from "@/components/auth/login-form"

export async function generateMetadata() {
  return { title: (await getTranslations("auth"))("login.submit") }
}

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  return <LoginForm next={next} />
}
