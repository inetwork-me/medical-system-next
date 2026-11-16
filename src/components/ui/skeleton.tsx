import * as React from "react"

import { cn } from "@/lib/utils"

/** DS sheet 08 · Skeleton: bg-muted, pulse. Line = rounded-sm (6), circle = rounded-full, block = rounded-xl. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-pulse rounded-sm bg-muted motion-reduce:animate-none", className)}
      {...props}
    />
  )
}

export { Skeleton }
