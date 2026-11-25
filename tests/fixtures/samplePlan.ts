import raw from './sample-plan.compound.json'
import { buildFromTemplate, zPlanTemplate, type OnboardingInput } from '../../src/seed/template'

/** A neutral sample plan (no personal content) with the same shape as a real plan file. */
export const samplePlan = zPlanTemplate.parse(raw)

export function sampleInput(over: Partial<OnboardingInput> = {}): OnboardingInput {
  return {
    startDay: '2026-12-01',
    endDay: '2027-08-31',
    weightKg: 80,
    weekdayHours: 2.75,
    weekendHours: 5.5,
    workoutDays: [1, 3, 5],
    workoutTime: '07:00',
    today: '2026-11-25',
    now: 0,
    ...over,
  }
}

/** The sample plan built for a given onboarding (what a user would get from the plan file). */
export function buildSeed(input: Partial<OnboardingInput> = {}) {
  return buildFromTemplate(samplePlan, sampleInput(input), { opaqueIds: false })
}
