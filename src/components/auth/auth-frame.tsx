import { getTranslations } from "next-intl/server"

import { Icon } from "@/components/ds/icon"
import { StatusBadge } from "@/components/ds/status-badge"
import { LangButton } from "./parts"

/**
 * Authentication page frame (Authentication page · 11 screens × 3 sizes):
 *  · ≥1024  split: 620px blue brand panel (start side; right in Arabic) + form column 400 wide, centred
 *  · 768–1023  bg-muted, top bar (brand + language), centred card 496 wide (p-9, rounded, border, shadow-md), footer
 *  · <768  full screen: top bar + form (px-6), no card
 */
export async function AuthFrame({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("auth.brand")
  return (
    <div className="flex min-h-dvh bg-background md:bg-muted lg:bg-background">
      <BrandPanel />
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 px-5 pt-4 pb-2 md:px-8 md:py-6 lg:py-5">
          <SmallBrand />
          <div className="flex-1" />
          <LangButton />
        </div>
        <main className="flex flex-1 justify-center px-6 pt-6 pb-8 md:items-center md:px-8 md:pt-4 md:pb-8 lg:pb-12">
          <div className="flex w-full flex-col gap-5 md:max-w-124 md:rounded-2xl md:border md:bg-card md:p-9 md:shadow-md lg:max-w-100 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
            {children}
          </div>
        </main>
        <footer className="hidden px-8 pt-4 pb-6 text-center text-xs text-muted-foreground md:block lg:hidden">{t("footer")}</footer>
      </div>
    </div>
  )
}

async function SmallBrand() {
  const tc = await getTranslations("common.app")
  return (
    <div className="flex items-center gap-2.5 lg:hidden">
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Icon name="hospital" size={20} />
      </span>
      <span className="text-lg font-semibold text-foreground">{tc("name")}</span>
    </div>
  )
}

/** Brand art: uses the blue scale directly (blue-100/200/500) exactly as the design's brand panel does. */
const BARS = [18, 26, 22, 34, 30, 40, 46]

async function BrandPanel() {
  const t = await getTranslations("auth.brand")
  const tc = await getTranslations("common.app")
  const features = [
    ["profile-2user", t("feature1")],
    ["calendar-tick", t("feature2")],
    ["shield-tick", t("feature3")],
  ] as const
  return (
    <aside className="sticky top-0 hidden h-dvh w-155 shrink-0 flex-col justify-between overflow-hidden bg-primary p-14 text-primary-foreground lg:flex">
      <div className="flex items-center gap-2.5">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary-foreground text-primary">
          <Icon name="hospital" size={22} />
        </span>
        <span className="text-lg font-semibold">{tc("name")}</span>
      </div>
      <div className="flex flex-col gap-5">
        <p className="text-3xl font-semibold tracking-tight">{t("pitch")}</p>
        <p className="text-base text-blue-100">{t("sub")}</p>
        {features.map(([icon, label]) => (
          <div key={icon} className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-500">
              <Icon name={icon} size={18} />
            </span>
            <span className="text-sm font-medium">{label}</span>
          </div>
        ))}
      </div>
      <div aria-hidden className="flex w-85 flex-col gap-2.5 rounded-2xl bg-card p-5 text-card-foreground shadow-lg">
        <div className="flex items-center gap-2">
          <span className="flex-1 text-xs text-muted-foreground">{t("cardLabel")}</span>
          <StatusBadge tone="success">+12.5%</StatusBadge>
        </div>
        <span className="text-2xl font-semibold tracking-tight tabular-nums">1,284</span>
        {/* Time runs from the start edge, so in Arabic the latest month sits on the left. */}
        <div className="flex h-12 items-end gap-1.5">
          {BARS.map((h, i) => (
            <span
              key={i}
              className={i === BARS.length - 1 ? "flex-1 rounded-[3px] bg-chart-1" : "flex-1 rounded-[3px] bg-blue-200"}
              style={{ height: h }}
            />
          ))}
        </div>
      </div>
      <p className="text-xs text-blue-100">{t("footer")}</p>
    </aside>
  )
}
