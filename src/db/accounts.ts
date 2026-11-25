import Dexie, { type Table } from 'dexie'
import { z } from 'zod'
import { clock } from '../domain/time/clock'
import {
  canonicalRecoveryCode,
  KDF_ITERATIONS,
  newDataKey,
  newKdfParams,
  newRecoveryCode,
  RECOVERY_ITERATIONS,
  toBase64,
  fromBase64,
  unwrapDataKey,
  wrapDataKey,
  type KdfParams,
} from '../platform/crypto'
import { accountDbName, LEGACY_DB_NAME, openDb, type CompoundDB } from './db'
import { TABLE_NAMES } from './tables'

/*
 * Accounts on this device. The registry holds, per account, only what's
 * needed to check a password: the KDF salt and the data key wrapped with
 * the password. Each account's data lives in its own encrypted database.
 */

const zKdf = z.object({ salt: z.string(), iterations: z.number().int().positive() })

export const zAccount = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  /** Lower-cased username, unique on this device. */
  handle: z.string().min(1),
  kdf: zKdf,
  wrappedKey: z.string(),
  createdAt: z.number(),
  /** The same data key, wrapped with the recovery code. Absent on accounts made before recovery codes. */
  recovery: z.object({ kdf: zKdf, wrappedKey: z.string(), createdAt: z.number() }).optional(),
})
export type Account = z.output<typeof zAccount>

interface SessionRow {
  id: 'current'
  accountId: string
  /** Present only with "keep me logged in": the data key, so the app can open without the password. */
  key?: string
}

class AccountsDB extends Dexie {
  accounts!: Table<Account, string>
  session!: Table<SessionRow, string>
  constructor() {
    super('compound-accounts')
    this.version(1).stores({ accounts: 'id, &handle', session: 'id' })
  }
}

const registry = new AccountsDB()

export class AccountError extends Error {}

export const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/
export const MIN_PASSWORD = 8

const handleOf = (username: string) => username.trim().toLowerCase()

export function validateNewAccount(username: string, password: string, confirm: string): string | null {
  if (!USERNAME_RE.test(username.trim())) return 'Username: 3–32 letters, numbers, dots, dashes or underscores.'
  if (password.length < MIN_PASSWORD) return `Password: at least ${MIN_PASSWORD} characters.`
  if (password !== confirm) return "The passwords don't match."
  return null
}

export async function listAccounts(): Promise<Account[]> {
  return registry.accounts.orderBy('handle').toArray()
}

async function wrapRecovery(key: Uint8Array): Promise<{ code: string; recovery: NonNullable<Account['recovery']> }> {
  const code = newRecoveryCode()
  const { kdf, wrappedKey } = await wrapDataKey(key, canonicalRecoveryCode(code)!, newKdfParams(RECOVERY_ITERATIONS))
  return { code, recovery: { kdf, wrappedKey, createdAt: clock.now() } }
}

/**
 * Creates an account. Returns its data key and its recovery code, which is
 * stored only wrapped: show it to the person once.
 */
export async function createAccount(
  username: string,
  password: string,
  iterations = KDF_ITERATIONS,
): Promise<{ account: Account; key: Uint8Array; recoveryCode: string }> {
  const handle = handleOf(username)
  if (await registry.accounts.where('handle').equals(handle).count()) throw new AccountError('That username is already used on this device.')
  const key = newDataKey()
  const { kdf, wrappedKey } = await wrapDataKey(key, password, newKdfParams(iterations))
  const { code, recovery } = await wrapRecovery(key)
  const account = zAccount.parse({ id: crypto.randomUUID(), username: username.trim(), handle, kdf, wrappedKey, createdAt: clock.now(), recovery })
  await registry.accounts.add(account)
  return { account, key, recoveryCode: code }
}

/** Checks the password by unwrapping the data key. Throws on an unknown user or a wrong password. */
export async function unlockAccount(username: string, password: string): Promise<{ account: Account; key: Uint8Array }> {
  const account = await registry.accounts.where('handle').equals(handleOf(username)).first()
  if (!account) throw new AccountError('No account with that username on this device.')
  try {
    return { account, key: await unwrapDataKey(account.wrappedKey, password, account.kdf) }
  } catch {
    throw new AccountError('Wrong password.')
  }
}

/** Re-wraps the data key with a new password. The data itself doesn't change. */
export async function changePassword(accountId: string, oldPassword: string, newPassword: string): Promise<void> {
  const account = await registry.accounts.get(accountId)
  if (!account) throw new AccountError('Account not found.')
  let key: Uint8Array
  try {
    key = await unwrapDataKey(account.wrappedKey, oldPassword, account.kdf)
  } catch {
    throw new AccountError('The current password is wrong.')
  }
  const { kdf, wrappedKey } = await wrapDataKey(key, newPassword, newKdfParams(account.kdf.iterations))
  await registry.accounts.put({ ...account, kdf, wrappedKey })
}

/**
 * Makes a new recovery code (the old one stops working). Asks for the
 * password, so someone holding an unlocked phone can't take the account over.
 */
export async function makeRecoveryCode(accountId: string, password: string): Promise<string> {
  const account = await registry.accounts.get(accountId)
  if (!account) throw new AccountError('Account not found.')
  let key: Uint8Array
  try {
    key = await unwrapDataKey(account.wrappedKey, password, account.kdf)
  } catch {
    throw new AccountError('Wrong password.')
  }
  const { code, recovery } = await wrapRecovery(key)
  await registry.accounts.put({ ...account, recovery })
  return code
}

/** A forgotten password: the recovery code unlocks the data key, which is re-wrapped with a new password. */
export async function recoverAccount(username: string, code: string, newPassword: string): Promise<{ account: Account; key: Uint8Array }> {
  const account = await registry.accounts.where('handle').equals(handleOf(username)).first()
  if (!account) throw new AccountError('No account with that username on this device.')
  if (!account.recovery) throw new AccountError('This account has no recovery code, so its password cannot be reset.')
  const canonical = canonicalRecoveryCode(code)
  if (!canonical) throw new AccountError('A recovery code has 25 letters and numbers. Check it and try again.')
  let key: Uint8Array
  try {
    key = await unwrapDataKey(account.recovery.wrappedKey, canonical, account.recovery.kdf)
  } catch {
    throw new AccountError('Wrong recovery code.')
  }
  const { kdf, wrappedKey } = await wrapDataKey(key, newPassword, newKdfParams(account.kdf.iterations))
  const updated = { ...account, kdf, wrappedKey }
  await registry.accounts.put(updated)
  return { account: updated, key }
}

export function openAccountDb(account: Pick<Account, 'id'>, key: Uint8Array): CompoundDB {
  return openDb(accountDbName(account.id), { key })
}

/** Deletes an account and all its data on this device. */
export async function deleteAccount(accountId: string): Promise<void> {
  await Dexie.delete(accountDbName(accountId))
  await registry.accounts.delete(accountId)
  const s = await registry.session.get('current')
  if (s?.accountId === accountId) await registry.session.delete('current')
}

// ── Session ─────────────────────────────────────────────────

export async function rememberSession(accountId: string, key: Uint8Array | null): Promise<void> {
  await registry.session.put({ id: 'current', accountId, key: key ? toBase64(key) : undefined })
}

/** The remembered login, if "keep me logged in" was chosen. */
export async function restoreSession(): Promise<{ account: Account; key: Uint8Array } | null> {
  const s = await registry.session.get('current')
  if (!s?.key) return null
  const account = await registry.accounts.get(s.accountId)
  return account ? { account, key: fromBase64(s.key) } : null
}

export async function isSessionRemembered(accountId: string): Promise<boolean> {
  const s = await registry.session.get('current')
  return s?.accountId === accountId && !!s.key
}

export async function forgetSession(): Promise<void> {
  await registry.session.delete('current')
}

export async function getAccount(accountId: string): Promise<Account | undefined> {
  return registry.accounts.get(accountId)
}

// ── Data from before accounts ───────────────────────────────

/** Whether this device has data from the version without accounts. */
export async function hasLegacyData(): Promise<boolean> {
  if (!(await Dexie.exists(LEGACY_DB_NAME))) return false
  const legacy = openDb(LEGACY_DB_NAME)
  try {
    const settings = await legacy.kv.get('settings')
    return !!settings
  } finally {
    legacy.close()
  }
}

/** Moves the pre-accounts data into an account (encrypting it), then deletes the old copy. */
export async function migrateLegacyInto(target: CompoundDB): Promise<number> {
  const legacy = openDb(LEGACY_DB_NAME)
  let moved = 0
  try {
    const tables: Record<string, unknown[]> = {}
    for (const name of TABLE_NAMES) tables[name] = await legacy.table(name).toArray()
    await target.transaction('rw', target.tables, async () => {
      for (const name of TABLE_NAMES) {
        const rows = tables[name]!
        await target.table(name).bulkPut(rows)
        moved += rows.length
      }
    })
    // Only delete the old copy once every row is in the account.
    for (const name of TABLE_NAMES) {
      if ((await target.table(name).count()) < tables[name]!.length) throw new AccountError('Moving the old data failed; it was kept.')
    }
  } finally {
    legacy.close()
  }
  await Dexie.delete(LEGACY_DB_NAME)
  return moved
}

export type { KdfParams }
