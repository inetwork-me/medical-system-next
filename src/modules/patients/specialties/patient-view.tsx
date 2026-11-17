"use client"

import * as React from "react"
import Image from "next/image"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { useIsMobile } from "@/hooks/use-media-query"
import { Icon } from "@/components/ds/icon"
import { useText } from "../profile/use-patient"
import { specialtyHref, type Gaze, type Grades } from "./data"
import { useEyeRecord } from "./eye-store"
import { LiveEye } from "./three/live"

/**
 * Eye · Patient view (1440 / 768 / 390): dark full-screen explanation for the patient. Top bar (close · title · step),
 * the eyes on a stage, explain card with three steps and big Look right / Straight ahead / Look left buttons.
 * The buttons and the stage are anatomical (patient's right on the viewer's left) in both languages.
 * Close returns to the eye exam (to the Eyes tab on phones, which are view-only). Works on a phone.
 */

type Look = "right" | "ahead" | "left"
const STEP_LOOK: Look[] = ["ahead", "right", "ahead"]

export function EyePatientView() {
  const t = useTranslations("specialties.pv")
  const { id } = useParams<{ id: string }>()
  const rec = useEyeRecord(id)
  const mobile = useIsMobile()
  const { b, locale } = useText()
  const [step, setStep] = React.useState(1)
  const [look, setLook] = React.useState<Look | null>(null)
  const shown: Look = look ?? STEP_LOOK[step]
  const go = React.useCallback((s: number) => {
    setStep(Math.max(0, Math.min(2, s)))
    setLook(null)
  }, [])
  const rtl = locale === "ar"
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(step + (rtl ? -1 : 1))
      if (e.key === "ArrowLeft") go(step + (rtl ? 1 : -1))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [go, step, rtl])
  const touch = React.useRef<number | null>(null)
  const doctor = rec?.exams[0]?.doctor
  const close = mobile ? specialtyHref.eyes(id) : specialtyHref.eyeExam(id)

  return (
    <main className="flex h-svh flex-col overflow-hidden bg-slate-950 text-white">
      <header className="flex shrink-0 items-center gap-3 p-4 md:p-5 xl:p-6">
        <Link
          href={close}
          aria-label={t("close")}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 outline-none transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <Icon name="close-circle" size={20} />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="truncate text-base font-semibold md:text-xl">{t("title")}</h1>
          {doctor && <p className="truncate text-xs text-slate-400">{t("by", { doctor: b(doctor) })}</p>}
        </div>
        <span dir="ltr" className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium tabular-nums" aria-live="polite">
          {step + 1} / 3
        </span>
      </header>

      <section
        className="relative flex min-h-0 flex-1 flex-col justify-end bg-[radial-gradient(circle_at_50%_35%,#1e3a8a_0%,#0f172a_55%,#020617_100%)] p-4 md:p-5 xl:p-6"
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current == null) return
          const dx = e.changedTouches[0].clientX - touch.current
          touch.current = null
          if (Math.abs(dx) > 50) go(step + ((dx < 0) !== rtl ? 1 : -1))
        }}
      >
        <Stage look={shown} alt={t(`look.${shown}`)} grades={rec?.exams[0]?.grades} />
        <div className="relative flex flex-col gap-3.5 rounded-2xl border border-white/12 bg-slate-900/90 p-4 backdrop-blur md:p-5">
          <h2 className="text-base font-semibold md:text-xl">{t(`steps.${String(step) as "0" | "1" | "2"}.title`)}</h2>
          <p className="text-sm text-slate-300 md:text-base">{t(`steps.${String(step) as "0" | "1" | "2"}.text`)}</p>
          {/* Anatomical order: Look right (patient's right) first, on the viewer's left, in both languages. */}
          <div dir="ltr" role="group" aria-label={t("lookLabel")} className="grid grid-cols-3 gap-2 md:flex md:flex-wrap">
            {(["right", "ahead", "left"] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={shown === k}
                onClick={() => setLook(k)}
                className={cn(
                  "h-10 rounded-full border px-2 text-[13px] font-medium whitespace-nowrap outline-none md:px-4 md:text-sm transition-colors focus-visible:ring-2 focus-visible:ring-white/60",
                  shown === k ? "border-transparent bg-[#2B6BFF] text-white" : "border-white/20 bg-white/10 text-white hover:bg-white/20",
                )}
              >
                <span dir={rtl ? "rtl" : "ltr"}>{t(`look.${k}`)}</span>
              </button>
            ))}
          </div>
          <div className="flex justify-center gap-1.5" role="tablist" aria-label={t("stepsLabel")}>
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={step === i}
                aria-label={t("stepN", { n: i + 1 })}
                onClick={() => go(i)}
                className={cn(
                  "h-2 rounded-full outline-none transition-all focus-visible:ring-2 focus-visible:ring-white/60",
                  step === i ? "w-6 bg-[#2B6BFF]" : "w-2 bg-white/30 hover:bg-white/50",
                )}
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

/** The eyes: live 3D (the weak muscle in orange) over the still renders, which stay as the loading state / no-WebGL fallback. */
function Stage({ look, alt, grades }: { look: Look; alt: string; grades?: Grades }) {
  const [ready, setReady] = React.useState(false)
  return (
    <>
      <div className={cn("transition-opacity duration-300", ready && "opacity-0")}>
        <Still look={look} alt={alt} />
      </div>
      {grades && (
        <div className="absolute inset-x-0 top-0 bottom-1/4">
          <LiveEye grades={grades} gaze={GAZE_OF[look]} angle={30} mode="patient" onReady={() => setReady(true)} />
        </div>
      )}
    </>
  )
}
const GAZE_OF: Record<Look, Gaze> = { right: "right", ahead: "primary", left: "left" }

function Still({ look, alt }: { look: Look; alt: string }) {
  if (look === "right")
    return (
      <div className="absolute inset-0">
        <Image src="/specialties/eye_edu_m.png" alt={alt} fill sizes="100vw" className="object-cover md:hidden" priority />
        <Image src="/specialties/eye_edu_t.png" alt={alt} fill sizes="100vw" className="object-cover max-md:hidden xl:hidden" priority />
        <Image src="/specialties/eye_edu_d.png" alt={alt} fill sizes="100vw" className="object-cover max-xl:hidden" priority />
      </div>
    )
  return (
    <div className="absolute inset-x-0 top-0 bottom-1/4 flex items-center justify-center">
      {/* Sized to the render so the soft mask fades its own edges into the stage. */}
      <div
        className={cn(
          "relative max-h-full max-w-full [mask-image:radial-gradient(closest-side,black_70%,transparent)]",
          look === "ahead" ? "aspect-[748/804] h-full" : "aspect-[480/200] w-full",
        )}
      >
        <Image src={look === "ahead" ? "/specialties/eye_ws_d_primary.png" : "/specialties/eye_9_mid_l.png"} alt={alt} fill sizes="100vw" className="object-cover" />
      </div>
    </div>
  )
}
