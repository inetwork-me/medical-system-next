"use client"

import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/** Segmented choice (e.g. Gender All / Male / Female): Tabs styling as a radio group — muted track, active = card pill. */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  className,
  ...aria
}: {
  value: T
  onValueChange: (v: T) => void
  options: { value: T; label: React.ReactNode }[]
  className?: string
  "aria-label"?: string
  "aria-labelledby"?: string
}) {
  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      orientation="horizontal"
      className={cn("flex gap-0.5 rounded-md bg-muted p-[3px]", className)}
      {...aria}
    >
      {options.map((o) => (
        <RadioGroupPrimitive.Item
          key={o.value}
          value={o.value}
          className="h-8 flex-1 cursor-pointer rounded-sm px-3 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=checked]:bg-card data-[state=checked]:text-foreground data-[state=checked]:shadow-xs"
        >
          {o.label}
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  )
}
