import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { CredentialsBoard } from "@/modules/doctors/credentials-board"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("shell.tabs.doctors"))("credentials") }
}

/** Doctors · Credentials: summary tiles and the renewals board. */
export default async function DoctorsCredentialsPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <CredentialsBoard />
}
