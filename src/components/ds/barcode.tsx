import * as React from "react"

import { cn } from "@/lib/utils"
import { QUIET_ZONE, encode128 } from "@/lib/barcode/code128"

/**
 * Code 128 barcode as SVG (scannable; ISO/IEC 15417). One module = `module` px on screen; the SVG scales cleanly
 * for print. Includes the quiet zone on both sides. Always render the human-readable code next to it.
 */
export function Barcode({ value, height = 32, module = 1, className, label }: { value: string; height?: number; module?: number; className?: string; label?: string }) {
  const widths = React.useMemo(() => encode128(value), [value])
  const total = widths.reduce((s, w) => s + w, 0) + QUIET_ZONE * 2
  let x = QUIET_ZONE
  const bars: { x: number; w: number }[] = []
  widths.forEach((w, i) => {
    if (i % 2 === 0) bars.push({ x, w })
    x += w
  })
  return (
    <svg
      viewBox={`0 0 ${total} ${height}`}
      width={total * module}
      height={height}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("max-w-full bg-white text-black", className)}
    >
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={height} fill="currentColor" />
      ))}
    </svg>
  )
}
