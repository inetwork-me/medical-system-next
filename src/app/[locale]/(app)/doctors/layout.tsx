import { setLocaleFrom } from "@/i18n/set-locale"
import { notFound } from "next/navigation"

import { isModuleEnabled } from "@/lib/modules"
import { ModuleAccess } from "@/components/shell/permissions"

/** Module guard: when Doctors is hidden for this branch none of its routes are reachable. */
export default async function DoctorsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  if (!isModuleEnabled("doctors")) notFound()
  return <ModuleAccess id="doctors">{children}</ModuleAccess>
}
