"use client"

import * as React from "react"

import { readSignedIn, subscribeSignedIn } from "@/lib/permissions"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { accessFor } from "@/modules/settings/access"
import { useSetText } from "@/modules/settings/frame"
import { ROLES, ROW_MODULES, SETTINGS_PERMS } from "@/modules/settings/roles-data"
import { signIn, useAuditEvents, useRoleAccess, writeAudit } from "@/modules/settings/store"
import { ME_USER, USERS } from "@/modules/settings/users-data"

const PATHS = ["/patients", "/patients/new", "/appointments", "/appointments/new", "/billing", "/lab", "/records", "/reports", "/messages", "/settings/users", "/settings/roles"]

/**
 * Dev: sign in again as the demo user with other roles. Permissions are a snapshot taken at sign-in (changes apply at the
 * next sign-in), so switching roles here re-takes it; the whole app follows (nav, guards, buttons).
 */
export function SettingsStories() {
  const { t, b } = useSetText()
  const signed = React.useSyncExternalStore(subscribeSignedIn, readSignedIn, () => null)
  const matrices = useRoleAccess()
  const audit = useAuditEvents()
  const mine = USERS.find((u) => u.id === ME_USER)!.roles
  const roles = signed?.roles ?? mine
  const [pick, setPick] = React.useState<string[]>(roles)
  const access = accessFor(roles, matrices)
  const toggle = (r: string) => setPick((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]))

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Sign in again with these roles (union)</h2>
        <p className="text-sm text-muted-foreground">
          Signed in as Dr. Khaled with: <b>{roles.join(" + ") || "no role"}</b>
          {signed ? ` (snapshot ${signed.at.replace("T", " ")})` : " (default — not signed in this session)"}
        </p>
        <div className="flex flex-wrap gap-4">
          {ROLES.map((r) => (
            <label key={r.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={pick.includes(r.id)} onCheckedChange={() => toggle(r.id)} />
              {b(r.name)}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          Work at:
          {(["olaya", "malaz", "jeddah"] as const).map((br) => (
            <Button key={br} size="sm" variant={(signed?.branch ?? "olaya") === br ? "default" : "outline"} onClick={() => signIn(ME_USER, roles, br)}>
              {br}
            </Button>
          ))}
          <span className="text-muted-foreground">(the app runs that branch&apos;s modules and tabs, as set in Settings › Modules)</span>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => signIn(ME_USER, pick)}>Sign in again</Button>
          <Button variant="outline" onClick={() => signIn(ME_USER, mine)}>
            Back to Dr. Khaled&apos;s own role
          </Button>
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Signed-in access (what the app enforces)</h2>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <tbody>
              {ROW_MODULES.map((m) => (
                <tr key={m} className="border-b">
                  <td className="p-2">{t(`modules.${m}`)}</td>
                  <td className="p-2 text-muted-foreground">
                    {Object.entries(signed?.access.modules[m] ?? access.modules[m] ?? {})
                      .map(([a, s]) => `${a}${s === "own" ? " (own)" : ""}`)
                      .join(", ") || "—"}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="p-2">{t("modules.settings")}</td>
                <td className="p-2 text-muted-foreground">
                  {SETTINGS_PERMS.filter((s) => (signed?.access ?? access).settings[s])
                    .map((s) => `${s}:${(signed?.access ?? access).settings[s]}`)
                    .join(", ") || "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {PATHS.map((p) => (
            <Link key={p} href={p} className="text-primary hover:underline">
              {p}
            </Link>
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Audit-log writer</h2>
        <div>
          <Button variant="outline" onClick={() => writeAudit({ what: { en: "Opened the dev preview", ar: "فتح صفحة المعاينة" }, where: "overview" })}>
            Write a test row
          </Button>
        </div>
        <ul className="flex flex-col divide-y rounded-xl border bg-card text-sm">
          {audit.length === 0 && <li className="p-3 text-muted-foreground">No rows written this session.</li>}
          {audit.map((a) => (
            <li key={a.id} className="flex flex-wrap gap-x-4 p-3">
              <span className="tabular-nums">{a.at.replace("T", " ")}</span>
              <span>{b(a.who)}</span>
              <span>{b(a.what)}</span>
              <span className="text-muted-foreground">
                {a.where} · {a.kind} · {a.ip}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
