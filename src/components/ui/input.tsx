import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * DS sheet 08 · Input (Default / Focus / Error / Disabled). 36px (40 with fieldSize="lg"), px-3, gap-2,
 * rounded-md, bg-card, border-input, shadow-xs. Focus = border-ring + 3px ring/50; error = aria-invalid.
 * `startIcon` / `end` render inside the box (search, mail, lock icons; show-password button…).
 * Text is 16px below md so iOS Safari doesn't zoom on focus, 14px from md (design: 14 everywhere).
 */
const boxClass =
  "flex w-full min-w-0 items-center gap-2 rounded-md border border-input bg-card px-3 shadow-xs transition-[color,box-shadow,border-color]"
const focusClass = "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
const invalidClass = "aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20"

type InputProps = React.ComponentProps<"input"> & {
  fieldSize?: "default" | "lg"
  startIcon?: React.ReactNode
  end?: React.ReactNode
}

function Input({ className, type, fieldSize = "default", startIcon, end, ...props }: InputProps) {
  const h = fieldSize === "lg" ? "h-10" : "h-9"
  // Latin values (email, mobile, password) keep dir="ltr" but still sit at the start edge in Arabic, as in the design.
  const textClass = cn(
    "text-base text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground md:text-sm",
    props.dir === "ltr" && "rtl:text-right"
  )

  if (!startIcon && !end) {
    return (
      <input
        type={type}
        data-slot="input"
        className={cn(
          boxClass,
          h,
          textClass,
          "outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          focusClass,
          invalidClass,
          className
        )}
        {...props}
      />
    )
  }

  return (
    <div
      data-slot="input-group"
      className={cn(
        boxClass,
        h,
        "has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50",
        "has-[input[aria-invalid=true]]:border-destructive has-[input[aria-invalid=true]]:ring-[3px] has-[input[aria-invalid=true]]:ring-destructive/20",
        "has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50",
        "[&>svg]:text-muted-foreground",
        className
      )}
    >
      {startIcon}
      <input
        type={type}
        data-slot="input"
        className={cn("h-full w-0 min-w-0 flex-1 bg-transparent outline-none disabled:pointer-events-none", textClass)}
        {...props}
      />
      {end}
    </div>
  )
}

export { Input }
