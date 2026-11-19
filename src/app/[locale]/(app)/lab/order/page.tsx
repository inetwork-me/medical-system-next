import { setLocaleFrom } from "@/i18n/set-locale"

import { OrderResults } from "@/modules/labs/order/page"

/** Lab · Order page · Results. */
export default async function OrderPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <OrderResults />
}
