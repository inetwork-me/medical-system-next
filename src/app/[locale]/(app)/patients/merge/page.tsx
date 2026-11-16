import { getTranslations } from "next-intl/server"

import { MergePatients } from "@/modules/patients/merge/merge-page"

export async function generateMetadata() {
  return { title: (await getTranslations("patients.merge"))("title") }
}

/** Patients · Merge patients (?a = main file, ?b = file to close) + Merge confirmation. */
export default async function MergePage({ searchParams }: PageProps<"/[locale]/patients/merge">) {
  const sp = await searchParams
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  return <MergePatients a={one(sp.a)} b={one(sp.b)} />
}
