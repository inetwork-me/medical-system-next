import { setLocaleFrom } from "@/i18n/set-locale"

import { OrderSoon } from "@/modules/labs/order/page"

/** Lab · Order page · entry — built in step 5 of the Labs build. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <OrderSoon step={5} />
}
