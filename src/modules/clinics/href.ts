/** Clinic page tabs (route segment under /clinics/clinic). */
export const CLINIC_TABS = ["overview", "doctors", "schedule", "services", "rooms", "settings"] as const
export type ClinicTab = (typeof CLINIC_TABS)[number]

/**
 * Clinic page URL: /clinics/clinic[/tab]?id=<key>. The clinic travels in the query (like patient files) so the pages
 * stay static and clinics created in the session open too.
 */
export function clinicHref(key: string, tab?: ClinicTab, query?: Record<string, string>) {
  const q = new URLSearchParams({ id: key, ...query })
  return `/clinics/clinic${tab && tab !== "overview" ? `/${tab}` : ""}?${q}`
}
