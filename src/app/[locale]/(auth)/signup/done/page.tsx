import { getTranslations } from "next-intl/server"

import { DoneScreen } from "@/components/auth/done-screen"

export async function generateMetadata() {
  return { title: (await getTranslations("auth"))("done.signupTitle") }
}

export default function Page() {
  return <DoneScreen kind="signup" />
}
