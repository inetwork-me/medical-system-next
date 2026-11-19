/**
 * Labs routes. The order is a query param (`/lab/order?no=LAB-0142`) so the app also runs as a static export,
 * like the Patients and Doctors record pages.
 */
export type OrderPage = "results" | "entry" | "sample" | "report"

export function orderHref(no: string, page: OrderPage = "results", query?: Record<string, string | undefined>) {
  const base = page === "results" ? "/lab/order" : `/lab/order/${page}`
  const q = new URLSearchParams({ no, ...Object.fromEntries(Object.entries(query ?? {}).filter(([, v]) => v !== undefined) as [string, string][]) })
  return `${base}?${q.toString()}`
}

export const NEW_ORDER_HREF = "/lab/new"
