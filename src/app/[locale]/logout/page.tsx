import { setLocaleFrom } from "@/i18n/set-locale"
import { Logout } from "@/components/auth/client-guards"

/** Log out (client-side: clears the mock session cookie, then sign in). Links to it use prefetch={false}. */
export default async function LogoutPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <Logout />
}
