import { setLocaleFrom } from "@/i18n/set-locale"
import { notFound } from "next/navigation"

import { isModuleEnabled } from "@/lib/modules"
import { ModuleAccess } from "@/components/shell/permissions"
import { PatientsStoreProvider } from "@/modules/patients/store"

/** Module guard: a module hidden for this branch has no reachable routes. Session store shared by all Patients pages. */
export default async function PatientsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  if (!isModuleEnabled("patients")) notFound()
  return (
    <ModuleAccess id="patients">
      <PatientsStoreProvider>{children}</PatientsStoreProvider>
    </ModuleAccess>
  )
}
