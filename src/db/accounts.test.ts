import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  AccountError,
  changePassword,
  createAccount,
  deleteAccount,
  forgetSession,
  hasLegacyData,
  listAccounts,
  makeRecoveryCode,
  migrateLegacyInto,
  openAccountDb,
  recoverAccount,
  rememberSession,
  restoreSession,
  unlockAccount,
  validateNewAccount,
} from './accounts'
import { accountDbName, LEGACY_DB_NAME, openDb } from './db'
import { encryptionMiddleware } from './encryption'
import { storesAt } from './versions'
import { buildBackup, openSealedBackup, sealBackup } from './backup'
import { canonicalRecoveryCode, newRecoveryCode } from '../platform/crypto'

const FAST = 1000 // test-only PBKDF2 iterations

const habit = {
  id: 'h1',
  areaId: 'career',
  name: 'Secret plan habit',
  ifThen: 'After dinner, at my desk, I do the secret thing.',
  minVersion: 'One small step',
  timeBlock: 'evening',
  order: 0,
  activeFrom: '2026-12-01',
  rules: [{ from: '2026-12-01', schedule: { kind: 'daily' }, completion: { kind: 'manual' }, targetText: '', proposed: false, note: '' }],
  createdAt: 0,
  obstacle: '',
  doneHint: '',
}

/** Reads a database without the decryption layer: what is actually stored on the device. */
async function rawRows(dbName: string, table: string): Promise<Record<string, unknown>[]> {
  const raw = new Dexie(dbName)
  await raw.open()
  try {
    return (await raw.table(table).toArray()) as Record<string, unknown>[]
  } finally {
    raw.close()
  }
}

beforeEach(async () => {
  for (const name of await Dexie.getDatabaseNames()) if (name !== 'compound-test') await Dexie.delete(name)
  await forgetSession()
})

describe('accounts', () => {
  it('validates usernames and passwords', () => {
    expect(validateNewAccount('ab', 'longenough', 'longenough')).toMatch(/Username/)
    expect(validateNewAccount('alex', 'short', 'short')).toMatch(/at least 8/)
    expect(validateNewAccount('alex', 'longenough', 'different1')).toMatch(/match/)
    expect(validateNewAccount('alex.k', 'longenough', 'longenough')).toBeNull()
  })

  it('creates accounts with unique usernames and unlocks only with the right password', async () => {
    const { account, key } = await createAccount('Alex', 'right password', FAST)
    await expect(createAccount('alex', 'another one', FAST)).rejects.toBeInstanceOf(AccountError)
    expect((await unlockAccount(' ALEX ', 'right password')).key).toEqual(key)
    await expect(unlockAccount('alex', 'wrong password')).rejects.toThrow('Wrong password.')
    await expect(unlockAccount('nobody', 'right password')).rejects.toThrow(/No account/)
    expect((await listAccounts()).map((a) => a.username)).toEqual([account.username])
  })

  it('stores rows as ciphertext; only index fields stay readable', async () => {
    const { account, key } = await createAccount('alex', 'right password', FAST)
    const db = openAccountDb(account, key)
    await db.habits.put(habit as never)
    await db.kv.put({ key: 'settings', value: { profile: { name: 'Alex' } } })

    const stored = await rawRows(accountDbName(account.id), 'habits')
    expect(Object.keys(stored[0]!).sort()).toEqual(['__enc', 'areaId', 'id', 'order'])
    expect(JSON.stringify(stored)).not.toContain('Secret')
    const kv = await rawRows(accountDbName(account.id), 'kv')
    expect(JSON.stringify(kv)).not.toContain('Alex')

    // Reads, index lookups, filters (cursors) and modify all see plain rows.
    expect((await db.habits.get('h1'))?.name).toBe('Secret plan habit')
    expect(await db.habits.where('areaId').equals('career').count()).toBe(1)
    expect((await db.habits.filter((h) => h.name.startsWith('Secret')).toArray()).length).toBe(1)
    await db.habits.toCollection().modify((h) => {
      h.name = 'Renamed'
    })
    expect((await db.habits.get('h1'))?.name).toBe('Renamed')
    expect(JSON.stringify(await rawRows(accountDbName(account.id), 'habits'))).not.toContain('Renamed')
    db.close()
  })

  it('upgrades older data: exercise names stop being stored in the clear; areas and habits gain explicit roles', async () => {
    const { account, key } = await createAccount('alex', 'right password', FAST)
    const name = accountDbName(account.id)
    // A version-2 encrypted database, as the app wrote it before this change.
    const v2 = new Dexie(name)
    v2.use(encryptionMiddleware(key))
    v2.version(2).stores(storesAt(2))
    await v2.open()
    await v2.table('exercises').put({ id: 'ex:squat', name: 'Back squat', repMin: 8, repMax: 12, increment: 2.5, bodyweight: false, measure: 'reps', notes: '' })
    await v2.table('areas').put({ id: 'skin', name: 'Skin', color: '#00a888', order: 2, goal: '', notes: [], leadMeasures: [], lagMeasures: [] })
    await v2.table('habits').put({ ...habit, id: 'habit:sunscreen-am' })
    v2.close()
    expect(JSON.stringify(await rawRows(name, 'exercises'))).toContain('Back squat')

    const db = openAccountDb(account, key)
    expect((await db.exercises.get('ex:squat'))?.name).toBe('Back squat')
    expect(JSON.stringify(await rawRows(name, 'exercises'))).not.toContain('Back squat')
    expect((await db.areas.get('skin'))?.charts).toBe('skin')
    expect((await db.habits.get('habit:sunscreen-am'))?.role).toBe('sunscreen')
    db.close()
  })

  it('keeps accounts apart: one key cannot read another account', async () => {
    const a = await createAccount('alice', 'password-a', FAST)
    const b = await createAccount('bob', 'password-b', FAST)
    const dbA = openAccountDb(a.account, a.key)
    await dbA.habits.put(habit as never)
    dbA.close()
    const wrongKey = openAccountDb(a.account, b.key)
    await expect(wrongKey.habits.get('h1')).rejects.toThrow()
    wrongKey.close()
    const dbB = openAccountDb(b.account, b.key)
    expect(await dbB.habits.count()).toBe(0)
    dbB.close()
  })

  it('changes the password without re-encrypting the data', async () => {
    const { account, key } = await createAccount('alex', 'old password', FAST)
    const db = openAccountDb(account, key)
    await db.habits.put(habit as never)
    db.close()
    await expect(changePassword(account.id, 'not it', 'new password')).rejects.toThrow(/current password/)
    await changePassword(account.id, 'old password', 'new password')
    await expect(unlockAccount('alex', 'old password')).rejects.toThrow()
    const unlocked = await unlockAccount('alex', 'new password')
    const again = openAccountDb(unlocked.account, unlocked.key)
    expect((await again.habits.get('h1'))?.name).toBe('Secret plan habit')
    again.close()
  })

  it('remembers a login only when asked, and deletes an account with its data', async () => {
    const { account, key } = await createAccount('alex', 'right password', FAST)
    await rememberSession(account.id, null)
    expect(await restoreSession()).toBeNull()
    await rememberSession(account.id, key)
    expect((await restoreSession())?.key).toEqual(key)
    await deleteAccount(account.id)
    expect(await restoreSession()).toBeNull()
    expect(await Dexie.exists(accountDbName(account.id))).toBe(false)
  })

  it('moves data from before accounts into the first account, encrypted', async () => {
    const legacy = openDb(LEGACY_DB_NAME)
    await legacy.kv.put({ key: 'settings', value: { onboardedAt: 1 } })
    await legacy.habits.put(habit as never)
    legacy.close()
    expect(await hasLegacyData()).toBe(true)

    const { account, key } = await createAccount('alex', 'right password', FAST)
    const db = openAccountDb(account, key)
    expect(await migrateLegacyInto(db)).toBe(2)
    expect((await db.habits.get('h1'))?.name).toBe('Secret plan habit')
    expect(await Dexie.exists(LEGACY_DB_NAME)).toBe(false)
    expect(JSON.stringify(await rawRows(accountDbName(account.id), 'habits'))).not.toContain('Secret')
    expect(await hasLegacyData()).toBe(false)
    db.close()
  })
})

describe('recovery codes', () => {
  it('look like five groups of five and survive sloppy typing', () => {
    const code = newRecoveryCode()
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}(-[0-9A-HJKMNP-TV-Z]{5}){4}$/)
    expect(newRecoveryCode()).not.toBe(code)
    expect(canonicalRecoveryCode(` ${code.toLowerCase().replace(/-/g, ' ')} `)).toBe(code.replace(/-/g, ''))
    expect(canonicalRecoveryCode('O0IL1-00000-00000-00000-00000')).toBe('0011100000000000000000000')
    expect(canonicalRecoveryCode('too short')).toBeNull()
    expect(canonicalRecoveryCode('UUUUU-00000-00000-00000-00000')).toBeNull()
  })

  it('reset a forgotten password; the data and the code keep working', async () => {
    const { account, key, recoveryCode } = await createAccount('alex', 'forgotten password', FAST)
    expect(account.recovery).toBeDefined()
    await expect(recoverAccount('alex', 'AAAAA-AAAAA-AAAAA-AAAAA-AAAAA', 'new password 1')).rejects.toThrow('Wrong recovery code.')
    await expect(recoverAccount('alex', 'nope', 'new password 1')).rejects.toThrow(/25 letters and numbers/)
    await expect(recoverAccount('sam', recoveryCode, 'new password 1')).rejects.toThrow(/No account/)

    const recovered = await recoverAccount('ALEX', recoveryCode.toLowerCase(), 'new password 1')
    expect(recovered.key).toEqual(key)
    await expect(unlockAccount('alex', 'forgotten password')).rejects.toThrow('Wrong password.')
    expect((await unlockAccount('alex', 'new password 1')).key).toEqual(key)
    // The same code still works for a second reset.
    expect((await recoverAccount('alex', recoveryCode, 'new password 2')).key).toEqual(key)
  })

  it('a new code needs the password and replaces the old one', async () => {
    const { account, key, recoveryCode: first } = await createAccount('alex', 'right password', FAST)
    await expect(makeRecoveryCode(account.id, 'wrong password')).rejects.toThrow('Wrong password.')
    const second = await makeRecoveryCode(account.id, 'right password')
    expect(second).not.toBe(first)
    await expect(recoverAccount('alex', first, 'new password 1')).rejects.toThrow('Wrong recovery code.')
    expect((await recoverAccount('alex', second, 'new password 1')).key).toEqual(key)
  })

  it('accounts from before recovery codes still open, and say they have none', async () => {
    const { account } = await createAccount('alex', 'right password', FAST)
    const raw = new Dexie('compound-accounts')
    await raw.open()
    await raw.table('accounts').update(account.id, { recovery: undefined })
    raw.close()
    expect((await unlockAccount('alex', 'right password')).account.recovery).toBeUndefined()
    await expect(recoverAccount('alex', newRecoveryCode(), 'new password 1')).rejects.toThrow(/no recovery code/)
  })

  it('open encrypted backups too, and nothing else does', async () => {
    const { account, key, recoveryCode } = await createAccount('alex', 'right password', FAST)
    const sealed = sealBackup(await buildBackup(1_800_000_000_000), account, key)
    const viaCode = JSON.parse(await openSealedBackup(sealed, recoveryCode.toLowerCase()))
    const viaPassword = JSON.parse(await openSealedBackup(sealed, 'right password'))
    expect(viaCode).toEqual(viaPassword)
    expect(viaCode.exportedAt).toBe(1_800_000_000_000)
    await expect(openSealedBackup(sealed, newRecoveryCode())).rejects.toThrow(/Wrong password or recovery code/)
    await expect(openSealedBackup(sealed, 'wrong password')).rejects.toThrow(/Wrong password or recovery code/)
    // A backup from before recovery codes (no recovery lock) still opens with the password.
    const old = JSON.parse(sealed)
    delete old.recoveryLock
    expect(JSON.parse(await openSealedBackup(JSON.stringify(old), 'right password'))).toEqual(viaPassword)
  })
})
