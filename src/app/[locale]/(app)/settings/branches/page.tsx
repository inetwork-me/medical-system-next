import { setLocaleFrom } from "@/i18n/set-locale"
import { BranchesPage } from "@/modules/settings/branches"
import { settingsTitle } from "../title"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await settingsTitle("branches") }
}

/** Settings · Branches. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <BranchesPage />
}
