import { expect, test } from '@playwright/test'
import { onboard } from './helpers'

// No service worker here, so a blocked download really fails (as when offline before caching).
test.use({ serviceWorkers: 'block' })

test("a screen whose code can't load explains what to do, and the rest of the app keeps working", async ({ page }) => {
  await onboard(page)
  const insightsCode = '**/assets/InsightsScreen-*.js'
  await page.route(insightsCode, (route) => route.abort())

  await page.goto('/#/insights')
  await expect(page.getByRole('heading', { name: "This screen couldn't load" })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()

  await page.getByRole('button', { name: 'Go to Today' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/day/i)

  // Back online: a reload brings the screen back.
  await page.unroute(insightsCode)
  await page.goto('/#/insights')
  await page.getByRole('button', { name: 'Reload' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Insights' })).toBeVisible()
})
