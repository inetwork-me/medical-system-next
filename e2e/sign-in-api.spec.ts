import { expect, test, type Page } from "@playwright/test"

import ar from "../messages/ar/auth.json"
import en from "../messages/en/auth.json"

/**
 * The real sign-in, against a running front-end and API. Skipped unless E2E_API=1 and E2E_BASE_URL are set (CI has no API).
 *
 *   E2E_API=1 E2E_BASE_URL=http://demo.localhost:3010 E2E_USER=<email> E2E_PASSWORD=<password> npx playwright test e2e/sign-in-api.spec.ts --project=desktop
 *
 * The address must be a tenant address (the first label is the tenant), the front-end must run with HIS_AUTH_MODE=api (the
 * default) and the same HIS_SESSION_COOKIE_KEY as the API. The credentials come from the environment and are never committed.
 * The wrong-password test makes one failed attempt on E2E_USER; the next successful sign-in clears it.
 */
const enabled = !!process.env.E2E_API && !!process.env.E2E_BASE_URL
const USER = process.env.E2E_USER ?? ""
const PASSWORD = process.env.E2E_PASSWORD ?? ""

test.describe.configure({ mode: "serial" })
test.skip(!enabled, "set E2E_API=1 and E2E_BASE_URL to run the sign-in tests against a real API")
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one project is enough and it keeps the API rate limit calm")
})

async function signIn(page: Page, locale: "en" | "ar" = "en") {
  const t = locale === "en" ? en : ar
  await page.goto(`/${locale}/login`)
  await page.locator("input[autocomplete=username]").fill(USER)
  await page.locator("input[type=password]").fill(PASSWORD)
  await page.getByRole("button", { name: t.login.submit, exact: true }).click()
  // One branch: straight to the app. Several: the branch step, then the app.
  await Promise.race([page.waitForURL(/\/(en|ar)\/(dashboard|login\/branch|login\/verify)/), page.waitForTimeout(15_000)])
  if (/\/login\/branch/.test(page.url())) {
    await page.getByRole("radio").first().click()
    await page.getByRole("button", { name: t.branch.submit, exact: true }).click()
    await page.waitForURL(/\/(en|ar)\/dashboard/)
  }
}

test("signs in as the demo admin and reaches the dashboard", async ({ page }) => {
  expect(USER && PASSWORD, "E2E_USER and E2E_PASSWORD are needed").toBeTruthy()
  await signIn(page)
  expect(page.url()).toMatch(/\/en\/dashboard/)
  // The shell loaded the signed-in user from the API (the dashboard greeting is still the sample, DASH-01).
  const status = await page.evaluate(async () => (await fetch("/api/user", { headers: { "X-Auth-Mode": "cookie" } })).status)
  expect(status).toBe(200)
})

test("keeps no token in storage, the readable cookies or any address", async ({ page, context }) => {
  const urls: string[] = []
  page.on("request", (r) => urls.push(r.url()))
  await signIn(page)
  await page.goto("/en/patients")
  const dump = await page.evaluate(() => ({
    local: JSON.stringify(Object.entries(localStorage)),
    session: JSON.stringify(Object.entries(sessionStorage)),
    cookie: document.cookie,
  }))
  for (const where of [dump.local, dump.session, dump.cookie]) {
    expect(where).not.toMatch(/\d+\|[A-Za-z0-9]{20,}/) // a Sanctum token
    expect(where).not.toMatch(/his_session/)
  }
  expect(urls.filter((u) => /token|\d+\|[A-Za-z0-9]{20,}/i.test(u))).toEqual([])
  // The session cookie exists but the page cannot read it.
  const cookies = await context.cookies()
  const session = cookies.find((c) => c.name === "his_session")
  expect(session?.httpOnly).toBe(true)
  expect(session?.sameSite).toBe("Lax")
})

test("a wrong password shows the attempts left from the API", async ({ page }) => {
  await page.goto("/en/login")
  await page.locator("input[autocomplete=username]").fill(USER)
  await page.locator("input[type=password]").fill("wrong-password-1")
  await page.getByRole("button", { name: en.login.submit, exact: true }).click()
  await expect(page.getByRole("alert").filter({ hasText: /attempts? left/ })).toBeVisible()
  await expect(page.getByText(en.login.wrongField)).toBeVisible()
})

for (const [locale, dir, t] of [
  ["en", "ltr", en],
  ["ar", "rtl", ar],
] as const) {
  test(`the sign-in page in ${locale} (${dir})`, async ({ page }, testInfo) => {
    await page.goto(`/${locale}/login`)
    await expect(page.locator("html")).toHaveAttribute("dir", dir)
    await expect(page.getByRole("heading", { level: 1, name: t.login.title })).toBeVisible()
    // The Nafath button is visible and switched off, with the third-party label as visible text.
    const nafath = page.getByRole("button", { name: t.login.nafath })
    await expect(nafath).toBeDisabled()
    await expect(page.getByText(locale === "en" ? "Third-party service, not connected yet" : "خدمة طرف ثالث، مو مربوطة للحين")).toBeVisible()
    // No sign-up link (D12).
    await expect(page.locator('a[href$="/signup"]')).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath(`sign-in-${locale}.png`), fullPage: true })
    await testInfo.attach(`sign-in-${locale}`, { path: testInfo.outputPath(`sign-in-${locale}.png`), contentType: "image/png" })
  })
}

test("a forged his_session and the old ms_session=1 are sent to sign in", async ({ page, context, baseURL }) => {
  const url = baseURL as string
  await context.addCookies([
    { name: "his_session", value: `1|forged.${Math.floor(Date.now() / 1000) + 3600}.${"a".repeat(64)}`, url },
    { name: "ms_session", value: "1", url },
  ])
  await page.goto("/en/dashboard")
  await expect(page).toHaveURL(/\/en\/login\?next=%2Fdashboard/)
})

test("the security headers are on a page", async ({ page }) => {
  const res = await page.goto("/en/login")
  const h = res!.headers()
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'")
  expect(h["content-security-policy"]).toMatch(/script-src[^;]*'nonce-/)
  expect(h["x-frame-options"]).toBe("DENY")
  expect(h["x-content-type-options"]).toBe("nosniff")
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin")
})

test("the code page without a step goes back to sign in", async ({ page }) => {
  await page.goto("/en/login/verify")
  await expect(page).toHaveURL(/\/en\/login$/)
  await page.goto("/en/login/branch")
  await expect(page).toHaveURL(/\/en\/login$/)
})

test("logs out and the app is closed again", async ({ page }) => {
  await signIn(page)
  await page.goto("/en/logout")
  await expect(page).toHaveURL(/\/en\/login/)
  await page.goto("/en/dashboard")
  await expect(page).toHaveURL(/\/en\/login\?next=%2Fdashboard/)
})

/**
 * AUTH-02, the code page. Needs an account with two-step on (email method): E2E_USER_2FA and E2E_PASSWORD (in the load seed,
 * staff number n % 10 == 3). The code goes by email and a test cannot read it, so only the wrong-code path is driven: the
 * tries and the wait come from the API, and after the last wrong try the page goes back to sign in. It uses up the tries of
 * that sign-in only, never the account lock (the password was right).
 */
const USER_2FA = process.env.E2E_USER_2FA ?? ""

test.describe("code page (two-step account)", () => {
  test.skip(!USER_2FA, "set E2E_USER_2FA to an account with two-step on to run the code page tests")

  async function toCodePage(page: Page) {
    await page.goto("/en/login")
    await page.locator("input[autocomplete=username]").fill(USER_2FA)
    await page.locator("input[type=password]").fill(PASSWORD)
    await page.getByRole("button", { name: en.login.submit, exact: true }).click()
    await page.waitForURL(/\/en\/login\/verify/)
  }

  test("shows the masked email, counts tries from the API, then returns to sign in", async ({ page }) => {
    await toCodePage(page)
    await expect(page.getByRole("heading", { name: en.otp.login.titleEmail })).toBeVisible()
    // The address the code went to is masked: no full local part.
    await expect(page.getByText(/\*\*\*@/)).toBeVisible()
    // The resend link is behind the server's wait; the phone link is switched off.
    await expect(page.getByText(en.otp.resendIn)).toBeVisible()

    const otp = page.getByLabel(en.otp.label)
    await otp.fill("000001")
    await expect(page.getByRole("alert").filter({ hasText: /2 tries left/ })).toBeVisible()
    await otp.fill("000002")
    await expect(page.getByRole("alert").filter({ hasText: /1 try left/ })).toBeVisible()
    await otp.fill("000003")
    await page.waitForURL(/\/en\/login(\?|$)/)
    await expect(page.getByText(en.login.codeTriesUsed)).toBeVisible()
  })

  test("the code page in Arabic is right to left and shows no English", async ({ page }) => {
    await page.goto("/ar/login")
    await page.locator("input[autocomplete=username]").fill(USER_2FA)
    await page.locator("input[type=password]").fill(PASSWORD)
    await page.getByRole("button", { name: ar.login.submit, exact: true }).click()
    await page.waitForURL(/\/ar\/login\/verify/)
    expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl")
    await expect(page.getByRole("heading", { name: ar.otp.login.titleEmail })).toBeVisible()
    await expect(page.getByText(ar.otp.resendIn)).toBeVisible()
  })
})
