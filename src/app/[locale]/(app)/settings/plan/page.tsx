import { setLocaleFrom } from "@/i18n/set-locale"
import { PlanPage } from "@/modules/settings/plan"
import { settingsTitle } from "../title"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await settingsTitle("plan") }
}

/** Settings · Plan and subscription. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <PlanPage />
}
