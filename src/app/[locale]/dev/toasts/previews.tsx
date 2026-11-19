"use client"

import * as React from "react"
import { useLocale } from "next-intl"

import { ToastCard, toast, type ToastTone } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"

type Dir = "ltr" | "rtl"
type Layout = "default" | "action" | "compact"
type Copy = { title: string; description: string; actions: string[] }

const TONES: ToastTone[] = ["success", "error", "warning", "info", "neutral", "loading"]
const LAYOUTS: Layout[] = ["default", "action", "compact"]

/** Sample copy from the Toast component set on sheet 12 (EN / AR). */
const COPY: Record<Dir, Record<ToastTone, Copy>> = {
  ltr: {
    success: { title: "Leave approved", description: "19 bookings moved to Dr. Faisal.", actions: ["Undo", "View"] },
    error: { title: "Couldn't save changes", description: "Check your connection and try again.", actions: ["Try again", "Details"] },
    warning: { title: "Saved with 2 gaps", description: "Insurance number and ID expiry are still empty.", actions: ["Complete now", "Later"] },
    info: { title: "Report is being prepared", description: "We'll tell you when it's ready to download.", actions: ["Open reports"] },
    neutral: { title: "File number copied", description: "Paste it anywhere in the system.", actions: ["Undo"] },
    loading: { title: "Sending reminders…", description: "12 of 38 sent", actions: ["Cancel"] },
  },
  rtl: {
    success: { title: "انعتمدت الإجازة", description: "انتقلت 19 حجز للدكتور فيصل.", actions: ["تراجع", "اعرض"] },
    error: { title: "ما انحفظت التغييرات", description: "تأكد من الاتصال وجرّب مرة ثانية.", actions: ["جرّب مرة ثانية", "التفاصيل"] },
    warning: { title: "انحفظ وباقي شي", description: "رقم التأمين وتاريخ انتهاء الهوية باقيين فاضيين.", actions: ["كمّلها الحين", "بعدين"] },
    info: { title: "التقرير قاعد يتجهز", description: "بنعلمك أول ما يجهز للتحميل.", actions: ["افتح التقارير"] },
    neutral: { title: "انتسخ رقم الملف", description: "تقدر تلصقه في أي مكان بالنظام.", actions: ["تراجع"] },
    loading: { title: "قاعد نرسل التذكيرات…", description: "انرسل 12 من 38", actions: ["إلغاء"] },
  },
}

const noop = () => {}

function Story({ tone, layout, dir }: { tone: ToastTone; layout: Layout; dir: Dir }) {
  const c = COPY[dir][tone]
  const a = (i: number) => (c.actions[i] ? { label: c.actions[i], onClick: noop } : undefined)
  return (
    <div dir={dir} lang={dir === "rtl" ? "ar" : "en"} className="flex flex-col gap-1.5">
      <span className="font-mono text-[11px] text-muted-foreground" dir="ltr">
        Tone={tone} · Layout={layout} · Dir={dir.toUpperCase()}
      </span>
      <ToastCard
        tone={tone}
        title={c.title}
        description={layout === "compact" ? undefined : c.description}
        action={layout === "default" ? undefined : a(0)}
        secondaryAction={layout === "action" ? a(1) : undefined}
        compact={layout === "compact"}
        onClose={noop}
        closeLabel={dir === "rtl" ? "إغلاق" : "Close"}
        timer={235 / 378}
        className="w-95 max-w-full"
      />
    </div>
  )
}

export function ToastPreviews() {
  const dir: Dir = useLocale() === "ar" ? "rtl" : "ltr"
  const c = COPY[dir]
  const ok = (i: number) => ({ label: c.success.actions[i], onClick: () => toast.info(dir === "rtl" ? "تم التراجع" : "Undone") })
  const fire = (tone: ToastTone, opts: { action?: boolean; compact?: boolean } = {}) => {
    const x = c[tone]
    const action = opts.action ? { label: x.actions[0], onClick: noop } : undefined
    const secondaryAction = opts.action && x.actions[1] ? { label: x.actions[1], onClick: noop } : undefined
    const base = { description: x.description, compact: opts.compact }
    if (tone === "error") return toast.error(x.title, { ...base, secondaryAction, retry: () => toast.success(c.success.title, { description: c.success.description }) })
    if (tone === "neutral") return toast.message(x.title, { ...base, action, secondaryAction })
    if (tone === "loading") return toast.loading(x.title, { ...base, action, secondaryAction })
    return toast[tone](x.title, { ...base, action, secondaryAction })
  }
  const wait = (ms: number, fail = false) => () => new Promise<void>((res, rej) => setTimeout(() => (fail ? rej(new Error("x")) : res()), ms))
  const promise = (fail: boolean) =>
    toast
      .promise(wait(1800, fail), {
        loading: { title: c.loading.title, description: c.loading.description },
        success: { title: c.success.title, description: c.success.description },
        error: { title: c.error.title, description: c.error.description },
      })
      .catch(noop)

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Playground</h2>
        <div className="flex flex-wrap gap-2">
          {TONES.map((tone) => (
            <Button key={tone} variant="outline" size="sm" onClick={() => fire(tone)}>
              {tone}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => toast.success(c.success.title, { description: c.success.description, action: ok(0), secondaryAction: ok(1) })}>
            success + 2 actions
          </Button>
          <Button variant="outline" size="sm" onClick={() => fire("neutral", { action: true, compact: true })}>
            compact
          </Button>
          <Button variant="outline" size="sm" onClick={() => fire("success")}>
            same again (×2)
          </Button>
          <Button variant="outline" size="sm" onClick={() => (["info", "warning", "neutral", "success"] as ToastTone[]).forEach((t, i) => setTimeout(() => fire(t), i * 250))}>
            stack of 4
          </Button>
          <Button variant="outline" size="sm" onClick={() => promise(false)}>
            promise → success
          </Button>
          <Button variant="outline" size="sm" onClick={() => promise(true)}>
            promise → error
          </Button>
          <Button variant="ghost" size="sm" onClick={() => toast.dismiss()}>
            dismiss all
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">F6 jumps to the Notifications region · Esc closes the focused toast · hover pauses the timers.</p>
      </section>

      {(["ltr", "rtl"] as Dir[]).map((d) => (
        <section key={d} className="flex flex-col gap-6">
          <h2 className="text-xl font-semibold">{d === "ltr" ? "LTR · English" : "RTL · Arabic"}</h2>
          {LAYOUTS.map((layout) => (
            <div key={layout} className="flex flex-col gap-3">
              <h3 className="text-sm font-medium capitalize text-muted-foreground">{layout}</h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,380px),1fr))] items-start gap-6">
                {TONES.map((tone) => (
                  <Story key={tone} tone={tone} layout={layout} dir={d} />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
