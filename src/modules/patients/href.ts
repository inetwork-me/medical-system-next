import { useSearchParams } from "next/navigation"

/**
 * Patient file URLs. Every patient page is one static route (`/patients/file`, `/patients/file/visits`,
 * `/patients/file/dental/chart`…) with the patient in `?id=` — so the app also runs as a static export (GitHub Pages)
 * for all 1,284 patients instead of pre-building a page per patient.
 *
 *   patientHref("004891")                         → /patients/file?id=004891
 *   patientHref("004891", "edit")                 → /patients/file/edit?id=004891
 *   patientHref("004891", "dental/chart", { tooth: 36 }) → /patients/file/dental/chart?id=004891&tooth=36
 */
export function patientHref(id: string, page?: string, query?: Record<string, string | number | undefined | null>) {
  const q = new URLSearchParams({ id })
  for (const [k, v] of Object.entries(query ?? {})) if (v != null && v !== "") q.set(k, String(v))
  return `/patients/file${page ? `/${page}` : ""}?${q}`
}

/** The patient of the current patient page (`?id=`). Components using it render client-side under a Suspense boundary. */
export function usePatientId() {
  return useSearchParams().get("id") ?? ""
}
