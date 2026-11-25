import { gcm } from '@noble/ciphers/aes.js'
import { bytesToUtf8, randomBytes, utf8ToBytes } from '@noble/ciphers/utils.js'

/*
 * Encryption for local accounts.
 *
 * - A password is stretched with PBKDF2-SHA256 (browser WebCrypto) into a
 *   key-encryption key (KEK).
 * - Each account has a random 256-bit data key, stored only "wrapped"
 *   (encrypted) with the KEK. A wrong password cannot unwrap it, so there
 *   is no password check to bypass: without the password the data stays
 *   ciphertext. Changing the password re-wraps the data key only.
 * - Rows are sealed with AES-256-GCM (audited @noble/ciphers, synchronous,
 *   so it can run inside IndexedDB cursors), with a fresh 96-bit nonce each.
 */

export const KDF_ITERATIONS = 600_000

export interface KdfParams {
  salt: string
  iterations: number
}

export class WrongPasswordError extends Error {
  constructor() {
    super('Wrong password')
  }
}

export function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

export function fromBase64(text: string): Uint8Array {
  const s = atob(text)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

export function newKdfParams(iterations = KDF_ITERATIONS): KdfParams {
  return { salt: toBase64(randomBytes(16)), iterations }
}

/** Stretches a password into a 256-bit key. Deliberately slow (~0.5–2 s on a phone). */
export async function deriveKey(password: string, kdf: KdfParams): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey('raw', utf8ToBytes(password.normalize('NFKC')) as BufferSource, 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(kdf.salt) as BufferSource, iterations: kdf.iterations },
    material,
    256,
  )
  return new Uint8Array(bits)
}

export function newDataKey(): Uint8Array {
  return randomBytes(32)
}

/** nonce (12 bytes) ‖ AES-GCM ciphertext+tag */
export function seal(key: Uint8Array, plaintext: Uint8Array): Uint8Array {
  const nonce = randomBytes(12)
  const ct = gcm(key, nonce).encrypt(plaintext)
  const out = new Uint8Array(12 + ct.length)
  out.set(nonce)
  out.set(ct, 12)
  return out
}

/** Opens a sealed box; throws WrongPasswordError when the key is wrong or the data was altered. */
export function unseal(key: Uint8Array, sealed: Uint8Array): Uint8Array {
  try {
    return gcm(key, sealed.subarray(0, 12)).decrypt(sealed.subarray(12))
  } catch {
    throw new WrongPasswordError()
  }
}

export function sealJson(key: Uint8Array, value: unknown): Uint8Array {
  return seal(key, utf8ToBytes(JSON.stringify(value)))
}

export function unsealJson<T = unknown>(key: Uint8Array, sealed: Uint8Array): T {
  return JSON.parse(bytesToUtf8(unseal(key, sealed))) as T
}

/** Wraps the data key with a password: returns what to store (no secret in it). */
export async function wrapDataKey(dataKey: Uint8Array, password: string, kdf: KdfParams = newKdfParams()): Promise<{ kdf: KdfParams; wrappedKey: string }> {
  const kek = await deriveKey(password, kdf)
  return { kdf, wrappedKey: toBase64(seal(kek, dataKey)) }
}

/** Unwraps the data key; throws WrongPasswordError on a wrong password. */
export async function unwrapDataKey(wrappedKey: string, password: string, kdf: KdfParams): Promise<Uint8Array> {
  const kek = await deriveKey(password, kdf)
  return unseal(kek, fromBase64(wrappedKey))
}

// ── Recovery codes ──────────────────────────────────────────

/** Crockford base32: no I, L, O or U, so it reads and writes down without mix-ups. */
const RECOVERY_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const RECOVERY_LENGTH = 25

/**
 * A recovery code has 125 random bits, far beyond guessing, so it needs no
 * slow stretching: a light PBKDF2 keeps it consistent with passwords.
 */
export const RECOVERY_ITERATIONS = 10_000

/** A new recovery code, shown as five groups of five: `7K2QD-…`. */
export function newRecoveryCode(): string {
  // 256 is a multiple of 32, so masking each byte keeps every character equally likely.
  const chars = Array.from(randomBytes(RECOVERY_LENGTH), (b) => RECOVERY_ALPHABET[b & 31]).join('')
  return chars.match(/.{5}/g)!.join('-')
}

/**
 * The code however it was typed (any case, spaces or dashes, O for 0, I or L
 * for 1), as the 25 characters it was made from; null if it can't be one.
 */
export function canonicalRecoveryCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')
  if (s.length !== RECOVERY_LENGTH) return null
  return [...s].every((c) => RECOVERY_ALPHABET.includes(c)) ? s : null
}
