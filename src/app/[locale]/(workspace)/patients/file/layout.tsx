import { setLocaleFrom } from "@/i18n/set-locale"
import { Suspense } from "react"
import { notFound } from "next/navigation"

import { isModuleEnabled } from "@/lib/modules"
import { PatientsStoreProvider } from "@/modules/patients/store"
import { ModuleAccess, PermissionsGate } from "@/components/shell/permissions"

/** Patient workspaces share the Patients session store and its module guard. The patient comes from `?id=` (client). */
export default async function PatientWorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  if (!isModuleEnabled("patients")) notFound()
  return (
    <PermissionsGate>
      <ModuleAccess id="patients">
        <PatientsStoreProvider>
          <Suspense fallback={<div className="min-h-svh bg-background" />}>{children}</Suspense>
        </PatientsStoreProvider>
      </ModuleAccess>
    </PermissionsGate>
  )
}
