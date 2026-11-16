"use client"

import * as React from "react"
import { OTPInput, OTPInputContext } from "input-otp"

import { cn } from "@/lib/utils"

/**
 * DS sheet 11 · OTP Input: six 48×56 cells, gap 10, rounded-lg, bg-card, 20 SemiBold digits.
 * Empty = border-input + shadow-xs; active = border-ring + focus ring + 2×22 caret; filled = border-primary;
 * error (aria-invalid on <InputOTP>) = border-destructive + destructive digits. Always LTR, Latin digits.
 */
function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & { containerClassName?: string }) {
  return (
    <OTPInput
      data-slot="input-otp"
      inputMode="numeric"
      autoComplete="one-time-code"
      containerClassName={cn(
        // w-fit: the LTR box row still sits at the start edge of an RTL form (right side in Arabic).
        "group/otp flex w-fit max-w-full min-w-0 items-center gap-2.5 has-disabled:opacity-50",
        containerClassName
      )}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
      // OTP digits are always left-to-right, also inside Arabic screens.
      dir="ltr"
    />
  )
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="input-otp-group" dir="ltr" className={cn("flex min-w-0 items-center gap-2.5", className)} {...props} />
}

function InputOTPSlot({ index, className, ...props }: React.ComponentProps<"div"> & { index: number }) {
  const ctx = React.useContext(OTPInputContext)
  const { char, hasFakeCaret, isActive } = ctx?.slots[index] ?? {}

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      data-filled={!!char}
      className={cn(
        "relative flex h-14 w-12 min-w-10 shrink items-center justify-center rounded-lg border border-input bg-card text-xl font-semibold text-foreground tabular-nums shadow-xs transition-[border-color,box-shadow] outline-none",
        "data-[filled=true]:border-primary",
        "data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-[3px] data-[active=true]:ring-ring/50",
        "group-has-[[aria-invalid=true]]/otp:border-destructive group-has-[[aria-invalid=true]]/otp:text-destructive group-has-[[aria-invalid=true]]/otp:data-[active=true]:ring-destructive/20",
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-5.5 w-0.5 animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  )
}

export { InputOTP, InputOTPGroup, InputOTPSlot }
