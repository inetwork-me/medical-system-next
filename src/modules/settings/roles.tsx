"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { useRouter } from "@/i18n/navigation"
import { PERM_ACTIONS, type Access, type PermAction, type Scope, type SettingsGrant } from "@/lib/permissions"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Segmented } from "@/components/ds/segmented"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { canEditSection } from "./access"
import { SettingsFrame } from "./frame"
import { ActionChip, Note, useUserText } from "./parts"
import { ROW_MODULES, SETTINGS_PERMS, type RoleDef, type RoleKey, type SettingsPerm } from "./roles-data"
import { addRole, saveRoleAccess, useRoleAccess, useRoles, useUsers, writeAudit } from "./store"

type RowModule = (typeof ROW_MODULES)[number]
type Row = RowModule | "settings"

const clone = (a: Access): Access => JSON.parse(JSON.stringify(a)) as Access

/** Cell cycle on the desktop matrix: — → all branches → own branch → —. */
const nextScope = (s?: Scope): Scope | undefined => (!s ? "all" : s === "all" ? "own" : undefined)

function setScope(a: Access, m: RowModule, act: PermAction, s: Scope | undefined): Access {
  const out = clone(a)
  const g = { ...(out.modules[m] ?? {}) }
  if (s) g[act] = s
  else delete g[act]
  // Any other action needs View; turning View off clears the row.
  if (s && act !== "view" && !g.view) g.view = s
  if (!s && act === "view") for (const k of PERM_ACTIONS) delete g[k]
  out.modules[m] = g
  return out
}
function setSection(a: Access, s: SettingsPerm, gr: SettingsGrant | undefined): Access {
  const out = clone(a)
  if (gr) out.settings[s] = s === "audit" && gr === "edit" ? "view" : gr
  else delete out.settings[s]
  return out
}

/** Changes between the saved and the draft access, for the audit row ("Billing · Create: own branch"). */
function diffLines(before: Access, after: Access) {
  const out: string[] = []
  for (const m of ROW_MODULES)
    for (const act of PERM_ACTIONS) {
      const x = before.modules[m]?.[act]
      const y = after.modules[m]?.[act]
      if (x !== y) out.push(`${m} · ${act}: ${y ? (y === "all" ? "all branches" : "own branch") : "off"}`)
    }
  for (const s of SETTINGS_PERMS) if (before.settings[s] !== after.settings[s]) out.push(`settings · ${s}: ${after.settings[s] ?? "off"}`)
  return out
}

/**
 * Settings · Roles and access: desktop = the role list (name + members, New role) beside the permission matrix for the
 * selected role (rows = modules, columns View / Create / Edit / Approve / Export; cells tick / dash / amber "Own branch",
 * clicked to change; the Settings row opens into one row per section). Below xl = a role switcher and per-module chips; a
 * row opens a sheet to change it. Changes apply at the next sign-in and every save is logged. Header: New role, Save role.
 */
export function RolesPage() {
  const x = useUserText()
  const { t, b, n } = x
  const router = useRouter()
  const params = useSearchParams()
  const roles = useRoles()
  const saved = useRoleAccess()
  const users = useUsers()
  const edit = canEditSection("roles")
  const [selected, setSelected] = React.useState<RoleKey>(() => {
    const p = params.get("role")
    return p && roles.some((r) => r.id === p) ? p : "reception"
  })
  const [drafts, setDrafts] = React.useState<Record<RoleKey, Access>>({})
  const [newRole, setNewRole] = React.useState(false)
  const [sheet, setSheet] = React.useState<Row | null>(null)

  const role = roles.find((r) => r.id === selected) ?? roles[0]
  const access = drafts[role.id] ?? saved[role.id]
  const dirty = !!drafts[role.id] && diffLines(saved[role.id], drafts[role.id]).length > 0
  const locked = !!role.locked || !edit
  const members = (id: RoleKey) => users.filter((u) => u.status === "active" && u.roles.includes(id)).length
  const update = (a: Access) => setDrafts((d) => ({ ...d, [role.id]: a }))

  const pick = (id: RoleKey) => {
    setSelected(id)
    router.replace(`/settings/roles?role=${id}`, { scroll: false })
  }
  const save = () => {
    const lines = diffLines(saved[role.id], access)
    saveRoleAccess(role.id, access)
    setDrafts((d) => {
      const rest = { ...d }
      delete rest[role.id]
      return rest
    })
    if (lines.length) {
      writeAudit({ what: { en: `Changed the ${role.name.en} role: ${lines.join("; ")}`, ar: `غيّر دور ${role.name.ar}: ${lines.join("؛ ")}` }, where: "roles" })
    }
    toast.success(t("toasts.roleSaved", { role: b(role.name) }), { description: t("toasts.roleSavedText") })
  }

  const actions = edit ? (
    <>
      <Button variant="outline" onClick={() => setNewRole(true)}>
        <Icon name="add" size={20} />
        {t("roles.new")}
      </Button>
      <Button onClick={save} disabled={!!role.locked}>
        {t("roles.save")}
      </Button>
    </>
  ) : undefined

  const peopleLine = t("roles.people", { n: n(members(role.id)) })

  return (
    <SettingsFrame section="roles" actions={actions}>
      {/* Desktop: role list + matrix */}
      <section className="hidden overflow-hidden rounded-xl border bg-card xl:flex">
        <div className="flex w-[220px] shrink-0 flex-col gap-1 border-e p-3">
          <p className="px-2.5 pb-1 text-xs text-muted-foreground">{t("roles.list")}</p>
          {roles.map((r) => {
            const on = r.id === role.id
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => pick(r.id)}
                aria-current={on ? "true" : undefined}
                className={cn(
                  "flex h-10 cursor-pointer items-center gap-2 rounded-md px-2.5 text-start text-sm text-foreground outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  on && "bg-accent text-primary hover:bg-accent"
                )}
              >
                <span className="min-w-0 flex-1 truncate">{b(r.name)}</span>
                {drafts[r.id] && diffLines(saved[r.id], drafts[r.id]).length > 0 && <span aria-label={t("roles.unsaved")} role="img" className="size-1.5 rounded-full bg-warning" />}
                <span className="text-xs text-muted-foreground tabular-nums">{n(members(r.id))}</span>
              </button>
            )
          })}
          {edit && (
            <Button variant="outline" size="sm" className="mt-1" onClick={() => setNewRole(true)}>
              <Icon name="add" size={16} />
              {t("roles.new")}
            </Button>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-6">
          <header className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2 className="text-lg font-semibold text-foreground">{b(role.name)}</h2>
              <p className="text-xs text-muted-foreground">
                {peopleLine} · {t("roles.applies")}
                {dirty && <span className="text-warning"> · {t("roles.unsaved")}</span>}
              </p>
            </div>
          </header>
          <Matrix access={access} locked={locked} onChange={update} />
          {role.locked ? <Note tone="warning">{t("roles.lockedNote")}</Note> : <Note>{t("roles.note")}</Note>}
        </div>
      </section>

      {/* Tablet / mobile: role switcher + chips */}
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 xl:hidden">
        <header className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="text-lg font-semibold text-foreground">{t("pageTitles.roles")}</h2>
            <p className="text-xs text-muted-foreground">{t("status.roles", { count: roles.length })}</p>
          </div>
          {edit && (
            <Button variant="outline" size="icon" aria-label={t("roles.new")} onClick={() => setNewRole(true)}>
              <Icon name="add" size={20} />
            </Button>
          )}
        </header>
        <Select value={role.id} onValueChange={pick}>
          <SelectTrigger className="w-full" aria-label={t("roles.list")}>
            <span className="flex min-w-0 items-center gap-2">
              <Icon name="security-user" size={18} className="shrink-0 text-muted-foreground" />
              <span className="truncate">
                {b(role.name)} · {peopleLine}
              </span>
            </span>
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {b(r.name)} · {t("roles.people", { n: n(members(r.id)) })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {dirty && <p className="-mt-2 text-xs text-warning">{t("roles.unsaved")}</p>}
        <ul className="flex flex-col divide-y">
          {[...ROW_MODULES, "settings" as const].map((m) => {
            const chips: [string, Scope][] =
              m === "settings"
                ? SETTINGS_PERMS.filter((s) => access.settings[s]).map((s) => [t(`sections.${s}`) + (access.settings[s] === "view" ? ` · ${t("roles.viewOnly")}` : ""), "all"])
                : PERM_ACTIONS.filter((a) => access.modules[m]?.[a]).map((a) => [t(`actionsMatrix.${a}`), access.modules[m]![a]!])
            const body = (
              <>
                <span className="text-sm text-foreground">{t(`modules.${m}`)}</span>
                {chips.length ? (
                  <span className="flex flex-wrap gap-1.5">
                    {chips.map(([label, scope]) => (
                      <ActionChip key={label} scope={scope}>
                        {label}
                      </ActionChip>
                    ))}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">{t("roles.noAccess")}</span>
                )}
              </>
            )
            return (
              <li key={m}>
                {locked ? (
                  <div className="flex flex-col gap-1.5 py-3">{body}</div>
                ) : (
                  <button type="button" onClick={() => setSheet(m)} className="flex w-full cursor-pointer items-center gap-3 py-3 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                    <span className="flex min-w-0 flex-1 flex-col gap-1.5">{body}</span>
                    <Icon name="edit-2" size={18} className="shrink-0 text-muted-foreground" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        {role.locked ? <Note tone="warning">{t("roles.lockedNote")}</Note> : <Note>{t("roles.note")}</Note>}
      </section>

      {sheet && <RowSheet row={sheet} role={role} access={access} onChange={update} onOpenChange={(o) => !o && setSheet(null)} />}
      {newRole && (
        <NewRoleDialog
          from={role.id}
          onOpenChange={setNewRole}
          onCreated={(id) => {
            pick(id)
          }}
        />
      )}
    </SettingsFrame>
  )
}

/* ------------------------------------------------------------------ desktop matrix */

function Matrix({ access, locked, onChange }: { access: Access; locked: boolean; onChange: (a: Access) => void }) {
  const { t } = useUserText()
  const [open, setOpen] = React.useState(false)
  const anySettings = SETTINGS_PERMS.some((s) => access.settings[s])
  const anyEdit = SETTINGS_PERMS.some((s) => access.settings[s] === "edit")
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full table-fixed text-sm">
        <thead className="bg-muted/60 text-xs text-muted-foreground">
          <tr>
            <th className="w-[22%] px-4 py-3 text-start font-normal">{t("roles.module")}</th>
            {PERM_ACTIONS.map((a) => (
              <th key={a} className="px-2 py-3 text-center font-normal">
                {t(`actionsMatrix.${a}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROW_MODULES.map((m) => (
            <tr key={m} className="border-t">
              <td className="px-4 py-2.5 text-foreground">{t(`modules.${m}`)}</td>
              {PERM_ACTIONS.map((a) => (
                <td key={a} className="px-2 py-1.5 text-center">
                  <Cell
                    scope={access.modules[m]?.[a]}
                    disabled={locked}
                    label={`${t(`modules.${m}`)} · ${t(`actionsMatrix.${a}`)}`}
                    onClick={() => onChange(setScope(access, m, a, nextScope(access.modules[m]?.[a])))}
                  />
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t">
            <td className="px-4 py-2.5">
              <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex cursor-pointer items-center gap-1.5 text-foreground outline-none focus-visible:underline">
                {t("modules.settings")}
                <Icon name={open ? "arrow-up-1" : "arrow-down"} size={16} className="text-muted-foreground" />
              </button>
            </td>
            <td className="px-2 py-1.5 text-center">
              <Cell scope={anySettings ? "all" : undefined} disabled label={t("modules.settings")} onClick={() => setOpen(true)} />
            </td>
            <td className="px-2 py-1.5 text-center">
              <Cell scope={undefined} disabled label="" onClick={() => {}} />
            </td>
            <td className="px-2 py-1.5 text-center">
              <Cell scope={anyEdit ? "all" : undefined} disabled label={t("modules.settings")} onClick={() => setOpen(true)} />
            </td>
            <td className="px-2 py-1.5 text-center">
              <Cell scope={undefined} disabled label="" onClick={() => {}} />
            </td>
            <td className="px-2 py-1.5 text-center">
              <Cell scope={undefined} disabled label="" onClick={() => {}} />
            </td>
          </tr>
          {open &&
            SETTINGS_PERMS.map((s) => {
              const g = access.settings[s]
              return (
                <tr key={s} className="border-t bg-muted/30">
                  <td className="px-4 py-2 ps-8 text-xs text-muted-foreground">{t(`sections.${s}`)}</td>
                  <td className="px-2 py-1 text-center">
                    <Cell scope={g ? "all" : undefined} disabled={locked} label={`${t(`sections.${s}`)} · ${t("actionsMatrix.view")}`} onClick={() => onChange(setSection(access, s, g ? undefined : "view"))} />
                  </td>
                  <td />
                  <td className="px-2 py-1 text-center">
                    {s === "audit" ? (
                      <span className="text-xs text-muted-foreground">{t("roles.readOnly")}</span>
                    ) : (
                      <Cell scope={g === "edit" ? "all" : undefined} disabled={locked} label={`${t(`sections.${s}`)} · ${t("actionsMatrix.edit")}`} onClick={() => onChange(setSection(access, s, g === "edit" ? "view" : "edit"))} />
                    )}
                  </td>
                  <td />
                  <td />
                </tr>
              )
            })}
        </tbody>
      </table>
    </div>
  )
}

/** Matrix cell: green tick (all branches), amber "Own branch", dash (none). Click to change. */
function Cell({ scope, disabled, label, onClick }: { scope?: Scope; disabled?: boolean; label: string; onClick: () => void }) {
  const { t } = useUserText()
  const state = scope === "all" ? t("roles.allBranches") : scope === "own" ? t("roles.ownBranch") : t("roles.none")
  const inner =
    scope === "all" ? (
      <Icon name="tick-circle" size={20} className="text-success" />
    ) : scope === "own" ? (
      <span className="rounded-full bg-warning-soft px-1.5 py-0.5 text-[11px] leading-4 whitespace-nowrap text-warning-soft-foreground">{t("roles.ownBranch")}</span>
    ) : (
      <Icon name="minus" size={18} className="text-muted-foreground" />
    )
  if (disabled) return <span className="inline-flex h-8 items-center justify-center" aria-label={label ? `${label}: ${state}` : undefined}>{inner}</span>
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${state}`}
      className="inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-md px-1 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {inner}
    </button>
  )
}

/* ------------------------------------------------------------------ compact: edit one row */

/** Below xl: a module row opens this sheet — each action Off / All branches / Own branch (Settings: Off / View / Edit). */
function RowSheet({ row, role, access, onChange, onOpenChange }: { row: Row; role: RoleDef; access: Access; onChange: (a: Access) => void; onOpenChange: (o: boolean) => void }) {
  const { t, b } = useUserText()
  const [draft, setDraft] = React.useState(access)
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={`${t(`modules.${row}`)} · ${b(role.name)}`}
      description={t("roles.sheetSub")}
      icon="security-user"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("actions.cancel")}
        </Button>
      }
      primary={
        <Button
          onClick={() => {
            onChange(draft)
            onOpenChange(false)
          }}
        >
          {t("roles.done")}
        </Button>
      }
    >
      <div className="flex flex-col divide-y">
        {row === "settings"
          ? SETTINGS_PERMS.map((s) => (
              <div key={s} className="flex flex-col gap-2 py-3">
                <span className="text-sm text-foreground">{t(`sections.${s}`)}</span>
                <Segmented<"off" | SettingsGrant>
                  size="sm"
                  value={draft.settings[s] ?? "off"}
                  onValueChange={(v) => setDraft(setSection(draft, s, v === "off" ? undefined : v))}
                  options={[
                    { value: "off", label: t("roles.off") },
                    { value: "view", label: t("actionsMatrix.view") },
                    ...(s === "audit" ? [] : [{ value: "edit" as const, label: t("actionsMatrix.edit") }]),
                  ]}
                  aria-label={t(`sections.${s}`)}
                />
              </div>
            ))
          : PERM_ACTIONS.map((a) => (
              <div key={a} className="flex flex-col gap-2 py-3">
                <span className="text-sm text-foreground">{t(`actionsMatrix.${a}`)}</span>
                <Segmented<"off" | Scope>
                  size="sm"
                  value={draft.modules[row]?.[a] ?? "off"}
                  onValueChange={(v) => setDraft(setScope(draft, row, a, v === "off" ? undefined : v))}
                  options={[
                    { value: "off", label: t("roles.off") },
                    { value: "all", label: t("roles.allBranches") },
                    { value: "own", label: t("roles.ownBranch") },
                  ]}
                  aria-label={t(`actionsMatrix.${a}`)}
                />
              </div>
            ))}
      </div>
    </ResponsiveDialog>
  )
}

/* ------------------------------------------------------------------ new role */

/** Overlay · New role: name, copy from, what it's for. Start from a copy, then change what's different. → `role-created`. */
function NewRoleDialog({ from, onOpenChange, onCreated }: { from: RoleKey; onOpenChange: (o: boolean) => void; onCreated: (id: RoleKey) => void }) {
  const { t, b } = useUserText()
  const roles = useRoles()
  const saved = useRoleAccess()
  const [name, setName] = React.useState("")
  const [copy, setCopy] = React.useState<RoleKey>(roles.find((r) => r.id === from && !r.locked) ? from : "reception")
  const [about, setAbout] = React.useState("")
  const [tried, setTried] = React.useState(false)
  const clean = name.trim()
  const error = !clean ? t("roles.errName") : roles.some((r) => r.name.en.toLowerCase() === clean.toLowerCase() || r.name.ar === clean) ? t("roles.errNameUsed") : undefined

  const create = () => {
    setTried(true)
    if (error) return
    const src = roles.find((r) => r.id === copy)!
    const id = `role-${roles.length + 1}`
    addRole({ id, name: { en: clean, ar: clean }, about: about.trim() ? { en: about.trim(), ar: about.trim() } : undefined, copiedFrom: copy }, clone(saved[copy]))
    writeAudit({ what: { en: `Created the role ${clean} · copied from ${src.name.en}`, ar: `أنشأ دور ${clean} · منسوخ من ${src.name.ar}` }, where: "roles" })
    toast.success(t("toasts.roleCreated"), { description: t("toasts.roleCreatedText", { name: clean, from: b(src.name) }) })
    onOpenChange(false)
    onCreated(id)
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("roles.newTitle")}
      description={t("roles.newSub")}
      icon="security-user"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("actions.cancel")}
        </Button>
      }
      primary={<Button onClick={create}>{t("roles.create")}</Button>}
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        <Field label={t("roles.name")} required error={tried ? error : undefined}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("roles.namePh")} autoComplete="off" />
        </Field>
        <Field label={t("roles.copyFrom")}>
          {(c) => (
            <Select value={copy} onValueChange={setCopy}>
              <SelectTrigger {...c} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {b(r.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>
      <Field label={t("roles.about")}>
        <Textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={3} placeholder={t("roles.aboutPh")} />
      </Field>
      <Note>{t("roles.newNote")}</Note>
    </ResponsiveDialog>
  )
}
