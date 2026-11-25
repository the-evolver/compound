import type { Exercise, WorkoutSession, WorkoutSet, WorkoutTemplate } from '../model/body'
import { startOfWeek, type DayKey, type Weekday } from './time/day'

const byNewest = (a: WorkoutSession, b: WorkoutSession) => (a.day !== b.day ? (a.day < b.day ? 1 : -1) : b.at - a.at)

/** The most recent sets logged for an exercise (in any session). */
export function lastSetsFor(exerciseId: string, sessions: readonly WorkoutSession[]): WorkoutSet[] | undefined {
  for (const s of [...sessions].sort(byNewest)) {
    const entry = s.entries.find((e) => e.exerciseId === exerciseId && e.sets.length > 0)
    if (entry) return entry.sets
  }
  return undefined
}

export type Suggestion =
  | { kind: 'add-weight'; kg: number; reason: string }
  | { kind: 'add-reps'; reason: string }
  | { kind: 'harder'; reason: string }

/**
 * Double progression: work inside the rep range; once every set reaches the
 * top of it, add weight (bodyweight moves: make it harder) next time.
 */
export function progression(exercise: Exercise, lastSets: readonly WorkoutSet[] | undefined): Suggestion | undefined {
  if (!lastSets?.length) return undefined
  const allTop = lastSets.every((s) => s.reps >= exercise.repMax)
  const unit = exercise.measure === 'seconds' ? 's' : ' reps'
  if (allTop) {
    if (exercise.bodyweight) return { kind: 'harder', reason: `All sets hit ${exercise.repMax}${unit}: try a harder variation or add load.` }
    const top = Math.max(...lastSets.map((s) => s.kg))
    return { kind: 'add-weight', kg: Math.round((top + exercise.increment) * 100) / 100, reason: `All sets hit ${exercise.repMax}${unit} last time.` }
  }
  return { kind: 'add-reps', reason: `Aim for ${exercise.repMax}${unit} on every set.` }
}

/** Sets to start a session with: last time's numbers, or the bottom of the rep range. */
export function prefillSets(exercise: Exercise, sets: number, lastSets: readonly WorkoutSet[] | undefined): WorkoutSet[] {
  return Array.from({ length: sets }, (_, i) => {
    const prev = lastSets?.[i] ?? lastSets?.[lastSets.length - 1]
    return prev ? { reps: prev.reps, kg: prev.kg } : { reps: exercise.repMin, kg: 0 }
  })
}

/** Strength score of one set: estimated 1-rep max (Epley) for weighted lifts, reps/seconds for bodyweight. */
export function setScore(exercise: Exercise, set: WorkoutSet): number {
  if (exercise.bodyweight || set.kg <= 0) return set.reps
  return set.kg * (1 + set.reps / 30)
}

export interface PR {
  exerciseId: string
  set: WorkoutSet
  previousBest: number
  score: number
}

/** Sets in `session` that beat every earlier session for that exercise. */
export function prsInSession(session: WorkoutSession, all: readonly WorkoutSession[], exercises: ReadonlyMap<string, Exercise>): PR[] {
  const earlier = all.filter((s) => s.id !== session.id && (s.day < session.day || (s.day === session.day && s.at < session.at)))
  const prs: PR[] = []
  for (const entry of session.entries) {
    const ex = exercises.get(entry.exerciseId)
    if (!ex || !entry.sets.length) continue
    let previousBest = 0
    for (const s of earlier) for (const e of s.entries) if (e.exerciseId === ex.id) for (const set of e.sets) previousBest = Math.max(previousBest, setScore(ex, set))
    if (previousBest === 0) continue // the first time isn't a record
    const best = entry.sets.reduce((a, b) => (setScore(ex, b) > setScore(ex, a) ? b : a))
    const score = setScore(ex, best)
    if (score > previousBest) prs.push({ exerciseId: ex.id, set: best, previousBest, score })
  }
  return prs
}

/** Sessions per week (home sessions count as half: they are the minimum version). */
export function sessionsInWeek(sessions: readonly WorkoutSession[], day: DayKey, weekStartsOn: Weekday): number {
  const start = startOfWeek(day, weekStartsOn)
  return sessions.filter((s) => startOfWeek(s.day, weekStartsOn) === start).reduce((n, s) => n + (s.location === 'home' ? 0.5 : 1), 0)
}

/** Alternates between the gym templates (A/B…): the one used longest ago comes next. */
export function nextTemplate(templates: readonly WorkoutTemplate[], sessions: readonly WorkoutSession[]): WorkoutTemplate | undefined {
  const gym = templates.filter((t) => !t.archived && !/home/i.test(t.name)).sort((a, b) => a.order - b.order)
  if (!gym.length) return undefined
  const lastUsed = new Map<string, string>()
  for (const s of sessions) if (s.templateId) {
    const key = `${s.day}|${String(s.at).padStart(15, '0')}`
    if ((lastUsed.get(s.templateId) ?? '') < key) lastUsed.set(s.templateId, key)
  }
  return [...gym].sort((a, b) => (lastUsed.get(a.id) ?? '').localeCompare(lastUsed.get(b.id) ?? '') || a.order - b.order)[0]
}
