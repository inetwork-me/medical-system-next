import { notFound } from "next/navigation"

import { isModuleEnabled } from "@/lib/modules"
import { PatientsStoreProvider } from "@/modules/patients/store"

/** Patient workspaces share the Patients session store and its module guard. */
export default function PatientWorkspaceLayout({ children }: { children: React.ReactNode }) {
  if (!isModuleEnabled("patients")) notFound()
  return <PatientsStoreProvider>{children}</PatientsStoreProvider>
}
