import { setLocaleFrom } from "@/i18n/set-locale"
import { Suspense } from "react"

import { PageContainer } from "@/components/shell/page"
import { SkeletonCard } from "@/components/ds/states"
import { OrderFrame } from "@/modules/labs/order/frame"

/**
 * Lab order page routes (`/lab/order[/sample|/report|/entry]?no=LAB-0142`): the order comes from the query string,
 * read on the client, so the pages render under this boundary (static export friendly).
 */
export default async function OrderLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <Suspense
      fallback={
        <PageContainer>
          <SkeletonCard />
        </PageContainer>
      }
    >
      <OrderFrame>{children}</OrderFrame>
    </Suspense>
  )
}
