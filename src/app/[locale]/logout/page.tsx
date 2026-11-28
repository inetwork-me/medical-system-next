import { setLocaleFrom } from "@/i18n/set-locale"
import { Logout } from "@/components/auth/client-guards"
import { authMode } from "@/lib/auth-mode"

/** Log out (client-side: the API clears the session, or the mock cookie; then sign in). Links to it use prefetch={false}. */
export default async function LogoutPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <Logout mode={authMode()} />
}
