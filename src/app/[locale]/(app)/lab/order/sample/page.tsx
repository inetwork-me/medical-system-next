import { setLocaleFrom } from "@/i18n/set-locale"

import { OrderSample } from "@/modules/labs/order/sample"

/** Lab · Order page · Sample: tubes with labels, chain of custody. */
export default async function SamplePage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <OrderSample />
}
