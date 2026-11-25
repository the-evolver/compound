import { expect, test } from '@playwright/test'
import { onboard, setDay } from './helpers'

const SCREENS: Array<[path: string, expected: string | RegExp]> = [
  ['/#/', /Day 2 of 274/],
  ['/#/plan?tab=timeline', 'Phases'],
  ['/#/plan?tab=study', 'Subject queue'],
  ['/#/plan?tab=habits', 'Starting later'],
  ['/#/logs?tab=dsa', 'Log a problem'],
  ['/#/logs?tab=workouts', 'Start a workout'],
  ['/#/logs?tab=speaking', 'Log a speaking drill'],
  ['/#/logs?tab=body', '7-day average'],
  ['/#/logs?tab=skin', 'Photo checkpoints'],
  ['/#/logs?tab=mocks', 'Log a mock interview'],
  ['/#/logs?tab=applications', 'Add a company'],
  ['/#/review', 'Weekly reviews'],
  ['/#/review/month/2026-12', 'Results vs plan'],
  ['/#/settings', 'Back up now'],
]

test('every screen opens without errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  await onboard(page)
  await setDay(page, '2026-12-02')
  await page.goto('/#/plan?tab=habits')
  const habitLink = (await page.locator('a[href^="#/habits/"]:not([href*="new"])').first().getAttribute('href'))!
  for (const [path, expected] of [...SCREENS, [habitLink.replace(/^#/, '/#'), 'If-then plan'] as [string, string]]) {
    await page.goto(path)
    await expect(page.getByText(expected).first(), path).toBeVisible()
  }
  // Insights: each area has its own charts (areas have random ids, so pick by name).
  await page.goto('/#/insights')
  const areaCharts: Array<[area: string, chart: string]> = [
    ['Career', 'DSA problems per week'],
    ['Body', 'Sessions per week'],
    ['Skin', 'Sunscreen days per week'],
    ['Voice', 'Drills per week'],
  ]
  for (const [area, chart] of areaCharts) {
    await page.getByRole('button', { name: new RegExp(area) }).click()
    await expect(page.getByText(chart).first(), area).toBeVisible()
  }
  expect(errors).toEqual([])
})

test('insights show an honest status and draw the weekly compliance chart', async ({ page }) => {
  await onboard(page)
  await setDay(page, '2026-12-16') // two weeks in, nothing logged
  await page.goto('/#/insights?area=career')
  const career = page.getByRole('button', { name: /Career/ })
  await expect(career.getByText('Off track')).toBeVisible()
  await expect(career.getByText('0%')).toBeVisible()
  const chart = page.getByRole('figure', { name: 'Career lead compliance by week' })
  // Every week is 0%, so there are no bars to draw, but the chart and its 80% line are there.
  await expect(chart.locator('svg.recharts-surface')).toBeVisible()
  await expect(chart.getByText('80% target')).toBeVisible()
  await expect(page.getByRole('figure', { name: /Career daily completion/ })).toBeVisible()

  // Axis labels read in full: none is pushed past the chart's left edge (clipped "100%" once read "0%").
  for (const figure of await page.getByRole('figure').all()) {
    const box = (await figure.boundingBox())!
    for (const tick of await figure.locator('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value').all()) {
      const t = (await tick.boundingBox())!
      expect(t.x, `${await figure.getAttribute('aria-label')}: "${await tick.textContent()}"`).toBeGreaterThanOrEqual(box.x)
    }
  }
  await expect(chart.locator('.recharts-yAxis-tick-labels').getByText('100%')).toBeVisible()
})
