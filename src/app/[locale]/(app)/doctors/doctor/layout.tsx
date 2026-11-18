import { setLocaleFrom } from "@/i18n/set-locale"
import { Suspense } from "react"

import { PageContainer } from "@/components/shell/page"
import { SkeletonCard } from "@/components/ds/states"
import { DoctorFrame } from "@/modules/doctors/doctor/frame"

/**
 * Doctor page routes (`/doctors/doctor[/tab]?id=<key>`): the doctor comes from the query string, read on the client,
 * so the pages render under this boundary (static export friendly, and doctors created in the session open too).
 */
export default async function DoctorLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <Suspense
      fallback={
        <PageContainer>
          <SkeletonCard />
        </PageContainer>
      }
    >
      <DoctorFrame>{children}</DoctorFrame>
    </Suspense>
  )
}
