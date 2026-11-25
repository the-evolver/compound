import { fileURLToPath } from 'node:url'
import { expect, type Page } from '@playwright/test'

/** The neutral sample plan file (same shape as a real plan, nothing personal). */
export const SAMPLE_PLAN = fileURLToPath(new URL('../fixtures/sample-plan.compound.json', import.meta.url))

export const PASSWORD = 'correct horse battery'

/** Fixes the page's clock to 10:00 IST on a day, and reloads so the app picks it up. */
export async function setDay(page: Page, day: string, time = '10:00'): Promise<void> {
  await page.clock.setFixedTime(new Date(`${day}T${time}:00+05:30`))
  await page.reload()
}

/** Creates an account, saves its recovery code (returned) and lands on plan setup. */
export async function signUp(page: Page, username: string, opts: { password?: string; remember?: boolean } = {}): Promise<string> {
  await page.getByRole('radio', { name: 'Create account' }).click()
  await page.getByLabel('Username').fill(username)
  await page.getByLabel(/^Password \(at least/).fill(opts.password ?? PASSWORD)
  await page.getByLabel('Password again').fill(opts.password ?? PASSWORD)
  if (opts.remember === false) await page.getByLabel(/Keep me logged in/).uncheck()
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Save your recovery code' })).toBeVisible()
  const code = (await page.getByTestId('recovery-code').textContent())!.trim()
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
  await page.getByLabel(/saved my recovery code/).check()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Set up your plan' })).toBeVisible()
  return code
}

export async function logIn(page: Page, username: string, password = PASSWORD): Promise<void> {
  await page.getByRole('radio', { name: 'Log in' }).click()
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
}

/** Signs up and completes onboarding with the sample plan file (the plan starts 1 Dec 2026). Returns the recovery code. */
export async function onboard(page: Page, opts: { today?: string; weight?: string; username?: string } = {}): Promise<string> {
  await page.clock.setFixedTime(new Date(`${opts.today ?? '2026-11-28'}T10:00:00+05:30`))
  await page.goto('/')
  const code = await signUp(page, opts.username ?? 'tester')
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: /Load a plan file/ }).click()
  await (await chooser).setFiles(SAMPLE_PLAN)
  await page.getByLabel('Weight (kg)').fill(opts.weight ?? '80')
  await page.getByLabel('Weight (kg)').blur()
  await page.getByRole('button', { name: 'Start my plan' }).click()
  // The main navigation only appears once onboarding has been saved.
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
  return code
}

/** The article card of a habit on Today. */
export function habitCard(page: Page, name: string) {
  return page.locator('article').filter({ has: page.getByRole('heading', { name, exact: true }) })
}

/** Raw stored text of every app database on the device (what someone without the password would see). */
export async function rawStorageText(page: Page): Promise<string> {
  return page.evaluate(async () => {
    let text = ''
    for (const { name } of await indexedDB.databases()) {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(name!)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      for (const store of Array.from(db.objectStoreNames)) {
        const rows = await new Promise<unknown[]>((resolve) => {
          const g = db.transaction(store).objectStore(store).getAll()
          g.onsuccess = () => resolve(g.result)
        })
        text += JSON.stringify(rows, (_k, v) => (v instanceof Uint8Array ? `<${v.length} bytes>` : v))
      }
      db.close()
    }
    return text
  })
}
