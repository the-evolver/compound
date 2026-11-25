import { z } from 'zod'
import { patchKv } from '../../db/repo'
import type { Settings } from '../../model/core'

/** Saves a settings change. Returns an error message if the value is invalid. */
export async function updateSettings(patch: Partial<Settings>): Promise<string | undefined> {
  try {
    await patchKv('settings', patch)
    return undefined
  } catch (e) {
    if (e instanceof z.ZodError) return e.issues[0]?.message ?? 'That value is not valid.'
    console.error(e)
    return 'Could not save. Please try again.'
  }
}
