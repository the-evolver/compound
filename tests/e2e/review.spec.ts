import { expect, test } from '@playwright/test'
import { onboard, setDay } from './helpers'

test('acceptance 6: a finished weekly review puts its commitments on Today the next day, and ends with a one-tap backup', async ({ page }) => {
  // Force the download path (headless Chrome has no real share sheet).
  await page.addInitScript(() => Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }))
  await onboard(page)
  await setDay(page, '2026-12-06', '19:00') // first Sunday of the plan

  // The banner stays until the review is done.
  const banner = page.getByRole('link', { name: /Weekly review · 30 Nov – 6 Dec/ })
  await expect(banner).toBeVisible()
  await page.goto('/#/plan')
  await expect(banner).toBeVisible()
  await banner.click()

  await expect(page.getByRole('heading', { name: '1. Scoreboard' })).toBeVisible()
  await expect(page.getByText('Career').first()).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('heading', { name: '2. Lag check' })).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('Win 1').fill('Sunscreen every single day')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('Miss 1', { exact: true }).fill('DSA on two weekdays')
  await page.getByRole('radiogroup', { name: 'Cause of miss 1' }).getByRole('radio', { name: 'Energy' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('One change for next week').fill('After dinner, at my desk, I open the review queue before my phone.')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('Career commitment 1').fill('10 DSA items, reviews first')
  await page.getByLabel('Body commitment 1').fill('3 workouts, Mon/Wed/Fri')
  await page.getByRole('button', { name: 'Finish review' }).click()

  await expect(page.getByText('Review done')).toBeVisible()
  const summary = page.locator('pre')
  await expect(summary).toContainText('Compound weekly review · 30 Nov – 6 Dec')
  await expect(summary).toContainText('• DSA on two weekdays (energy)')
  await expect(summary).toContainText('• Career: 10 DSA items, reviews first')

  // The last step: back up the week with one tap.
  await expect(page.getByText(/^No backup yet\. Save the encrypted file/)).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Back up now' }).click()
  expect((await download).suggestedFilename()).toBe('compound-backup-2026-12-06.json')
  await expect(page.getByText('Backed up today.')).toBeVisible()

  // Next day: commitments on Today, banner gone.
  await setDay(page, '2026-12-07')
  await page.goto('/#/')
  const card = page.locator('div.rounded-2xl').filter({ has: page.getByRole('heading', { name: "This week's commitments" }) })
  await expect(card.getByText('10 DSA items, reviews first')).toBeVisible()
  await expect(card.getByText('3 workouts, Mon/Wed/Fri')).toBeVisible()
  await expect(page.getByRole('link', { name: /Weekly review ·/ })).toHaveCount(0)
})
