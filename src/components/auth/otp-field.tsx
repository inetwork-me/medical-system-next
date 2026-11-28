"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { RESEND_SECONDS } from "@/lib/auth-utils"
import { Icon } from "@/components/ds/icon"
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
  wait,
}: {
  value: string
  onChange: (v: string) => void
  onComplete?: (v: string) => void
  error?: string
  /** Changes on every failed attempt to replay the shake. */
  shakeKey?: number
  onResend: () => void
  /**
   * On the API the wait is the server's: the countdown restarts from `seconds` whenever `key` changes, and the link shows
   * only when it reaches 0 (a wrong code does not open it). Without `wait` it is the mock behaviour (45 s, or after an error).
   */
  wait?: { seconds: number; key: number }
}) {
  const t = useTranslations("auth.otp")
  const [left, setLeft] = React.useState(wait ? wait.seconds : RESEND_SECONDS)
  const id = React.useId()

  React.useEffect(() => {
    if (left <= 0) return
    const timer = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [left])

  // The server's wait restarts the countdown (state adjusted while rendering, not in an effect).
  const [seenKey, setSeenKey] = React.useState(wait?.key)
  if (wait && seenKey !== wait.key) {
    setSeenKey(wait.key)
    setLeft(wait.seconds)
  }

  const canResend = left <= 0 || (!wait && !!error)
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
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
        {canResend ? (
          <>
            {t("didntGet")}
            <button
              type="button"
              onClick={() => {
                if (!wait) setLeft(RESEND_SECONDS)
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
              {String(Math.floor(left / 60)).padStart(2, "0")}:{String(left % 60).padStart(2, "0")}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
