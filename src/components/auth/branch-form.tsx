"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { useRouter } from "@/i18n/navigation"
import { ApiError, chooseBranch } from "@/lib/api"
import { RadioOption } from "@/components/ds/radio-option"
import { RadioGroup } from "@/components/ui/radio-group"
import { useAuthFlow } from "./flow"
import { AuthAlert, AuthTitle, BackLink, SubmitButton } from "./parts"
import { useFinishSignIn } from "./use-finish"

/**
 * Auth · Pick a branch (D48): a user with several branches picks one for this session, right after the password (and the
 * code). Built from the sign-in page parts: back link, title, radio options, submit. Opened without the branch step in
 * memory (a reload, a typed address) it goes back to sign in.
 */
export function BranchForm({ next }: { next?: string }) {
  const t = useTranslations("auth")
  const locale = useLocale()
  const router = useRouter()
  const finish = useFinishSignIn(next)
  const { state, set } = useAuthFlow()
  const [picked, setPicked] = React.useState<string>("")
  const [loading, setLoading] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const token = state.branchToken

  React.useEffect(() => {
    if (!token) router.replace("/login")
  }, [token, router])

  if (!token) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!picked || !token) return
    setLoading(true)
    setFailed(false)
    try {
      await chooseBranch(token, Number(picked))
      finish()
    } catch (err) {
      setLoading(false)
      if (err instanceof ApiError && err.code === "unauthenticated") {
        // The step ran out of time or was used up: start again.
        set({ branchToken: null, branches: [], expired: true })
        return
      }
      setFailed(true)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="contents">
      <BackLink href="/login">{t("common.backToSignIn")}</BackLink>
      <AuthTitle icon="buildings" title={t("branch.title")} subtitle={t("branch.subtitle")} />
      {failed && (
        <AuthAlert tone="destructive" icon="danger">
          {t("login.network")}
        </AuthAlert>
      )}
      {/* The hidden form inputs Radix adds are not needed (the pick lives in state) and overflow the page in RTL. */}
      <RadioGroup value={picked} onValueChange={setPicked} aria-label={t("branch.title")} className="gap-2 [&_input]:hidden">
        {state.branches.map((b) => (
          <RadioOption key={b.id} value={String(b.id)} title={locale === "ar" ? b.name_ar : b.name_en} description={<bdi dir="ltr">{b.code}</bdi>} />
        ))}
      </RadioGroup>
      <SubmitButton loading={loading}>{t("branch.submit")}</SubmitButton>
    </form>
  )
}
