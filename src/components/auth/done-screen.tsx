"use client"

import { useTranslations } from "next-intl"

import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { AuthAlert, AuthTitle } from "./parts"

/** Auth · Sign up · Account ready / Reset · Password updated: success tile, copy, (info note), Go to sign in. */
export function DoneScreen({ kind }: { kind: "signup" | "reset" }) {
  const t = useTranslations("auth")
  return (
    <>
      <AuthTitle
        icon="tick-circle"
        tone="success"
        title={t(kind === "signup" ? "done.signupTitle" : "done.resetTitle")}
        subtitle={t(kind === "signup" ? "done.signupSubtitle" : "done.resetSubtitle")}
      />
      {kind === "signup" && (
        <AuthAlert tone="info" icon="info-circle">
          {t("done.signupNote")}
        </AuthAlert>
      )}
      <Button size="lg" className="w-full" asChild>
        <Link href="/login">{t("common.goToSignIn")}</Link>
      </Button>
    </>
  )
}
