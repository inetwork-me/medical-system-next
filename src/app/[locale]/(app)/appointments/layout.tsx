import { setLocaleFrom } from "@/i18n/set-locale"
import { notFound } from "next/navigation"

import { isModuleEnabled } from "@/lib/modules"
import { AppointmentsStoreProvider } from "@/modules/appointments/store"

/** Module guard: a module hidden for this branch has no reachable routes. Session store shared by all Appointments pages. */
export default async function AppointmentsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  if (!isModuleEnabled("appointments")) notFound()
  return <AppointmentsStoreProvider>{children}</AppointmentsStoreProvider>
}
