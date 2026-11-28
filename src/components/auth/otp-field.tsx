"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { RESEND_SECONDS } from "@/lib/auth-utils"
import { Icon } from "@/components/ds/icon"
import { Unavailable } from "./parts"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"

/**
 * DS sheet 11 · OTP block: 6 boxes (always LTR, auto-advance, paste fills all) · error line (destructive,
 * box row shakes once and keeps the digits) · resend row: clock + "Resend code in 00:45" counting down,
 * then "Didn't get it? Resend code".
 */
export function OtpField({
  value,
  onChange,
  onComplete,
  error,
  shakeKey,
  onResend,
  resendOff,
}: {
  value: string
  onChange: (v: string) => void
  onComplete?: (v: string) => void
  error?: string
  /** Changes on every failed attempt to replay the shake. */
  shakeKey?: number
  onResend: () => void
  /** Resend is not connected yet (D49): the row stays, switched off, with "Not available yet". */
  resendOff?: boolean
}) {
  const t = useTranslations("auth.otp")
  const [left, setLeft] = React.useState(RESEND_SECONDS)
  const id = React.useId()

  React.useEffect(() => {
    if (left <= 0) return
    const timer = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [left])

  const canResend = left <= 0 || !!error
  return (
    <div className="flex flex-col gap-2.5">
      <div key={shakeKey} className={cn(shakeKey && "animate-shake motion-reduce:animate-none")}>
        <InputOTP
          maxLength={6}
          value={value}
          onChange={onChange}
          onComplete={onComplete}
          pattern="^[0-9]*$"
          aria-label={t("label")}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          autoFocus
        >
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {resendOff ? (
        <Unavailable reason="notAvailable" align="start">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {t("didntGet")}
            <span className="text-sm font-medium opacity-50">{t("resend")}</span>
          </span>
        </Unavailable>
      ) : (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
        {canResend ? (
          <>
            {t("didntGet")}
            <button
              type="button"
              onClick={() => {
                setLeft(RESEND_SECONDS)
                onResend()
              }}
              className="cursor-pointer rounded-sm text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {t("resend")}
            </button>
          </>
        ) : (
          <>
            <Icon name="clock" size={16} />
            {t("resendIn")}
            <span className="font-medium text-foreground tabular-nums" dir="ltr">
              00:{String(left).padStart(2, "0")}
            </span>
          </>
        )}
      </div>
      )}
    </div>
  )
}
