"use client"

import * as React from "react"

import { Link } from "@/i18n/navigation"
import { isModuleEnabled } from "@/lib/modules"
import { doctorByName } from "./data"
import { doctorHref } from "./href"

/**
 * A doctor's name that opens their doctor page (Clinics rows, boards, reports). Plain text when the Doctors module is
 * hidden for the branch or the name isn't on the roster.
 */
export function DoctorName({ en, children, className }: { en: string; children: React.ReactNode; className?: string }) {
  const d = doctorByName(en)
  if (!d || !isModuleEnabled("doctors")) return <span className={className}>{children}</span>
  return (
    <Link
      href={doctorHref(d.key)}
      className={`${className ?? ""} rounded-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50`}
    >
      {children}
    </Link>
  )
}
