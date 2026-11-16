"use client"

import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * DS sheet 10 · Radio Option (card choice, e.g. payment method): p-3, gap-2.5, rounded-lg, border;
 * unchecked = card / border, checked = accent fill + primary border. Title 14 Medium + description 12 muted.
 * Use inside <RadioGroup>.
 */
export function RadioOption({
  title,
  description,
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item> & {
  title: React.ReactNode
  description?: React.ReactNode
}) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-option"
      className={cn(
        "group/radio flex w-full cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-card p-3 text-start transition-colors outline-none hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-accent",
        className
      )}
      {...props}
    >
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-card group-data-[state=checked]/radio:border-primary">
        <RadioGroupPrimitive.Indicator className="size-2 rounded-full bg-primary" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{title}</span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </span>
    </RadioGroupPrimitive.Item>
  )
}
