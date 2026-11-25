import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { fromBase64, unsealJson, unwrapDataKey } from '../../src/platform/crypto'
import { habitCard, onboard, PASSWORD, setDay } from './helpers'

const WEEK1_ITEMS = ['DSA practice', 'Study block', 'AM: cleanser + sunscreen', 'Reapply before long time outdoors', '7-min speaking drill']

async function downloadBackup(page: Page): Promise<{ name: string; text: string }> {
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Back up now' }).click()
  const file = await download
  await expect(page.getByText('Backup saved.')).toBeVisible()
  return { name: file.suggestedFilename(), text: await readFile(await file.path(), 'utf8') }
}

/** Decrypts a backup file with the account password, as the app does. */
async function openBackup(text: string): Promise<{ exportedAt: number; tables: Record<string, Array<Record<string, unknown>>> }> {
  const sealed = JSON.parse(text)
  const key = await unwrapDataKey(sealed.lock.wrappedKey, PASSWORD, sealed.lock.kdf)
  return unsealJson(key, fromBase64(sealed.data))
}

/** Everything except the export time, which differs between two exports by design. */
function comparable(file: { tables: Record<string, Array<Record<string, unknown>>> }) {
  return { ...file.tables, kv: file.tables.kv!.filter((r) => r.key !== 'backup') }
}

async function itemNames(page: Page): Promise<string[]> {
  return page.locator('article h3').allTextContents()
}

/** Taps Done on every open habit item, one tap each, and waits until they are saved. Returns the number of taps. */
async function markAllDone(page: Page): Promise<number> {
  await page.locator('article').first().waitFor()
  const names = await page.locator('article h3').allTextContents()
  let taps = 0
  for (const name of names) {
    const done = habitCard(page, name).getByRole('button', { name: 'Done', exact: true })
    if (await done.count()) {
      await done.click()
      taps++
    }
  }
  await expect(page.getByText(`All ${names.length} done for today.`)).toBeVisible()
  return taps
}

test('1: a fresh install shows only the week-1 habits', async ({ page }) => {
  await onboard(page)
  await setDay(page, '2026-12-01') // Tuesday, day 1
  await expect(page.getByText('Day 1 of 274')).toBeVisible()
  expect((await itemNames(page)).sort()).toEqual([...WEEK1_ITEMS].sort())
  // Steps is the only number habit in week 1; protein and sleep come later.
  await expect(page.getByLabel('Steps', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Protein (g)')).toHaveCount(0)
  await expect(page.getByLabel('Sleep (h)')).toHaveCount(0)
})

test("2: all of today's items can be marked in under 60 seconds, one tap each", async ({ page }) => {
  await onboard(page)
  await setDay(page, '2026-12-02') // Wednesday: 6 items including the workout
  await page.locator('article').first().waitFor()
  const items = (await itemNames(page)).length
  expect(items).toBe(6)
  const started = Date.now()
  const taps = await markAllDone(page)
  const steps = page.getByLabel('Steps', { exact: true })
  await steps.fill('7500')
  await steps.blur()
  const elapsed = Date.now() - started
  expect(taps).toBe(items)
  await expect(page.getByText(`All ${items} done for today.`)).toBeVisible()
  await expect(page.locator('section').filter({ hasText: 'Numbers' }).getByText('Done')).toBeVisible()
  expect(elapsed).toBeLessThan(60_000)
})

test('3: a miss dips strength slightly and flags "never miss twice"; a skip with a reason does not', async ({ page }) => {
  await onboard(page)
  for (const day of ['2026-12-01', '2026-12-02', '2026-12-03']) {
    await setDay(page, day)
    await markAllDone(page)
  }
  const strength = (name: string) => habitCard(page, name).getByLabel(/Strength \d+ of 100/).getAttribute('aria-label')

  await setDay(page, '2026-12-04')
  expect(await strength('7-min speaking drill')).toBe('Strength 15 of 100')
  // Skip the sunscreen with a reason; leave the drill undone (missed at rollover).
  await habitCard(page, 'AM: cleanser + sunscreen').getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Travel' }).click()
  await expect(habitCard(page, 'AM: cleanser + sunscreen').getByText('Travel')).toBeVisible()

  await setDay(page, '2026-12-05')
  const drill = habitCard(page, '7-min speaking drill')
  await expect(drill.getByText('Never miss twice')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Never miss twice' })).toBeVisible()
  expect(await strength('7-min speaking drill')).toBe('Strength 14 of 100') // 15 → 14: a small dip
  await expect(habitCard(page, 'AM: cleanser + sunscreen').getByText('Never miss twice')).toHaveCount(0)
  expect(await strength('AM: cleanser + sunscreen')).toBe('Strength 15 of 100') // unchanged by the skip
})

test('4: a logged problem is reviewed the next day; Failed brings it back the day after', async ({ page }) => {
  await onboard(page)
  await setDay(page, '2026-12-02')
  const dsa = page.locator('div.rounded-2xl').filter({ has: page.getByRole('heading', { name: 'DSA', exact: true }) })
  await dsa.getByRole('button', { name: 'Log a problem' }).click()
  await page.getByRole('dialog').getByLabel('Problem').fill('Two Sum')
  await page.getByRole('dialog').getByRole('button', { name: /Log it/ }).click()
  await expect(dsa.getByText(/0 reviews, 1 new/)).toBeVisible()
  await expect(dsa.getByText('Reviews due today: 0')).toBeVisible()

  await setDay(page, '2026-12-03')
  await expect(dsa.getByText('Reviews due today: 1')).toBeVisible()
  await dsa.getByRole('button', { name: /Two Sum/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: /^Failed/ }).click()
  await expect(dsa.getByText('Reviews due today: 0')).toBeVisible()

  await setDay(page, '2026-12-04')
  await expect(dsa.getByText('Reviews due today: 1')).toBeVisible()
  await expect(dsa.getByRole('button', { name: /Two Sum/ })).toBeVisible()
})

test('7: export JSON → reset → import gives back identical data (and the file is encrypted)', async ({ page }) => {
  // Force the download path (headless Chrome has no real share sheet).
  await page.addInitScript(() => Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }))
  const recoveryCode = await onboard(page)
  await setDay(page, '2026-12-02')
  await markAllDone(page)
  await page.getByPlaceholder('One line about today (optional)').fill('A good first Wednesday')
  await page.getByPlaceholder('One line about today (optional)').blur()

  await page.goto('/#/settings')
  const before = await downloadBackup(page)
  expect(before.name).toBe('compound-backup-2026-12-02.json')
  expect(before.text).not.toContain('DSA practice')
  expect(before.text).not.toContain('A good first Wednesday')

  await page.getByRole('button', { name: "Erase this account's data…" }).click()
  await page.getByRole('dialog').getByRole('textbox').fill('RESET')
  await page.getByRole('dialog').getByRole('button', { name: 'Delete everything' }).click()
  await expect(page.getByRole('heading', { name: 'Set up your plan' })).toBeVisible()

  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Restore from a backup file' }).click()
  await (await chooser).setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(before.text) })
  await page.getByLabel('Password or recovery code').fill('wrong password')
  await page.getByRole('button', { name: 'Unlock backup' }).click()
  await expect(page.getByText(/Wrong password or recovery code for this backup/)).toBeVisible()
  // The recovery code opens it too (the password does as well: see the unit tests).
  await page.getByLabel('Password or recovery code').fill(recoveryCode)
  await page.getByRole('button', { name: 'Unlock backup' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Restore' }).click()
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()

  await page.goto('/#/settings')
  const after = await downloadBackup(page)
  expect(comparable(await openBackup(after.text))).toEqual(comparable(await openBackup(before.text)))
})

test('8: installable, works offline after the first load, and exports a valid calendar file', async ({ page, context }) => {
  // Use the download path for the calendar file (headless Chrome has no real share sheet).
  await page.addInitScript(() => Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }))
  // Installable: a manifest with name, standalone display and 192/512 + maskable icons.
  const manifest = await (await page.request.get('/manifest.webmanifest')).json()
  expect(manifest).toMatchObject({ name: 'Compound', display: 'standalone' })
  const sizes = manifest.icons.map((i: { sizes: string; purpose?: string }) => `${i.sizes}${i.purpose ? `:${i.purpose}` : ''}`)
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512', '512x512:maskable']))

  // Offline: after the service worker takes control, the app loads with no network.
  await onboard(page)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
  // A lazily loaded screen opens offline too (its code comes from the cache).
  await page.goto('/#/insights')
  await expect(page.getByRole('heading', { level: 1, name: 'Insights' })).toBeVisible()
  await context.setOffline(false)

  // Calendar file: RFC 5545 structure (Google Calendar import itself is a manual step).
  await page.goto('/#/settings')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export calendar file (.ics)' }).click()
  const ics = await readFile(await (await download).path(), 'utf8')
  expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
  expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
  expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(ics.match(/END:VEVENT/g)?.length)
  // The device's timezone; Chrome may report India's zone by its older IANA alias.
  expect(ics).toMatch(/DTSTART;TZID=Asia\/(Kolkata|Calcutta):\d{8}T\d{6}/)
  expect(ics).toMatch(/RRULE:FREQ=(DAILY|WEEKLY)/)
  for (const line of ics.split('\r\n')) expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75)
  await expect(page.getByText('Up to date')).toBeVisible()
})

test('9: no placeholder text, and every button and link is labelled and does something', async ({ page }) => {
  await onboard(page)
  await setDay(page, '2026-12-06')
  const screens = [
    '/#/',
    '/#/plan?tab=timeline',
    '/#/plan?tab=study',
    '/#/plan?tab=habits',
    '/#/habits/new?area=career',
    '/#/logs?tab=dsa',
    '/#/logs?tab=workouts',
    '/#/logs?tab=speaking',
    '/#/logs?tab=body',
    '/#/logs?tab=skin',
    '/#/logs?tab=mocks',
    '/#/logs?tab=applications',
    '/#/review',
    '/#/review/week/2026-11-30',
    '/#/review/month/2026-12',
    '/#/insights?area=career',
    '/#/insights?area=body',
    '/#/insights?area=skin',
    '/#/insights?area=voice',
    '/#/settings',
  ]
  // Screens addressed by (random) ids: take their links from the app.
  await page.goto('/#/plan?tab=habits')
  screens.push((await page.locator('a[href^="#/habits/"]:not([href*="new"])').first().getAttribute('href'))!.replace(/^#/, '/#'))
  await page.goto('/#/logs?tab=workouts')
  screens.push((await page.getByRole('link', { name: /Full Body B/ }).first().getAttribute('href'))!.replace(/^#/, '/#'))
  for (const path of screens) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const text = await page.locator('body').innerText()
    expect(text, path).not.toMatch(/lorem|ipsum|\bTODO\b|\bTBD\b|coming soon|placeholder|undefined|NaN|\[object Object\]/i)
    const unlabeled = await page.evaluate(() =>
      [...document.querySelectorAll('button, a, [role=button]')]
        .filter((el) => !(el.textContent?.trim() || el.getAttribute('aria-label') || el.getAttribute('title')))
        .map((el) => el.outerHTML.slice(0, 80)),
    )
    expect(unlabeled, path).toEqual([])
    const deadLinks = await page.evaluate(() => [...document.querySelectorAll('a')].filter((a) => !a.getAttribute('href')).map((a) => a.textContent))
    expect(deadLinks, path).toEqual([])
  }
})
