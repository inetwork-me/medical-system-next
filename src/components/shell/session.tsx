"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { getCurrentUser, onSessionEnded, setForbiddenHandler, type CurrentUser } from "@/lib/api"
import type { AuthMode } from "@/lib/auth-mode"
import { SESSION_USER } from "@/lib/mock/shell"
import { clearSignedIn, writeSignedIn } from "@/lib/permissions"
import { toSessionUser, type SessionUser } from "@/lib/session-user"
import { accessFor } from "@/modules/settings/access"
import { EmptyState, LoadingState } from "@/components/ds/states"
import { Button } from "@/components/ui/button"

const Ctx = React.createContext<SessionUser>(SESSION_USER)

/** The signed-in user the shell shows: the API's answer in `api` mode, the design's sample user in `mock` mode. */
export const useSessionUser = () => React.useContext(Ctx)

/**
 * Loads GET /api/user once per page load in `api` mode and feeds name, role and branch to the shell. Permissions stay on the
 * front-end role matrix by role name (D52): the roles from the API pick the matrix the app already enforces, and the API
 * remains the control. A 403 anywhere reloads this once (the client calls the handler). A 401 sends the user to sign in.
 * In `mock` mode it does nothing and the sample user stays.
 */
export function SessionProvider({ mode, children }: { mode: AuthMode; children: React.ReactNode }) {
  if (mode === "mock") return <Ctx.Provider value={SESSION_USER}>{children}</Ctx.Provider>
  return <ApiSession>{children}</ApiSession>
}

/** GET /api/user, and take the permission snapshot the app enforces (the role matrix by role name). */
async function fetchSession(): Promise<SessionUser> {
  const cur: CurrentUser = await getCurrentUser()
  writeSignedIn({ user: String(cur.user.id), roles: cur.user.roles, access: accessFor(cur.user.roles), at: new Date().toISOString() })
  return toSessionUser(cur)
}

function ApiSession({ children }: { children: React.ReactNode }) {
  const t = useTranslations("shell.session")
  const tc = useTranslations("common.actions")
  const [user, setUser] = React.useState<SessionUser | null>(null)
  const [failed, setFailed] = React.useState(false)

  // A 401 has already sent the user to sign in; any other failure shows the retry state.
  const load = React.useCallback(() => {
    fetchSession().then(setUser, () => setFailed(true))
  }, [])

  React.useEffect(() => {
    load()
    // A 403 anywhere reloads who the user is once (permissions may have changed); a failed reload keeps what is shown.
    setForbiddenHandler(() => fetchSession().then(setUser))
    const off = onSessionEnded(() => {
      clearSignedIn()
      setUser(null)
    })
    return () => {
      setForbiddenHandler(null)
      off()
    }
  }, [load])

  if (!user) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        {failed ? (
          <EmptyState
            icon="danger"
            title={t("error")}
            actions={
              <Button
                onClick={() => {
                  setFailed(false)
                  load()
                }}
              >
                {tc("tryAgain")}
              </Button>
            }
          />
        ) : (
          <LoadingState title={t("loading")} className="w-full max-w-sm" />
        )}
      </div>
    )
  }
  return <Ctx.Provider value={user}>{children}</Ctx.Provider>
}
