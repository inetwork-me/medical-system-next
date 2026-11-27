import { defineConfig, devices } from "@playwright/test"

const PORT = Number(process.env.E2E_PORT ?? 3100)
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`
const CI = !!process.env.CI

// With no E2E_BASE_URL the tests run against the static export in ./out (npm run build:e2e), served locally.
// Set E2E_BASE_URL to test an app that is already running (for example `next dev` or a staging site); no server is started then.
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  reporter: CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx serve out --listen ${PORT} --no-clipboard`,
        url: `${baseURL}/en/`,
        reuseExistingServer: !CI,
        timeout: 60_000,
      },
})
