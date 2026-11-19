import { setLocaleFrom } from "@/i18n/set-locale"

import { OrderReport } from "@/modules/labs/order/report"

/** Lab · Order page · Report (printable at A4). */
export default async function ReportPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <OrderReport />
}
