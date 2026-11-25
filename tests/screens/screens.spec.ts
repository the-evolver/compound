import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { habitCard, onboard, SAMPLE_PLAN, setDay } from '../e2e/helpers'

const OUT = process.env.SCREENS_DIR ?? join(process.cwd(), 'private', 'screenshots')
let shot = 0

/** Full-page screenshot, numbered in the order a person meets the screens. */
async function snap(page: Page, name: string): Promise<void> {
  // The "Ready to work offline." note goes away by itself after a few seconds.
  await expect(page.getByText('Ready to work offline.')).toHaveCount(0, { timeout: 8000 })
  await page.waitForTimeout(250) // let charts and sheets settle
  await page.screenshot({ path: join(OUT, `${String(++shot).padStart(2, '0')}-${name}.png`), fullPage: true })
}

const days = (from: string, to: string): string[] => {
  const out: string[] = []
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10))
  return out
}

/** A stable pseudo-random 0–9 per day and habit, so every run makes the same "life". */
const roll = (text: string) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 10

/** One day of use: mostly Done, sometimes the minimum, a skip with a reason, or nothing (a miss). */
async function liveDay(page: Page, day: string): Promise<void> {
  await page.goto('/#/')
  await setDay(page, day, '21:30')
  await page.locator('article').first().waitFor()
  const names = await page.locator('article h3').allTextContents()
  for (const name of names) {
    const card = habitCard(page, name)
    const r = roll(day + name)
    if (r === 9) continue
    const skip = card.getByRole('button', { name: 'Skip', exact: true })
    if (r === 8 && (await skip.count()) && (await skip.isEnabled())) {
      await skip.click()
      await page.getByRole('dialog').getByRole('button', { name: 'Planned rest' }).click()
    } else if (r === 7) {
      const min = card.getByRole('button', { name: 'Min', exact: true })
      if (!(await min.count())) continue
      await min.click()
    } else {
      const done = card.getByRole('button', { name: 'Done', exact: true })
      if (!(await done.count())) continue
      await done.click()
    }
    await expect(card.getByRole('button', { name: 'Undo' })).toBeVisible()
  }
}

async function logProblem(page: Page, name: string): Promise<void> {
  const dsa = page.locator('div.rounded-2xl').filter({ has: page.getByRole('heading', { name: 'DSA', exact: true }) })
  await dsa.getByRole('button', { name: 'Log a problem' }).click()
  await page.getByRole('dialog').getByLabel('Problem').fill(name)
  await page.getByRole('dialog').getByRole('button', { name: /Log it/ }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

async function weeklyReview(page: Page): Promise<void> {
  await page.getByRole('link', { name: /Weekly review ·/ }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('Win 1').fill('Sunscreen every morning')
  await page.getByLabel('Win 2').fill('Four DSA problems logged')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('Miss 1', { exact: true }).fill('Skipped the speaking drill twice')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('One change for next week').fill('After lunch, at my desk, I do the 7-minute drill before opening chat.')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('Career commitment 1').fill('10 DSA items, reviews first')
  await page.getByLabel('Body commitment 1').fill('3 workouts, Mon/Wed/Fri')
  await page.getByRole('button', { name: 'Finish review' }).click()
  await expect(page.getByText('Review done')).toBeVisible()
}

test('every screen on a phone, after three weeks of use', async ({ page }) => {
  await mkdir(OUT, { recursive: true })
  // Downloads instead of the share sheet (headless Chrome has none).
  await page.addInitScript(() => Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }))

  // ── Arriving ───────────────────────────────────────────────
  await page.clock.setFixedTime(new Date('2026-11-28T10:00:00+05:30'))
  await page.goto('/')
  await snap(page, 'create-account')
  await page.getByRole('radio', { name: 'Create account' }).click()
  await page.getByLabel('Username').fill('sample')
  await page.getByLabel(/^Password \(at least/).fill('correct horse battery')
  await page.getByLabel('Password again').fill('correct horse battery')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Save your recovery code' })).toBeVisible()
  await snap(page, 'recovery-code')
  await page.getByLabel(/saved my recovery code/).check()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Set up your plan' })).toBeVisible()
  await snap(page, 'setup-choose')
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: /Load a plan file/ }).click()
  await (await chooser).setFiles(SAMPLE_PLAN)
  await page.getByLabel('Weight (kg)').fill('80')
  await page.getByLabel('Weight (kg)').blur()
  await snap(page, 'setup-form')
  await page.getByRole('button', { name: 'Start my plan' }).click()
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()

  // ── Three weeks of use ─────────────────────────────────────
  for (const day of days('2026-12-01', '2026-12-19')) {
    await liveDay(page, day)
    if (['2026-12-02', '2026-12-04', '2026-12-08', '2026-12-10', '2026-12-15', '2026-12-17'].includes(day)) {
      await setDay(page, day, '21:30')
      await logProblem(page, `Problem ${day.slice(8)}`)
    }
    if (day === '2026-12-06') {
      await setDay(page, day, '19:00')
      await weeklyReview(page)
    }
    if (day === '2026-12-16') {
      await page.getByRole('link', { name: /Start Full Body/ }).click()
      for (const set of [1, 2, 3]) {
        await page.getByLabel(`Set ${set} reps (reps)`).first().fill('10')
        await page.getByLabel(`Set ${set} weight (kg)`).first().fill('40')
      }
      await page.getByLabel('Set 3 weight (kg)').first().blur()
      await snap(page, 'workout-logging')
      await page.getByRole('button', { name: 'Save workout' }).click()
      await expect(page).not.toHaveURL(/workout/)
    }
  }

  // ── Every screen, on Sunday 20 Dec ─────────────────────────
  await setDay(page, '2026-12-20', '08:00')
  await snap(page, 'today-morning')
  await habitCard(page, (await page.locator('article h3').first().textContent())!).getByRole('button', { name: 'Skip', exact: true }).click()
  await snap(page, 'today-skip-sheet')
  await page.keyboard.press('Escape')
  await setDay(page, '2026-12-20', '19:00')
  await snap(page, 'today-evening')

  // [file name, address, text that shows the screen has loaded]
  const screens: Array<[string, string, string]> = [
    ['plan-timeline', '/#/plan?tab=timeline', 'Phases'],
    ['plan-study', '/#/plan?tab=study', 'Subject queue'],
    ['plan-habits', '/#/plan?tab=habits', 'Starting later'],
    ['logs-dsa', '/#/logs?tab=dsa', 'Log a problem'],
    ['logs-workouts', '/#/logs?tab=workouts', 'Start a workout'],
    ['logs-speaking', '/#/logs?tab=speaking', 'Log a speaking drill'],
    ['logs-body', '/#/logs?tab=body', '7-day average'],
    ['logs-skin', '/#/logs?tab=skin', 'Photo checkpoints'],
    ['logs-mocks', '/#/logs?tab=mocks', 'Log a mock interview'],
    ['logs-applications', '/#/logs?tab=applications', 'Add a company'],
    ['review', '/#/review', 'Weekly reviews'],
    ['review-monthly', '/#/review/month/2026-12', 'Results vs plan'],
    ['insights', '/#/insights', 'Lead compliance by week'],
  ]
  for (const [name, path, loaded] of screens) {
    const t0 = Date.now()
    await page.goto(path)
    await expect(page.getByText(loaded).first()).toBeVisible()
    console.log(`${name}: content after ${Date.now() - t0} ms`)
    await snap(page, name)
  }
  for (const area of ['Body', 'Skin', 'Voice']) {
    await page.getByRole('button', { name: new RegExp(area) }).first().click()
    await snap(page, `insights-${area.toLowerCase()}`)
  }

  await page.goto('/#/plan?tab=habits')
  await page.locator('a[href^="#/habits/"]:not([href*="new"])').first().click()
  await expect(page.getByText('If-then plan').first()).toBeVisible()
  await snap(page, 'habit-editor')

  await page.goto('/#/')
  await page.getByRole('link', { name: /Weekly review ·/ }).click()
  await expect(page.getByRole('heading', { name: '1. Scoreboard' })).toBeVisible()
  await snap(page, 'weekly-review-scoreboard')

  await page.goto('/#/settings')
  await expect(page.getByRole('button', { name: 'Back up now' })).toBeVisible()
  await snap(page, 'settings')

  // Light theme.
  await page.getByRole('radio', { name: 'Light' }).click()
  await page.goto('/#/')
  await page.locator('article').first().waitFor()
  await snap(page, 'today-light')
  await page.goto('/#/insights')
  await expect(page.getByText('Lead compliance by week')).toBeVisible()
  await snap(page, 'insights-light')
  await page.goto('/#/settings')
  await page.getByRole('radio', { name: 'Dark' }).click()

  // Forgot password.
  await page.goto('/#/settings')
  await page.getByRole('button', { name: 'Log out' }).click()
  await page.getByRole('button', { name: 'Forgot password?' }).click()
  await snap(page, 'forgot-password')
  await page.getByRole('button', { name: 'Back to log in' }).click()
  await snap(page, 'log-in')
})

test.describe('the crash screen', () => {
  // No service worker, so a blocked download really fails (as when offline before caching).
  test.use({ serviceWorkers: 'block' })
  test('a screen whose code cannot load', async ({ page }) => {
    await mkdir(OUT, { recursive: true })
    await onboard(page)
    await page.route('**/assets/InsightsScreen-*.js', (route) => route.abort())
    await page.goto('/#/insights')
    await expect(page.getByRole('heading', { name: "This screen couldn't load" })).toBeVisible()
    shot = 98
    await snap(page, 'error-screen')
  })
})
