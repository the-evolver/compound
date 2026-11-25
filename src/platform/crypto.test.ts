import { describe, expect, it } from 'vitest'
import { fromBase64, newDataKey, newKdfParams, sealJson, toBase64, unsealJson, unwrapDataKey, WrongPasswordError, wrapDataKey } from './crypto'

const FAST = 1000 // test-only iteration count

describe('account crypto', () => {
  it('round-trips base64 of any bytes', () => {
    const bytes = new Uint8Array([0, 1, 254, 255, 128, 64])
    expect(fromBase64(toBase64(bytes))).toEqual(bytes)
  })

  it('wraps the data key so only the right password unwraps it', async () => {
    const key = newDataKey()
    const { kdf, wrappedKey } = await wrapDataKey(key, 'correct horse battery', newKdfParams(FAST))
    expect(await unwrapDataKey(wrappedKey, 'correct horse battery', kdf)).toEqual(key)
    await expect(unwrapDataKey(wrappedKey, 'wrong password', kdf)).rejects.toBeInstanceOf(WrongPasswordError)
    expect(wrappedKey).not.toContain(toBase64(key))
  })

  it('seals values with a fresh nonce each time and detects tampering', () => {
    const key = newDataKey()
    const a = sealJson(key, { name: 'DSA practice', n: 2 })
    const b = sealJson(key, { name: 'DSA practice', n: 2 })
    expect(toBase64(a)).not.toBe(toBase64(b))
    expect(unsealJson(key, a)).toEqual({ name: 'DSA practice', n: 2 })
    const tampered = a.slice()
    tampered[20] = tampered[20]! ^ 1
    expect(() => unsealJson(key, tampered)).toThrow(WrongPasswordError)
    expect(() => unsealJson(newDataKey(), a)).toThrow(WrongPasswordError)
  })
})
