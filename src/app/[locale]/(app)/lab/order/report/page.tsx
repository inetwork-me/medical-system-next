import { setLocaleFrom } from "@/i18n/set-locale"

import { OrderSoon } from "@/modules/labs/order/page"

/** Lab · Order page · report — built in step 6 of the Labs build. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <OrderSoon step={6} />
}
