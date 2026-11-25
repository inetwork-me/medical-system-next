import { setLocaleFrom } from "@/i18n/set-locale"

import { isModuleEnabled } from "@/lib/modules"
import { ModuleAccess } from "@/components/shell/permissions"
import { ModuleUnavailable } from "@/components/shell/module-unavailable"

/** Module guard: when Medical records is hidden for this branch, its deep links show "not available in this branch". */
export default async function RecordsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  if (!isModuleEnabled("records")) return <ModuleUnavailable id="records" />
  return <ModuleAccess id="records">{children}</ModuleAccess>
}
