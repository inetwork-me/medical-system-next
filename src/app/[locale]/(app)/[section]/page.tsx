import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { MODULES } from "@/config/modules"
import { isModuleEnabled } from "@/lib/modules"
import { EmptyState } from "@/components/ds/states"
import { PageContainer } from "@/components/shell/page"

/** Account pages that exist in the menus but aren't designed yet. */
const ACCOUNT = { settings: { icon: "setting-2", key: "settings" }, profile: { icon: "profile-circle", key: "profile" }, help: { icon: "info-circle", key: "help" } } as const

function resolve(section: string) {
  const m = MODULES.find((x) => !x.built && x.href === `/${section}`)
  if (m) return isModuleEnabled(m.id) ? { icon: m.icon, key: m.labelKey } : null
  return ACCOUNT[section as keyof typeof ACCOUNT] ?? null
}

export function generateStaticParams() {
  return [...MODULES.filter((m) => !m.built).map((m) => m.href.slice(1)), ...Object.keys(ACCOUNT)].map((section) => ({ section }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: PageProps<"/[locale]/[section]">) {
  const { section } = await params
  const r = resolve(section)
  if (!r) return {}
  return { title: (await getTranslations("shell.nav"))(r.key as "settings") }
}

/** Placeholder for modules and pages that aren't built yet (Appointments, Doctors, …; brief "Known gaps"). */
export default async function SectionPlaceholder({ params }: PageProps<"/[locale]/[section]">) {
  const { locale, section } = await params
  setRequestLocale(locale as "en" | "ar")
  const r = resolve(section)
  if (!r) notFound()
  const t = await getTranslations("shell")
  const name = t(`nav.${r.key}` as "nav.settings")

  return (
    <PageContainer>
      <div className="rounded-xl border bg-card">
        <EmptyState icon={r.icon} title={t("placeholder.title", { module: name })} description={t("placeholder.description")} className="py-16" />
      </div>
    </PageContainer>
  )
}
