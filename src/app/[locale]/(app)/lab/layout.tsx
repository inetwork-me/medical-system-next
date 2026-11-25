import { setLocaleFrom } from "@/i18n/set-locale"

import { isModuleEnabled } from "@/lib/modules"
import { ModuleAccess } from "@/components/shell/permissions"
import { ModuleUnavailable } from "@/components/shell/module-unavailable"

/** Module guard: when Lab is hidden for this branch, its deep links show "not available in this branch". */
export default async function LabLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  if (!isModuleEnabled("lab")) return <ModuleUnavailable id="lab" />
  return <ModuleAccess id="lab">{children}</ModuleAccess>
}
