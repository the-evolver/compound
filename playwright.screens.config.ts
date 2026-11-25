import { defineConfig } from '@playwright/test'
import base from './playwright.config'

/*
 * Screenshots of every screen on a phone-sized display, with a few weeks of
 * realistic use from the sample plan: `npm run screens`. Not part of the
 * test suite. Images go to private/screenshots/ (kept out of git) unless
 * SCREENS_DIR says otherwise.
 */
export default defineConfig({
  ...base,
  testDir: 'tests/screens',
  timeout: 10 * 60_000,
  use: { ...base.use, actionTimeout: 15_000, screenshot: 'only-on-failure' },
})
