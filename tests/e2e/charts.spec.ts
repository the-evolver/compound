import { expect, test } from '@playwright/test'
import { onboard, setDay } from './helpers'

test('mock score trend draws both series in their palette colours without freezing', async ({ page }) => {
  await onboard(page)
  await setDay(page, '2026-12-03')
  await page.goto('/#/logs?tab=mocks')

  for (const [day, comm] of [
    ['2026-12-01', '2'],
    ['2026-12-03', '3'],
  ] as const) {
    await page.getByRole('button', { name: 'Log a mock interview' }).click()
    const sheet = page.getByRole('dialog')
    await sheet.getByLabel('Date').fill(day)
    await sheet.getByRole('radiogroup', { name: 'Communication' }).getByRole('radio', { name: comm }).click()
    await sheet.getByRole('button', { name: 'Save' }).click()
    await expect(sheet).toHaveCount(0)
  }

  const chart = page.getByRole('figure', { name: 'Mock interview scores over time' })
  await expect(chart.locator('.recharts-line-curve')).toHaveCount(2)
  const strokes = await chart.locator('.recharts-line-curve').evaluateAll((els) => els.map((e) => e.getAttribute('stroke')))
  expect(strokes).toEqual(['#338ced', '#e76624'])
  await expect(chart.getByText('Communication')).toBeVisible()

  // Still responsive afterwards (a render loop would hang here).
  await expect.poll(() => page.evaluate(() => document.title), { timeout: 5_000 }).toBe('Compound')
})
