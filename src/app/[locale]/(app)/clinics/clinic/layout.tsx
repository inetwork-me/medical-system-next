import { setLocaleFrom } from "@/i18n/set-locale"
import { Suspense } from "react"

import { PageContainer } from "@/components/shell/page"
import { SkeletonCard } from "@/components/ds/states"
import { ClinicFrame } from "@/modules/clinics/clinic/frame"

/**
 * Clinic page routes (`/clinics/clinic[/tab]?id=<key>`): the clinic comes from the query string, read on the client,
 * so the pages render under this boundary (static export friendly, and clinics created in the session open too).
 */
export default async function ClinicLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <Suspense
      fallback={
        <PageContainer>
          <SkeletonCard />
        </PageContainer>
      }
    >
      <ClinicFrame>{children}</ClinicFrame>
    </Suspense>
  )
}
