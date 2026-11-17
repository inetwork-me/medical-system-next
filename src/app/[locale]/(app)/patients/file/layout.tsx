import { setLocaleFrom } from "@/i18n/set-locale"
import { Suspense } from "react"

import { PageContainer } from "@/components/shell/page"
import { SkeletonCard } from "@/components/ds/states"

/**
 * Patient file routes (`/patients/file…?id=`): the patient comes from the query string, read on the client
 * (useSearchParams), so the pages render under this boundary — on a static export they hydrate with the right patient.
 */
export default async function PatientFileLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <Suspense
      fallback={
        <PageContainer>
          <SkeletonCard />
        </PageContainer>
      }
    >
      {children}
    </Suspense>
  )
}
