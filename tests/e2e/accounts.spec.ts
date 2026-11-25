import { expect, test } from '@playwright/test'
import { habitCard, logIn, onboard, PASSWORD, rawStorageText, setDay, signUp } from './helpers'

test('a visitor sees only the log-in screen, never a plan', async ({ page }) => {
  await page.goto('/#/plan?tab=habits')
  await expect(page.getByRole('heading', { name: 'Compound' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
  // The shipped code contains no plan: nothing personal, nothing to onboard into but a blank plan or your own file.
  const html = await page.content()
  expect(html).not.toMatch(/DSA practice|Workout: full body|sunscreen/i)
})

test('wrong passwords are refused; the right one opens the plan', async ({ page }) => {
  await onboard(page, { username: 'alex' })
  await page.goto('/#/settings')
  await page.getByRole('button', { name: 'Log out' }).click()
  await logIn(page, 'alex', 'not my password')
  await expect(page.getByRole('alert')).toHaveText('Wrong password.')
  await logIn(page, 'nobody', PASSWORD)
  await expect(page.getByRole('alert')).toHaveText(/No account with that username/)
  await logIn(page, 'ALEX', PASSWORD)
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
})

test("two people on one device can't see each other's plans, and nothing readable is stored", async ({ page }) => {
  await onboard(page, { username: 'alice' })
  await setDay(page, '2026-12-02')
  await habitCard(page, 'AM: cleanser + sunscreen').getByRole('button', { name: 'Done', exact: true }).click()

  // What someone without a password would find in the browser's storage: no plan text at all.
  const stored = await rawStorageText(page)
  for (const secret of ['DSA practice', 'cleanser', 'After dinner', 'Back squat', 'LRU Cache']) expect(stored).not.toContain(secret)

  await page.goto('/#/settings')
  await page.getByRole('button', { name: 'Log out' }).click()
  await signUp(page, 'bob')
  await page.getByRole('button', { name: /Start with a blank plan/ }).click()
  await page.getByRole('button', { name: 'Start with a blank plan' }).click()
  await expect(page.getByText('Your plan is empty')).toBeVisible()
  await page.goto('/#/plan?tab=habits')
  await expect(page.getByText('DSA practice')).toHaveCount(0)

  await page.goto('/#/settings')
  await page.getByRole('button', { name: 'Log out' }).click()
  await logIn(page, 'alice')
  await expect(habitCard(page, 'AM: cleanser + sunscreen').getByRole('button', { name: 'Undo' })).toBeVisible()
})

test('a blank plan can be built from scratch: area, then habit, then it shows on Today', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-12-02T10:00:00+05:30'))
  await page.goto('/')
  await signUp(page, 'newcomer')
  await page.getByRole('button', { name: /Start with a blank plan/ }).click()
  await page.getByRole('button', { name: 'Start with a blank plan' }).click()
  await page.getByRole('link', { name: 'Build my plan' }).click()

  await page.getByRole('button', { name: 'Add your first area' }).click()
  await page.getByRole('dialog').getByLabel('Name').fill('Health')
  await page.getByRole('dialog').getByRole('button', { name: 'Add area' }).click()
  await page.getByRole('link', { name: 'Habit' }).click()
  await page.getByLabel('Name').fill('Evening walk')
  await page.getByLabel('If-then plan').fill('After dinner, at the front door, I walk for 20 minutes.')
  await page.getByLabel('Minimum version').fill('Walk to the corner and back.')
  await page.getByLabel('Start date').fill('2026-12-02')
  await page.getByRole('button', { name: 'Add habit' }).click()
  await expect(page).not.toHaveURL(/habits\/new/)

  await page.goto('/#/')
  await expect(habitCard(page, 'Evening walk')).toBeVisible()
})

test('with "keep me logged in" off, a reload asks for the password again', async ({ page }) => {
  await page.goto('/')
  await signUp(page, 'careful', { remember: false })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
  await logIn(page, 'careful')
  await expect(page.getByRole('heading', { name: 'Set up your plan' })).toBeVisible()
})
