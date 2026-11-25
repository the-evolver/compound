import { db } from '../db/db'
import { patchKv, putRows, readKv, writeKv } from '../db/repo'
import { buildFromTemplate, type OnboardingInput, type PlanTemplate } from './template'

/**
 * Version of the starting content. Plans now come from plan files, so this
 * only records that onboarding ran (and from which plan, if any).
 */
export const SEED_VERSION = 2

/**
 * Finishes onboarding for the signed-in account: saves the answers and,
 * if a plan file was chosen, everything in it — in one transaction.
 * Without a plan file the account starts with a blank plan.
 */
export async function completeOnboarding(input: OnboardingInput, plan?: PlanTemplate, options: { opaqueIds?: boolean } = {}): Promise<void> {
  const seed = plan ? buildFromTemplate(plan, input, options) : undefined
  await db.transaction('rw', db.tables, async () => {
    if (seed) {
      await putRows('areas', seed.areas)
      await putRows('phases', seed.phases)
      await putRows('checkpoints', seed.checkpoints)
      await putRows('habits', seed.habits)
      await putRows('subjects', seed.subjects)
      await putRows('topics', seed.topics)
      await putRows('exercises', seed.exercises)
      await putRows('workoutTemplates', seed.workoutTemplates)
      await putRows('tasks', seed.tasks)
      await putRows('dayEntries', seed.dayEntries)
    } else if (input.weightKg !== undefined) {
      await putRows('dayEntries', [{ day: input.today, metrics: { weightKg: input.weightKg }, note: '', updatedAt: input.now }])
    }
    await writeKv('seed', { version: SEED_VERSION, seededAt: input.now })
    const current = await readKv('settings')
    await patchKv('settings', {
      planStart: input.startDay,
      planEnd: input.endDay,
      budget: { weekdayHours: input.weekdayHours, weekendHours: input.weekendHours },
      profile: { ...current.profile, ...(plan?.profile ?? {}) },
      onboardedAt: input.now,
    })
  })
}
