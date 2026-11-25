"use client"

import * as React from "react"

import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { DatePicker } from "@/components/ds/pickers"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Segmented } from "@/components/ds/segmented"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BRANCHES, ME, MSG_NOW, MSG_TODAY, ORG_DOMAIN, POLICIES, ROLE_GROUPS, STAFF } from "./data"
import { useAccessText } from "./access-text"
import { BrandMark, ChoiceCard, ChoiceGroup, IconTile, KvRows, Note } from "./parts"
import { msgCan } from "./roles"
import { membersOf } from "./rules"
import { mailProvider, type Discovery } from "./services/mail"
import {
  addPersonalMailbox,
  createSharedMailbox,
  removeAccess,
  saveAccess,
  saveConnection,
  setPolicies,
  useMailboxes,
  useMemberships,
  useMsgRole,
  usePolicies,
} from "./store"
import { ACCESS_ORDER, type AccessLevel, type Mailbox, type Membership, type Provider, type StaffRole } from "./types"

/* ------------------------------------------------------------------ helpers */

function CheckRow({ label, checked, onChange, disabled }: { label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const id = React.useId()
  return (
    <div className="flex items-center gap-2 py-1">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} disabled={disabled} />
      <label htmlFor={id} className="cursor-pointer text-sm text-foreground">
        {label}
      </label>
    </div>
  )
}

const CheckBox = ({ children }: { children: React.ReactNode }) => <div className="flex flex-col rounded-[10px] border px-3 py-1.5">{children}</div>

const PROVIDER_NAME: Record<Provider, string> = { m365: "Microsoft 365", google: "Google Workspace", imap: "IMAP" }
const ORG_CONNECTION: Partial<Record<Provider, string>> = { m365: "c-m365", google: "c-google" }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/* ------------------------------------------------------------------ Connect a mailbox (2 steps) */

/**
 * Overlay · Connect a mailbox → Allow access (swapOverlay). Step 1: provider radio cards (Microsoft 365 · Outlook, Google
 * Workspace · Gmail, Other mail (IMAP)), "Connect it for" the whole organisation / just me, the sign-in note. Step 2: the
 * account and scope, permissions (read and sort, send, contacts on; calendar off), the sync note; Back returns to step 1;
 * "Sign in and allow" → `mailbox-connected`. IMAP (not drawn): step 2 asks for the email, server and an app password.
 */
export function ConnectDialog({
  initial = "google",
  initialScope,
  onOpenChange,
}: {
  initial?: Provider
  /** "Connect Outlook or Gmail" in the Inbox opens it for "Just me". */
  initialScope?: "org" | "personal"
  onOpenChange: (open: boolean) => void
}) {
  const { t, l } = useAccessText()
  const role = useMsgRole()
  const policies = usePolicies()
  const mailboxes = useMailboxes()
  const [step, setStep] = React.useState<1 | 2>(1)
  const [provider, setProvider] = React.useState<Provider>(initial)
  const canOrg = msgCan(role, "admin")
  const myRole: StaffRole = STAFF[ME].role
  const canMe = msgCan(role, "personalMailbox") && policies.allowPersonal && (role === "lead" || policies.personalRoles.includes(myRole))
  const [scope, setScope] = React.useState<"org" | "personal">(initialScope ?? (canOrg ? "org" : "personal"))
  const [found, setFound] = React.useState<Discovery | null>(null)
  const [perm, setPerm] = React.useState({ read: true, send: true, contacts: true, calendar: policies.personalSync === "mailCalendar" })
  const [imap, setImap] = React.useState({ email: STAFF[ME].email ?? "", server: "", appPassword: "" })
  const [tried, setTried] = React.useState(false)
  const [authFail, setAuthFail] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const pname = t(`connect.providerName.${provider}`)
  const isImap = provider === "imap"
  const effScope = isImap ? "personal" : scope
  const scopeError = effScope === "org" && !canOrg ? t("connect.errors.orgOff") : effScope === "personal" && !canMe ? t("connect.errors.personalOff") : undefined

  const imapErrors = {
    email: !imap.email.trim() ? t("connect.errors.email") : !EMAIL.test(imap.email.trim()) ? t("connect.errors.emailFormat") : undefined,
    server: !imap.server.trim() ? t("connect.errors.server") : undefined,
    appPassword: !imap.appPassword ? t("connect.errors.appPassword") : authFail ? t("connect.errors.auth") : undefined,
  }
  const imapInvalid = Object.values(imapErrors).some(Boolean)

  const next = async () => {
    if (scopeError) return
    setBusy(true)
    const d = await mailProvider(provider).discover(effScope, { email: STAFF[ME].email ?? "" })
    setFound(d)
    if (isImap && !imap.server) setImap((x) => ({ ...x, server: `imap.${(x.email.split("@")[1] ?? "").trim()}` }))
    setBusy(false)
    setStep(2)
  }

  const allow = async () => {
    setTried(true)
    if (isImap && imapInvalid) return
    setBusy(true)
    try {
      const c = await mailProvider(provider).connect(effScope, { email: STAFF[ME].email ?? "" }, isImap ? { ...imap, email: imap.email.trim() } : undefined)
      if (effScope === "org") {
        const id = ORG_CONNECTION[provider]!
        saveConnection(
          id,
          { status: "connected", account: c.account, domain: c.domain, mailboxes: c.mailboxes, lastSync: MSG_NOW, tokenRef: c.tokenRef, sync: c.sync },
          { en: `Connected ${PROVIDER_NAME[provider]} for the whole organisation`, ar: `ربط ${PROVIDER_NAME[provider]} للمنشأة كاملة` }
        )
        toast.success(t("toasts.mailboxConnected", { provider: PROVIDER_NAME[provider] }), { description: t("toasts.mailboxConnectedText", { n: c.mailboxes }) })
      } else {
        const n = mailboxes.filter((m) => m.kind === "linked").length + 1
        const short = provider === "google" ? "Gmail" : provider === "m365" ? "Outlook" : "IMAP"
        const box: Mailbox = {
          id: `linked-${provider}-${n}`,
          address: c.account,
          short,
          name: { en: `${short} · ${c.account}`, ar: `${short} · ${c.account}` },
          kind: "linked",
          provider,
          connection: `c-personal-${provider}-${n}`,
          owner: ME,
          keepYears: policies.keepYears,
          lastSync: MSG_NOW,
        }
        addPersonalMailbox(
          box,
          { id: box.connection, provider, scope: "personal", status: "connected", account: c.account, domain: c.domain, consent: isImap ? "appPassword" : "user", sync: c.sync, mailboxes: 1, lastSync: MSG_NOW, tokenRef: c.tokenRef },
          { en: `Linked a personal ${short} mailbox`, ar: `ربط صندوق ${short} شخصي` }
        )
        toast.success(t("toasts.mailboxConnected", { provider: short }), { description: t("toasts.personalConnectedText", { account: c.account }) })
      }
      onOpenChange(false)
    } catch {
      setBusy(false)
      if (isImap) {
        setAuthFail(true)
        return
      }
      toast.error(t("toasts.failed", { provider: PROVIDER_NAME[provider] }), { description: t("toasts.failedText"), retry: allow })
    }
  }

  if (step === 1)
    return (
      <ResponsiveDialog
        open
        onOpenChange={onOpenChange}
        title={t("connect.title")}
        description={t("connect.step1")}
        icon="link-2"
        width="sm:max-w-140"
        secondary={
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("actions.cancel")}
          </Button>
        }
        primary={
          <Button onClick={next} disabled={busy || !!scopeError}>
            {busy ? t("connect.loading", { provider: pname }) : t("actions.continue")}
          </Button>
        }
      >
        <ChoiceGroup value={provider} onValueChange={(v) => setProvider(v as Provider)} aria-label={t("connect.title")}>
          <ChoiceCard value="m365" lead={<BrandMark kind="m365" size={32} />} title={l(t("accounts.m365"))} sub={t("connect.m365Sub")} />
          <ChoiceCard value="google" lead={<BrandMark kind="google" size={32} />} title={l(t("accounts.google"))} sub={t("connect.googleSub")} />
          <ChoiceCard value="imap" lead={<BrandMark kind="people" size={32} />} title={t("accounts.imap")} sub={t("connect.imapSub")} />
        </ChoiceGroup>
        {!isImap && (
          <Field label={t("connect.for")} required error={scopeError}>
            {(c) => (
              <Segmented
                {...c}
                value={scope}
                onValueChange={setScope}
                options={[
                  { value: "org", label: t("connect.org") },
                  { value: "personal", label: t("connect.me") },
                ]}
              />
            )}
          </Field>
        )}
        {isImap && scopeError && <Note tone="destructive">{scopeError}</Note>}
        <Note icon="shield-tick">{isImap ? t("connect.imapNote") : t("connect.signInNote", { provider: pname })}</Note>
      </ResponsiveDialog>
    )

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("connect.allow")}
      description={t("connect.step2", { provider: PROVIDER_NAME[provider] })}
      icon="shield-tick"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => setStep(1)} disabled={busy}>
          {t("actions.back")}
        </Button>
      }
      primary={
        <Button onClick={allow} disabled={busy}>
          {busy ? t("connect.signingIn") : t("connect.signIn")}
        </Button>
      }
    >
      {isImap ? (
        <>
          {tried && imapInvalid && <Note tone="destructive">{authFail ? t("connect.errors.authStrip") : t("connect.errors.strip")}</Note>}
          <Field label={t("connect.email")} required error={tried ? imapErrors.email : undefined}>
            <Input dir="ltr" type="email" value={imap.email} onChange={(e) => setImap({ ...imap, email: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("connect.server")} required error={tried ? imapErrors.server : undefined}>
              <Input dir="ltr" value={imap.server} onChange={(e) => setImap({ ...imap, server: e.target.value })} />
            </Field>
            <Field label={t("connect.appPassword")} required error={tried ? imapErrors.appPassword : undefined}>
              <Input
                dir="ltr"
                type="password"
                autoComplete="off"
                value={imap.appPassword}
                onChange={(e) => {
                  setAuthFail(false)
                  setImap({ ...imap, appPassword: e.target.value })
                }}
              />
            </Field>
          </div>
          <Note icon="lock">{t("connect.imapNote")}</Note>
        </>
      ) : (
        <>
          <KvRows
            boxed
            rows={[
              [t("connect.account"), l(found?.account ?? "")],
              [t("connect.forLabel"), effScope === "org" ? t("connect.forOrg", { n: found?.mailboxes ?? 0 }) : t("connect.forMe")],
            ]}
          />
          <CheckBox>
            <CheckRow label={t("connect.perm.read")} checked={perm.read} onChange={(v) => setPerm({ ...perm, read: v })} disabled />
            <CheckRow label={t("connect.perm.send")} checked={perm.send} onChange={(v) => setPerm({ ...perm, send: v })} />
            <CheckRow label={t("connect.perm.contacts")} checked={perm.contacts} onChange={(v) => setPerm({ ...perm, contacts: v })} />
            <CheckRow label={t("connect.perm.calendar")} checked={perm.calendar} onChange={(v) => setPerm({ ...perm, calendar: v })} />
          </CheckBox>
        </>
      )}
      <Note>{t("connect.syncNote", { n: policies.keepYears })}</Note>
    </ResponsiveDialog>
  )
}

/* ------------------------------------------------------------------ Personal mailboxes (Rules) */

const PERSONAL_ROLES: StaffRole[] = ["doctor", "admin", "nurse", "reception"]

/**
 * Overlay · Personal mailboxes (Rules on the Personal mailboxes card): roles that may link (doctors, management on; nurses,
 * reception off), what syncs (mail only / mail and calendar), "Never forward mail linked to a patient to a personal
 * mailbox", the privacy note. → `personal-saved`.
 */
export function PersonalDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { t, roleList } = useAccessText()
  const p = usePolicies()
  const [roles, setRoles] = React.useState<StaffRole[]>(p.allowPersonal ? p.personalRoles : [])
  const [sync, setSync] = React.useState(p.personalSync)
  const [never, setNever] = React.useState(p.neverForwardPatientMail)
  const toggle = (r: StaffRole, on: boolean) => setRoles((x) => (on ? [...x, r] : x.filter((y) => y !== r)))
  const save = () => {
    const list = PERSONAL_ROLES.filter((r) => roles.includes(r))
    const names = roleList(list)
    setPolicies(
      { personalRoles: list, allowPersonal: list.length > 0, personalSync: sync, neverForwardPatientMail: never },
      { en: list.length ? `Personal mailboxes: ${names} can link` : "Personal mailboxes turned off", ar: list.length ? `الصناديق الشخصية: ${names} يقدرون يربطون` : "توقفت الصناديق الشخصية" }
    )
    if (list.length) toast.success(t("toasts.personalSaved"), { description: t("toasts.personalSavedText", { roles: names }) })
    else toast.success(t("toasts.personalSaved"), { description: t("toasts.personalSavedNone") })
    onOpenChange(false)
  }
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("personal.title")}
      description={t("personal.sub")}
      icon="profile-2user"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("actions.cancel")}
        </Button>
      }
      primary={<Button onClick={save}>{t("actions.save")}</Button>}
    >
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium text-foreground">{t("personal.who")}</p>
        <CheckBox>
          {PERSONAL_ROLES.map((r) => (
            <CheckRow key={r} label={t(`roleNames.${r as "doctor"}`)} checked={roles.includes(r)} onChange={(v) => toggle(r, v)} />
          ))}
        </CheckBox>
      </div>
      <Field label={t("personal.syncs")}>
        {(c) => (
          <Segmented
            {...c}
            value={sync}
            onValueChange={setSync}
            options={[
              { value: "mail", label: t("personal.mailOnly") },
              { value: "mailCalendar", label: t("personal.mailCal") },
            ]}
          />
        )}
      </Field>
      <CheckRow label={t("personal.neverForward")} checked={never} onChange={setNever} />
      <Note icon="lock">{t("personal.privacy")}</Note>
    </ResponsiveDialog>
  )
}

/* ------------------------------------------------------------------ New shared mailbox */

type Who = "role" | "branch" | "named"

/**
 * Overlay · New shared mailbox (New / New shared mailbox): address (+ @alnoor.sa), display name, branch, signature; who
 * gets access by role / by branch / named people; role + access level; the note that it's created in Microsoft 365 too.
 * → `shared-created`. Named people (not drawn): you get Manage and add people on its access page.
 */
export function NewSharedDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { t, b, l } = useAccessText()
  const mailboxes = useMailboxes()
  const [address, setAddress] = React.useState("")
  const [display, setDisplay] = React.useState("")
  const [branch, setBranch] = React.useState<"olaya" | "jeddah">("olaya")
  const [signature, setSignature] = React.useState("branch")
  const [who, setWho] = React.useState<Who>("role")
  const [group, setGroup] = React.useState("")
  const [level, setLevel] = React.useState<AccessLevel>("reply")
  const [tried, setTried] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const local = address.trim().toLowerCase().replace(/@.*$/, "")
  const full = `${local}@${ORG_DOMAIN}`
  const errors = {
    address: !local ? t("newShared.errors.address") : !/^[a-z0-9][a-z0-9._-]*$/.test(local) ? t("newShared.errors.addressFormat") : mailboxes.some((m) => m.address === full) ? t("newShared.errors.addressTaken", { address: full }) : undefined,
    display: !display.trim() ? t("newShared.errors.displayName") : undefined,
    group: who === "role" && !group ? t("newShared.errors.role") : undefined,
  }
  const invalid = Object.values(errors).some(Boolean)
  const g = ROLE_GROUPS.find((x) => x.id === group)
  const br = BRANCHES.find((x) => x.key === branch)!
  const people = Object.values(STAFF).filter((s) => s.branch === branch && (who === "role" ? !!g && g.match(s) : who === "branch" ? !["privacy", "it"].includes(s.role) : false))

  const create = async () => {
    setTried(true)
    if (invalid || busy) return
    setBusy(true)
    await mailProvider("m365").createShared(full, display.trim())
    const id = `shared-${local}`
    const ruleId = `rr-${local}`
    const box: Mailbox = {
      id,
      address: full,
      short: `${local}@`,
      name: { en: display.trim(), ar: display.trim() },
      purpose: { en: display.trim(), ar: display.trim() },
      kind: "shared",
      provider: "m365",
      connection: "c-m365",
      grant: who,
      branch: br.name,
      signature: signature === "branch" ? "sig-branch" : signature === "cardiology" ? "sig-cardiology" : undefined,
      keepYears: POLICIES.keepYears,
      lastSync: MSG_NOW,
    }
    const members: Membership[] =
      who === "named"
        ? [{ mailbox: id, staff: ME, level: "manage", via: { kind: "person", by: ME } }]
        : people.map((s) => ({ mailbox: id, staff: s.key, level, via: who === "role" ? { kind: "role" as const, rule: ruleId } : { kind: "branch" as const } }))
    const rule = who === "role" && g ? { id: ruleId, mailbox: id, who: g.who, level } : null
    createSharedMailbox(box, members, rule, {
      en: `Created ${full} · ${members.length} ${members.length === 1 ? "person" : "people"}`,
      ar: `انشأ الصندوق · ${members.length} · ${full}`,
    })
    toast.success(t("toasts.sharedCreated"), { description: t("toasts.sharedCreatedText", { address: full, n: members.length, how: t(`toasts.how.${who}`) }) })
    onOpenChange(false)
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("newShared.title")}
      description={t("newShared.sub")}
      icon="direct-inbox"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
          {t("actions.cancel")}
        </Button>
      }
      primary={
        <Button onClick={create} disabled={busy}>
          {busy ? t("newShared.creating") : t("actions.create")}
        </Button>
      }
    >
      {tried && invalid && <Note tone="destructive">{t("newShared.errors.strip")}</Note>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("newShared.address")} required helper={l(`@${ORG_DOMAIN}`)} error={tried ? errors.address : undefined}>
          <Input dir="ltr" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="claims.jeddah" />
        </Field>
        <Field label={t("newShared.displayName")} required error={tried ? errors.display : undefined}>
          <Input value={display} onChange={(e) => setDisplay(e.target.value)} />
        </Field>
        <Field label={t("newShared.branch")}>
          {(c) => (
            <Select value={branch} onValueChange={(v) => setBranch(v as "olaya" | "jeddah")}>
              <SelectTrigger {...c} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BRANCHES.map((x) => (
                  <SelectItem key={x.key} value={x.key}>
                    {b(x.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label={t("newShared.signature")}>
          {(c) => (
            <Select value={signature} onValueChange={setSignature}>
              <SelectTrigger {...c} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="branch">{t("newShared.branchSignature")}</SelectItem>
                <SelectItem value="cardiology">{b({ en: "Cardiology clinic team", ar: "فريق عيادة القلب" })}</SelectItem>
                <SelectItem value="none">{t("mailbox.noSignature")}</SelectItem>
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>
      <Field label={t("newShared.who")} required>
        {(c) => (
          <Segmented
            {...c}
            value={who}
            onValueChange={setWho}
            options={[
              { value: "role", label: t("newShared.byRole") },
              { value: "branch", label: t("newShared.byBranch") },
              { value: "named", label: t("newShared.named") },
            ]}
          />
        )}
      </Field>
      {who !== "named" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {who === "role" && (
            <Field label={t("newShared.role")} required error={tried ? errors.group : undefined}>
              {(c) => (
                <Select value={group} onValueChange={setGroup}>
                  <SelectTrigger {...c} className="w-full">
                    <SelectValue placeholder={t("newShared.role")} />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_GROUPS.map((x) => (
                      <SelectItem key={x.id} value={x.id}>
                        {b(x.who)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          )}
          <Field label={t("newShared.access")} className={who === "branch" ? "sm:col-span-2" : undefined}>
            {(c) => (
              <Select value={level} onValueChange={(v) => setLevel(v as AccessLevel)}>
                <SelectTrigger {...c} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCESS_ORDER.map((x) => (
                    <SelectItem key={x} value={x}>
                      {t(`access.${x}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        </div>
      )}
      <Note>
        {who === "role"
          ? t("newShared.note", { who: g ? b(g.who).toLowerCase() : t("newShared.staff"), branch: b(br.name) })
          : who === "branch"
            ? t("newShared.noteBranch", { branch: b(br.name) })
            : t("newShared.noteNamed")}
      </Note>
    </ResponsiveDialog>
  )
}

/* ------------------------------------------------------------------ Edit access */

const LEVEL_ICON = { read: "eye", reply: "message-text", sendAs: "send-2", manage: "security-user" } as const

/**
 * Overlay · Edit access (Edit on a person; Add people opens it with a person picker): person + mailbox; radio cards Read
 * only / Reply / Send as / Manage with their one-line meaning; Until (ends on its own); "Tell {name} by email". → `access-saved`.
 */
export function EditAccessDialog({ mailbox, staff, onOpenChange }: { mailbox: Mailbox; staff?: string; onOpenChange: (open: boolean) => void }) {
  const { t, b, l, until, level: lvl, firstName } = useAccessText()
  const memberships = useMemberships()
  const current = staff ? memberships.find((m) => m.mailbox === mailbox.id && m.staff === staff) : undefined
  const members = new Set(membersOf(mailbox.id, memberships).map((m) => m.staff))
  const candidates = Object.values(STAFF).filter((s) => !members.has(s.key) && s.key !== "it")
  const [person, setPerson] = React.useState(staff ?? "")
  const [level, setLevel] = React.useState<AccessLevel>(current?.level ?? "read")
  const [date, setDate] = React.useState<Date | undefined>(current?.until ? new Date(`${current.until}T12:00`) : undefined)
  const [tell, setTell] = React.useState(true)
  const [tried, setTried] = React.useState(false)
  const iso = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` : undefined
  const errors = {
    person: !person ? t("editAccess.errors.person") : undefined,
    until: iso && iso <= MSG_TODAY ? t("editAccess.errors.until") : undefined,
  }
  const invalid = Object.values(errors).some(Boolean)
  const p = person ? STAFF[person] : undefined
  const shortName = mailbox.kind === "shared" ? b({ en: mailbox.short, ar: mailbox.name.ar }) : l(mailbox.short)

  // A mailbox always keeps one person who can manage it.
  const lastManager = current?.level === "manage" && membersOf(mailbox.id, memberships).filter((m) => m.level === "manage").length === 1
  const remove = () => {
    if (!current || !p || lastManager) return
    const en = p.name.en.replace(/^(Dr\.|Nurse)\s+/, "").split(" ")[0]
    const ar = p.name.ar.replace(/^(د\.|الممرضة)\s+/, "").split(" ")[0]
    removeAccess(mailbox.id, p.key, { en: `You removed ${en}'s access`, ar: `شلت صلاحية ${ar}` })
    toast.success(t("toasts.removed"), { description: t("toasts.removedText", { name: firstName(p.key) }) })
    onOpenChange(false)
  }

  const save = () => {
    setTried(true)
    if (invalid || !p) return
    const changed = !current || current.level !== level || current.until !== iso
    const row: Membership = {
      mailbox: mailbox.id,
      staff: p.key,
      level,
      via: current && !changed ? current.via : current?.via.kind === "person" ? current.via : { kind: "person", by: ME },
      ...(iso ? { until: iso } : {}),
    }
    const name = firstName(p.key)
    const en = { name: p.name.en.replace(/^(Dr\.|Nurse)\s+/, "").split(" ")[0], level: { read: "read only", reply: "reply", sendAs: "send as", manage: "manage" }[level] }
    const ar = { name: p.name.ar.replace(/^(د\.|الممرضة)\s+/, "").split(" ")[0], level: { read: "قراءة بس", reply: "رد", sendAs: "إرسال باسمه", manage: "إدارة" }[level] }
    const enDate = iso ? `${Number(iso.slice(8, 10))} ${new Date(`${iso}T12:00`).toLocaleString("en-GB", { month: "short" })}` : ""
    const arDate = iso ? `${Number(iso.slice(8, 10))} ${new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { month: "long" }).format(new Date(`${iso}T12:00`))}` : ""
    saveAccess(row, iso ? { en: `You gave ${en.name} ${en.level} until ${enDate}`, ar: `أعطيت ${ar.name} ${ar.level} لين ${arDate}` } : { en: `You gave ${en.name} ${en.level}`, ar: `أعطيت ${ar.name} ${ar.level}` })
    toast.success(t("toasts.accessSaved"), {
      description: iso ? t("toasts.accessSavedUntil", { name, level: lvl(level), date: until(iso) }) : t("toasts.accessSavedText", { name, level: lvl(level) }),
    })
    onOpenChange(false)
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={staff ? t("editAccess.title") : t("editAccess.addTitle")}
      description={l(mailbox.address)}
      icon="security-user"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("actions.cancel")}
        </Button>
      }
      primary={<Button onClick={save}>{t("actions.save")}</Button>}
    >
      {tried && invalid && <Note tone="destructive">{t("editAccess.errors.strip")}</Note>}
      {staff && p ? (
        <KvRows
          boxed
          rows={[
            [t("editAccess.person"), `${b(p.name).replace(/^(Nurse|الممرضة)\s+/, "")} · ${b(p.title).toLowerCase()}`],
            [t("editAccess.mailbox"), l(mailbox.address)],
          ]}
        />
      ) : (
        <>
          <Field label={t("editAccess.person")} required error={tried ? errors.person : undefined}>
            {(c) => (
              <Select value={person} onValueChange={setPerson}>
                <SelectTrigger {...c} className="w-full">
                  <SelectValue placeholder={t("editAccess.pickPerson")} />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {b(s.name)} · {b(s.title)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <KvRows boxed rows={[[t("editAccess.mailbox"), l(mailbox.address)]]} />
        </>
      )}
      <ChoiceGroup value={level} onValueChange={(v) => setLevel(v as AccessLevel)} aria-label={t("mailbox.colAccess")}>
        {ACCESS_ORDER.map((x) => (
          <ChoiceCard
            key={x}
            value={x}
            lead={<IconTile icon={LEVEL_ICON[x]} className="bg-muted group-data-[state=checked]/choice:bg-card" />}
            title={t(`access.${x}`)}
            sub={x === "reply" ? t("accessMeaning.reply", { mailbox: shortName }) : t(`accessMeaning.${x}`)}
          />
        ))}
      </ChoiceGroup>
      <Field label={t("editAccess.until")} helper={t("editAccess.untilHint")} error={tried ? errors.until : undefined}>
        {(c) => <DatePicker {...c} value={date} onChange={setDate} placeholder={t("editAccess.untilPlaceholder")} />}
      </Field>
      <CheckRow label={p ? t("editAccess.tell", { name: firstName(p.key) }) : t("editAccess.tellAnyone")} checked={tell} onChange={setTell} />
      {current && p && (
        <div className="flex flex-col gap-1.5 border-t pt-3">
          <Button variant="ghost" className="w-fit text-destructive hover:text-destructive" onClick={remove} disabled={lastManager}>
            <Icon name="trash" size={18} />
            {t("editAccess.remove")}
          </Button>
          {lastManager && <p className="text-xs text-muted-foreground">{t("editAccess.lastManager")}</p>}
        </div>
      )}
    </ResponsiveDialog>
  )
}
