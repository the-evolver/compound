import { expect, test } from '@playwright/test'
import { habitCard, onboard, setDay } from './helpers'

test('acceptance 5: a logged workout pre-fills the next one, and topping the rep range suggests +2.5 kg', async ({ page }) => {
  await onboard(page)
  await setDay(page, '2026-12-02') // Wednesday: a workout day

  await page.getByRole('link', { name: /Start Full Body A/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Full Body A' })).toBeVisible()

  // First time: sets start at the bottom of the range. Log 3 × 12 at 40 kg for the squat.
  for (const set of [1, 2, 3]) {
    const reps = page.getByLabel(`Set ${set} reps (reps)`).first()
    await reps.fill('12')
    await reps.blur()
    const kg = page.getByLabel(`Set ${set} weight (kg)`).first()
    await kg.fill('40')
    await kg.blur()
  }
  await page.getByRole('button', { name: 'Save workout' }).click()
  await expect(page).not.toHaveURL(/workout/)

  // The workout habit is now done from the log.
  await page.goto('/#/')
  await expect(habitCard(page, 'Workout: full body').getByText('from your log')).toBeVisible()

  // Next Full Body A session: pre-filled from last time, with a +2.5 kg suggestion.
  await setDay(page, '2026-12-07')
  await page.goto('/#/logs?tab=workouts')
  await page.getByRole('link', { name: /Full Body A/ }).first().click()
  const squat = page.locator('div.rounded-2xl').filter({ has: page.getByRole('heading', { name: 'Back squat' }) })
  await expect(squat.getByLabel('Set 1 reps (reps)')).toHaveValue('12')
  await expect(squat.getByLabel('Set 1 weight (kg)')).toHaveValue('40.0')
  await expect(squat.getByText('Go up to 42.5 kg.')).toBeVisible()
  await squat.getByRole('button', { name: 'Apply' }).click()
  await expect(squat.getByLabel('Set 1 weight (kg)')).toHaveValue('42.5')
  await expect(squat.getByLabel('Set 1 reps (reps)')).toHaveValue('8')
})
