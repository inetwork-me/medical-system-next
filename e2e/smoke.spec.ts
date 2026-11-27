import { expect, test, type ConsoleMessage } from "@playwright/test"

import ar from "../messages/ar/auth.json"
import en from "../messages/en/auth.json"

const locales = [
  { locale: "en", dir: "ltr", login: en.login },
  { locale: "ar", dir: "rtl", login: ar.login },
] as const

for (const { locale, dir, login } of locales) {
  test.describe(`sign-in page (${locale})`, () => {
    test("loads with the right language and direction, and no console errors", async ({ page }) => {
      const errors: string[] = []
      page.on("console", (m: ConsoleMessage) => {
        if (m.type() === "error") errors.push(m.text())
      })
      page.on("pageerror", (e) => errors.push(e.message))

      await page.goto(`/${locale}/login/`)

      const html = page.locator("html")
      await expect(html).toHaveAttribute("lang", locale)
      await expect(html).toHaveAttribute("dir", dir)

      await expect(page.getByRole("heading", { level: 1, name: login.title })).toBeVisible()
      await expect(page.getByRole("button", { name: login.submit, exact: true })).toBeVisible()

      expect(errors).toEqual([])
    })
  })
}
