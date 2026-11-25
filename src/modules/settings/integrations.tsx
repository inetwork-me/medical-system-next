"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { can } from "@/lib/permissions"
import { isTabEnabled } from "@/lib/modules"
import { Icon, type IconName } from "@/components/ds/icon"
import { StatusBadge } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { BrandMark } from "@/modules/messages/parts"
import { CONNECTIONS, SMS_ACCOUNT } from "@/modules/messages/data"
import { canEditSection } from "./access"
import { daysBetween, expiringUnits } from "./checks"
import { INTEGRATION_FACTS, SET_TODAY } from "./data"
import { SettingsFrame } from "./frame"
import { SetCard, useUserText } from "./parts"
import { SERVICES, type IntegrationId, type TestResult } from "./services/integrations"
import { markChecked, useBranches, useChecked, useZatcaUnits } from "./store"

type Card = {
  id: IntegrationId
  icon?: IconName
  brand?: "m365" | "whatsapp"
  status: "ok" | "expiring" | "offline"
  detail: string
  warn?: boolean
  action: "test" | "manage" | "open"
}

/** Runs health checks through the service stubs; returns the runner and which ones are running. */
export function useHealthCheck() {
  const { t, b } = useUserText()
  const [busy, setBusy] = React.useState<IntegrationId[]>([])
  const run = async (ids: IntegrationId[], all = false) => {
    const testable = ids.filter((id): id is Exclude<IntegrationId, "m365" | "sms"> => id in SERVICES)
    setBusy(testable)
    const results: [IntegrationId, TestResult][] = await Promise.all(testable.map(async (id) => [id, await SERVICES[id].test()] as [IntegrationId, TestResult]))
    setBusy([])
    markChecked(testable)
    const warned = results.filter(([, r]) => r.warning)
    if (all) {
      const okN = results.filter(([, r]) => r.ok && !r.warning).length + ids.length - testable.length
      if (warned.length) toast.warning(t("integrations.testAll", { ok: okN, warn: warned.length }), { description: b(warned[0][1].warning!) })
      else toast.success(t("toasts.testOk"), { description: t("integrations.allOk", { n: okN }) })
      return
    }
    const [, r] = results[0]
    if (r.warning) toast.warning(t("integrations.answeredWarn"), { description: b(r.warning) })
    else toast.success(t("toasts.testOk"), { description: t("toasts.testOkText", { s: r.seconds }) })
  }
  return { run, busy }
}

/**
 * Settings · Integrations: cards for NPHIES, ZATCA · Fatoora, Seha, Yakeen, Nafath, Microsoft 365, SMS and WhatsApp, mada
 * terminals and lab analyzers (HL7) — icon, status badge (Connected / Certificate expiring / 1 offline), what it's for, a live
 * detail line, and Test (Manage for ZATCA → its page; Open for mail and SMS → Messages › Mail accounts). Warning cards have an
 * amber border. Header: Test all.
 */
export function IntegrationsPage() {
  const x = useUserText()
  const { t, b, n } = x
  const units = useZatcaUnits()
  const branches = useBranches()
  const checked = useChecked()
  const edit = canEditSection("integrations")
  const { run, busy } = useHealthCheck()
  const expiring = expiringUnits(units).sort((a, z) => a.certUntil.localeCompare(z.certUntil))[0]
  const branchName = (k: string) => {
    const br = branches.find((y) => y.key === k)
    return br ? b(br.name) : k
  }
  const m365 = CONNECTIONS.find((c) => c.provider === "m365")
  const offline = INTEGRATION_FACTS.mada.offline

  const cards: Card[] = [
    { id: "nphies", icon: "shield-tick", status: "ok", detail: t("integrations.checked", { when: x.agoInline(checked.nphies ?? INTEGRATION_FACTS.nphiesChecked) }), action: "test" },
    {
      id: "zatca",
      icon: "receipt-2",
      status: expiring ? "expiring" : "ok",
      detail: expiring ? t("integrations.zatcaLeft", { branch: branchName(expiring.branch), n: daysBetween(SET_TODAY, expiring.certUntil) }) : t("integrations.zatcaOk", { n: units.length }),
      warn: !!expiring,
      action: "manage",
    },
    { id: "seha", icon: "health", status: "ok", detail: t("integrations.month", { n: n(INTEGRATION_FACTS.sehaMonth) }), action: "test" },
    { id: "yakeen", icon: "personalcard", status: "ok", detail: t("integrations.checksMonth", { n: n(INTEGRATION_FACTS.yakeenMonth) }), action: "test" },
    { id: "nafath", icon: "finger-scan", status: "ok", detail: t("integrations.keyRenewed", { when: x.agoInline(INTEGRATION_FACTS.nafathKeyRenewed) }), action: "test" },
    { id: "m365", brand: "m365", status: m365?.status === "connected" ? "ok" : "offline", detail: t("integrations.inMessages"), action: "open" },
    { id: "sms", brand: "whatsapp", status: SMS_ACCOUNT.status === "connected" ? "ok" : "offline", detail: t("integrations.sender", { name: x.l(SMS_ACCOUNT.sender) }), action: "open" },
    {
      id: "mada",
      icon: "card",
      status: offline.length ? "offline" : "ok",
      detail: offline.length
        ? t("integrations.terminalsOff", { n: INTEGRATION_FACTS.mada.terminals, names: offline.map((o) => b(o.name)).join(", ") })
        : t("integrations.terminals", { n: INTEGRATION_FACTS.mada.terminals }),
      warn: offline.length > 0,
      action: "test",
    },
    { id: "hl7", icon: "glass", status: "ok", detail: t("integrations.analyzers", { n: INTEGRATION_FACTS.analyzers }), action: "test" },
  ]
  // Mail and SMS are managed in Messages › Mail accounts: the link shows when that tab is on and the user may open it.
  const mailOk = isTabEnabled("messages", "accounts") && can("messages", "edit")
  const testable = cards.filter((c) => c.action !== "open").map((c) => c.id)

  return (
    <SettingsFrame
      section="integrations"
      actions={
        <Button variant="outline" onClick={() => void run(testable, true)} disabled={busy.length > 0}>
          <Icon name="refresh" size={20} className={cn(busy.length > 1 && "animate-spin")} />
          {busy.length > 1 ? t("integrations.testing") : t("integrations.testAllBtn")}
        </Button>
      }
    >
      <SetCard title={t("pageTitles.integrations")} sub={t("integrations.sub")}>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => (
            <div key={c.id} className={cn("flex flex-col gap-1 rounded-xl border bg-card p-4", c.warn && "border-warning")}>
              <div className="flex items-start justify-between gap-2 pb-2">
                {c.brand ? (
                  <BrandMark kind={c.brand} size={32} />
                ) : (
                  <span className="flex size-9 items-center justify-center rounded-md bg-accent text-primary">
                    <Icon name={c.icon!} size={20} />
                  </span>
                )}
                {c.status === "ok" ? (
                  <StatusBadge tone="success">{t("integrations.connected")}</StatusBadge>
                ) : c.status === "expiring" ? (
                  <StatusBadge tone="warning">{t("integrations.expiring")}</StatusBadge>
                ) : (
                  <StatusBadge tone="warning">{t("integrations.offline", { n: c.id === "mada" ? offline.length : 1 })}</StatusBadge>
                )}
              </div>
              <span className="text-sm font-medium text-foreground">{t(`integrations.names.${c.id}`)}</span>
              <span className="text-xs text-muted-foreground">{t(`integrations.for.${c.id}`)}</span>
              <span className={cn("pb-2 text-xs", c.warn ? "text-warning-soft-foreground" : "text-muted-foreground")}>{c.detail}</span>
              <div className="mt-auto">
                {c.action === "manage" ? (
                  <Button size="sm" className="w-full" variant={c.warn ? "default" : "outline"} asChild>
                    <Link href="/settings/integrations/zatca">{t("integrations.manage")}</Link>
                  </Button>
                ) : c.action === "open" ? (
                  mailOk ? (
                    <Button size="sm" variant="outline" className="w-full" asChild>
                      <Link href="/messages/accounts">{t("integrations.open")}</Link>
                    </Button>
                  ) : (
                    <p className="py-1.5 text-center text-xs text-muted-foreground">{t("integrations.inMessagesOnly")}</p>
                  )
                ) : (
                  <Button size="sm" variant="outline" className="w-full" disabled={!edit || busy.includes(c.id)} onClick={() => void run([c.id])}>
                    {busy.includes(c.id) ? t("integrations.testing") : t("integrations.test")}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </SetCard>
    </SettingsFrame>
  )
}
