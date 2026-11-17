"use client"

import { useSearchParams } from "next/navigation"

import { MergePatients } from "./merge-page"

/** Merge route: ?a = main file, ?b = file to close (read in the browser). */
export function MergeRoute() {
  const sp = useSearchParams()
  return <MergePatients a={sp.get("a") ?? undefined} b={sp.get("b") ?? undefined} />
}
