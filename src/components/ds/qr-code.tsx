import * as React from "react"

import { cn } from "@/lib/utils"
import { encodeQr, qrPath, type Ecc } from "@/lib/barcode/qr"

/**
 * QR code (SVG): black modules on white with a quiet zone, crisp edges at any size and in print. Byte mode, smallest
 * version for the value at the given error-correction level. Encoded with src/lib/barcode/qr.ts (no dependency).
 */
export function QrCode({
  value,
  size = 96,
  ecc = "M",
  quiet = 4,
  label,
  className,
}: {
  value: string
  size?: number
  ecc?: Ecc
  /** Quiet zone in modules (the spec asks for 4; 2 is fine inside a white tile with its own margin). */
  quiet?: number
  label: string
  className?: string
}) {
  const q = React.useMemo(() => encodeQr(value, { ecc }), [value, ecc])
  const dim = q.size + quiet * 2
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${dim} ${dim}`}
      shapeRendering="crispEdges"
      className={cn("shrink-0 rounded-sm bg-white", className)}
      data-qr-version={q.version}
    >
      <rect width={dim} height={dim} fill="#ffffff" />
      <path d={qrPath(q, quiet)} fill="#000000" />
    </svg>
  )
}
