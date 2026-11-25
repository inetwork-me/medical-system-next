import { setLocaleFrom } from "@/i18n/set-locale"

/**
 * Settings (design v9.0) isn't a branch module: it's always there (sidebar footer, More sheet). Access is per section, from
 * the signed-in user's roles (modules/settings/access.ts), checked inside each page's frame.
 */
export default async function SettingsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return children
}
