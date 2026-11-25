import { defineConfig, devices } from '@playwright/test'

// End-to-end tests run against the production build (service worker
// included) on a phone-sized screen, using the locally installed Chrome.
const PORT = 4174

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    ...devices['Pixel 7'],
    channel: 'chrome',
    headless: true,
    baseURL: `http://localhost:${PORT}`,
    serviceWorkers: 'allow',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  },
  // Serves dist/ as built by `npm run e2e` (build, then test).
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
})
